"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, MAIL_ADMIN, SITE_URL } from "@/lib/mail";

export type ClubFlowState = { ok: boolean; message: string };

// --------- Resolve "which gym does this user own?" -----------------------
// Used by every club-side action to scope writes to the signed-in gym.
async function requireGymForUser(
  userId: number,
): Promise<{ id: number; slug: string | null; name: string; status: string }> {
  const gym = await prisma.gym.findFirst({
    where: { ownerId: userId },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!gym) throw new Error("No club is linked to this account.");
  return gym;
}

// Gate for actions that should only run once admin approved the club onto
// WUCO. Callers still need to pass the gym through requireGymForUser first.
function requireActiveGym(gym: { status: string }) {
  if (gym.status !== "active") {
    throw new Error("Your club must be approved by a W.U.C.O admin first.");
  }
}

// --------- Fighter requests to join a club -------------------------------
const joinSchema = z.object({
  gym_id: z.coerce.number().int().positive(),
  message: z.string().max(1000).optional().default(""),
});

export async function requestClubJoin(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in to request to join a club." };
  }
  if (session.user.role !== "fighter") {
    return { ok: false, message: "Only fighter accounts can join clubs." };
  }
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Pick a club first." };
  }
  const { gym_id, message } = parsed.data;

  const gym = await prisma.gym.findUnique({
    where: { id: gym_id },
    include: { owner: true },
  });
  if (!gym || gym.status !== "active") {
    return { ok: false, message: "Club not available." };
  }

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: Number(session.user.id) },
    include: { athlete: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };

  // Idempotent — if a pending request already exists, surface it.
  const existing = await prisma.gymJoinRequest.findUnique({
    where: {
      gymId_userId: { gymId: gym_id, userId: Number(session.user.id) },
    },
  });
  if (existing && existing.status === "pending") {
    return {
      ok: true,
      message: "Your request is already pending with that club.",
    };
  }
  if (existing && existing.status === "approved") {
    return {
      ok: true,
      message: "You're already a member of this club.",
    };
  }
  if (existing) {
    // Previously rejected / withdrawn — re-open with a fresh request.
    await prisma.gymJoinRequest.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        reviewNote: message,
        reviewedAt: null,
        reviewedById: null,
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.gymJoinRequest.create({
      data: {
        gymId: gym_id,
        userId: Number(session.user.id),
        status: "pending",
        reviewNote: message,
      },
    });
  }

  // Notify club owner (if any) + copy admin for visibility.
  if (gym.owner?.email) {
    await sendMail({
      to: gym.owner.email,
      subject: `New fighter join request: ${profile.athlete.name}`,
      body:
        `${profile.athlete.name} <${session.user.email}> has asked to join ${gym.name}.\n\n` +
        (message ? `Message: ${message}\n\n` : "") +
        `Review the request in your portal: ${SITE_URL}/portal/club\n\n— W.U.C.O Ireland`,
      category: "gym_join_request",
    });
  }
  await sendMail({
    to: MAIL_ADMIN,
    subject: `Fighter join request: ${profile.athlete.name} → ${gym.name}`,
    body:
      `${profile.athlete.name} asked to join ${gym.name}.\n\n` +
      (message ? `Message: ${message}\n` : ""),
    category: "gym_join_request",
  });

  revalidatePath("/portal/profile");
  revalidatePath(`/clubs/${gym.slug}`);
  return {
    ok: true,
    message: "Request sent. The club admin will review and respond.",
  };
}

// --------- Club owner approves / rejects a join request -------------------
const reviewSchema = z.object({
  request_id: z.coerce.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(1000).optional().default(""),
});

export async function reviewClubJoinRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  if (session.user.role !== "gym" && session.user.role !== "coach" && session.user.role !== "admin") {
    throw new Error("Not authorised.");
  }
  const d = reviewSchema.parse(Object.fromEntries(formData));

  const req = await prisma.gymJoinRequest.findUnique({
    where: { id: d.request_id },
    include: { gym: true, user: true },
  });
  if (!req) throw new Error("Request not found.");

  // Guardrail — the user must own this gym (admin is allowed to override).
  if (session.user.role !== "admin") {
    const ownedGym = await prisma.gym.findFirst({
      where: { ownerId: Number(session.user.id) },
      select: { id: true },
    });
    if (!ownedGym || ownedGym.id !== req.gymId) throw new Error("Not your club.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.gymJoinRequest.update({
      where: { id: d.request_id },
      data: {
        status: d.decision,
        reviewedAt: new Date(),
        reviewedById: Number(session.user.id),
        reviewNote: d.note,
      },
    });
    if (d.decision === "approved") {
      // Link the fighter's profile to this gym.
      const profile = await tx.fighterProfile.findFirst({
        where: { userId: req.userId },
      });
      if (profile) {
        await tx.fighterProfile.update({
          where: { athleteId: profile.athleteId },
          data: { gymId: req.gymId },
        });
      }
    }
  });

  // Notify the fighter.
  await sendMail({
    to: req.user.email,
    subject: `W.U.C.O: your club join request was ${d.decision}`,
    body:
      `Hi ${req.user.name},\n\n` +
      `Your request to join ${req.gym.name} has been ${d.decision}.\n` +
      (d.note ? `\nNote: ${d.note}\n` : "") +
      `\n— W.U.C.O Ireland`,
    category: "gym_join_request",
  });

  revalidatePath("/portal/club");
  revalidatePath("/portal/profile");
  revalidatePath(`/clubs/${req.gym.slug}`);
}

// --------- Club owner uploads / removes a gallery photo -------------------
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_CLUB = 40;

export async function addClubPhoto(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can add photos." };
  }
  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") ?? "").slice(0, 240);
  if (!file || typeof file === "string" || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Image must be JPG, PNG, WEBP or GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image is larger than 5 MB." };
  }

  const gym = await requireGymForUser(Number(session.user.id));
  const count = await prisma.clubPhoto.count({ where: { gymId: gym.id } });
  if (count >= MAX_PHOTOS_PER_CLUB) {
    return {
      ok: false,
      message: `Up to ${MAX_PHOTOS_PER_CLUB} photos. Remove one first.`,
    };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const name = `${gym.id}-${Date.now()}.${ext}`;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads", "club-photos");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  const publicPath = `/uploads/club-photos/${name}`;

  await prisma.clubPhoto.create({
    data: { gymId: gym.id, url: publicPath, caption },
  });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
  return { ok: true, message: "Photo added." };
}

export async function deleteClubPhoto(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const gym = await requireGymForUser(Number(session.user.id));
  await prisma.clubPhoto.deleteMany({ where: { id, gymId: gym.id } });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
}

// --------- Club owner edits head-coach profile ---------------------------
const yearOpt = z
  .preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(1800).max(2100).optional(),
  );
const countOpt = z
  .preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(100000).optional(),
  );

const coachProfileSchema = z.object({
  coach_name: z.string().max(200).optional().default(""),
  coach_rank: z.string().max(200).optional().default(""),
  coach_years_training: countOpt,
  coach_style: z.string().max(200).optional().default(""),
  coach_last_grade_year: yearOpt,
  coach_phone: z.string().max(60).optional().default(""),
  coach_email: z.string().max(200).optional().default(""),
  coach_qualifications: z.string().max(2000).optional().default(""),
  coach_years_coaching: countOpt,
  coach_certifications: z.string().max(2000).optional().default(""),
  coach_first_aid_expiry: z.string().max(40).optional().default(""),
  coach_safeguarding: z.string().max(500).optional().default(""),
  coach_garda_vetting: z.string().max(500).optional().default(""),
  remove_photo: z.string().optional().default(""),
});

export async function updateCoachProfile(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can edit the coach profile." };
  }
  // Split the photo file off before zod parsing.
  const photoFile = formData.get("coach_photo");
  const entries = Object.fromEntries(formData);
  delete (entries as Record<string, unknown>).coach_photo;

  const parsed = coachProfileSchema.safeParse(entries);
  if (!parsed.success) {
    return { ok: false, message: "Please correct the form." };
  }
  const d = parsed.data;
  const gym = await requireGymForUser(Number(session.user.id));

  // Handle optional photo upload (same rules as club gallery).
  let photoUrlPatch: { coachPhotoUrl?: string | null } = {};
  if (d.remove_photo === "1") {
    photoUrlPatch = { coachPhotoUrl: null };
  }
  if (photoFile instanceof File && photoFile.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(photoFile.type)) {
      return { ok: false, message: "Photo must be JPG, PNG, WEBP or GIF." };
    }
    if (photoFile.size > MAX_IMAGE_BYTES) {
      return { ok: false, message: "Photo is larger than 5 MB." };
    }
    const ext =
      photoFile.type === "image/png"
        ? "png"
        : photoFile.type === "image/webp"
          ? "webp"
          : photoFile.type === "image/gif"
            ? "gif"
            : "jpg";
    const name = `coach-${gym.id}-${Date.now()}.${ext}`;
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "public", "uploads", "coaches");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await photoFile.arrayBuffer());
    await writeFile(join(dir, name), buf);
    photoUrlPatch = { coachPhotoUrl: `/uploads/coaches/${name}` };
  }

  await prisma.gym.update({
    where: { id: gym.id },
    data: {
      coachName: d.coach_name,
      coachRank: d.coach_rank,
      coachYearsTraining: d.coach_years_training,
      coachStyle: d.coach_style,
      coachLastGradeYear: d.coach_last_grade_year,
      coachPhone: d.coach_phone,
      coachEmail: d.coach_email,
      coachQualifications: d.coach_qualifications,
      coachYearsCoaching: d.coach_years_coaching,
      coachCertifications: d.coach_certifications,
      coachFirstAidExpiry: d.coach_first_aid_expiry,
      coachSafeguarding: d.coach_safeguarding,
      coachGardaVetting: d.coach_garda_vetting,
      ...photoUrlPatch,
    },
  });

  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
  return { ok: true, message: "Coach profile saved." };
}

// --------- Gym-initiated withdrawal from WUCO ----------------------------
const withdrawSchema = z.object({
  reason: z.string().max(2000).optional().default(""),
});

export async function requestClubClosure(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can request withdrawal." };
  }
  const parsed = withdrawSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const gym = await requireGymForUser(Number(session.user.id));

  // Idempotent — don't stack pending requests.
  const existing = await prisma.gymClosureRequest.findFirst({
    where: { gymId: gym.id, status: "pending" },
  });
  if (existing) {
    return {
      ok: true,
      message:
        "A withdrawal request is already with the W.U.C.O admin team. They'll be in touch.",
    };
  }

  await prisma.gymClosureRequest.create({
    data: {
      gymId: gym.id,
      requestedById: Number(session.user.id),
      reason: parsed.data.reason.trim(),
      status: "pending",
    },
  });

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Club withdrawal request: ${gym.name}`,
    body:
      `${session.user.name} <${session.user.email}> requested withdrawal of ${gym.name}.\n\n` +
      (parsed.data.reason ? `Reason: ${parsed.data.reason}\n\n` : "") +
      `Review in the admin portal: ${SITE_URL}/portal/admin/gyms`,
    category: "gym_submitted",
  });
  await sendMail({
    to: session.user.email ?? "",
    subject: "W.U.C.O: your withdrawal request has been received",
    body:
      `Hi ${session.user.name},\n\n` +
      `We've received your request to withdraw ${gym.name} from W.U.C.O Ireland. ` +
      `An admin will review and get back to you.\n\n— W.U.C.O Ireland`,
    category: "gym_submitted",
  });

  revalidatePath("/portal/club");
  return {
    ok: true,
    message: "Withdrawal request sent. A W.U.C.O admin will process it.",
  };
}

// --------- Club invites a fighter to join --------------------------------
const inviteSchema = z.object({
  athlete_id: z.coerce.number().int().positive(),
  note: z.string().max(1000).optional().default(""),
});

export async function inviteFighterToClub(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach" && session.user.role !== "admin") {
    return { ok: false, message: "Only club accounts can invite fighters." };
  }
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Pick a fighter to invite." };
  const { athlete_id, note } = parsed.data;

  const gym = await requireGymForUser(Number(session.user.id));
  const target = await prisma.athlete.findFirst({
    where: { id: athlete_id, profile: { approvalStatus: "approved" } },
    include: { profile: { include: { user: true } } },
  });
  if (!target) return { ok: false, message: "Fighter not found or not approved yet." };
  if (target.profile?.gymId === gym.id) {
    return { ok: true, message: "That fighter is already a member of your club." };
  }

  const existing = await prisma.clubFighterInvite.findUnique({
    where: { gymId_athleteId: { gymId: gym.id, athleteId: athlete_id } },
  });
  if (existing && existing.status === "pending") {
    return { ok: true, message: "An invite is already pending with that fighter." };
  }
  if (existing) {
    await prisma.clubFighterInvite.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        note,
        createdAt: new Date(),
        respondedAt: null,
        invitedById: Number(session.user.id),
      },
    });
  } else {
    await prisma.clubFighterInvite.create({
      data: {
        gymId: gym.id,
        athleteId: athlete_id,
        invitedById: Number(session.user.id),
        note,
      },
    });
  }

  if (target.profile?.user) {
    await prisma.notification.create({
      data: {
        userId: target.profile.user.id,
        kind: "club_invite",
        title: `${gym.name} wants you to join`,
        body: note || `Accept to affiliate your W.U.C.O profile with ${gym.name}.`,
        link: "/portal/profile",
      },
    });
    await sendMail({
      to: target.profile.user.email,
      subject: `W.U.C.O: ${gym.name} wants you to join`,
      body:
        `Hi ${target.name},\n\n` +
        `${gym.name} has invited you to affiliate with them on W.U.C.O.\n\n` +
        (note ? `Note: ${note}\n\n` : "") +
        `Accept or decline from your portal: ${SITE_URL}/portal/profile\n\n— W.U.C.O Ireland`,
      category: "gym_join_request",
    });
  }

  revalidatePath("/portal/club");
  return { ok: true, message: `Invite sent to ${target.name}.` };
}

// --------- Fighter responds to a club invite ----------------------------
const inviteResponseSchema = z.object({
  invite_id: z.coerce.number().int().positive(),
  decision: z.enum(["accept", "decline"]),
});

export async function respondToClubInvite(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  const d = inviteResponseSchema.parse(Object.fromEntries(formData));

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: Number(session.user.id) },
    include: { athlete: true },
  });
  if (!profile) throw new Error("Fighter profile not found.");

  const invite = await prisma.clubFighterInvite.findUnique({
    where: { id: d.invite_id },
    include: { gym: true },
  });
  if (!invite || invite.athleteId !== profile.athleteId) {
    throw new Error("Invite not found.");
  }
  if (invite.status !== "pending") {
    throw new Error("Invite already resolved.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.clubFighterInvite.update({
      where: { id: invite.id },
      data: {
        status: d.decision === "accept" ? "accepted" : "declined",
        respondedAt: now,
      },
    });
    if (d.decision === "accept") {
      await tx.fighterProfile.update({
        where: { athleteId: profile.athleteId },
        data: { gymId: invite.gymId },
      });
    }
  });

  // Notify the club owner.
  if (invite.gym.ownerId) {
    const owner = await prisma.portalUser.findUnique({
      where: { id: invite.gym.ownerId },
      select: { id: true, email: true, name: true },
    });
    if (owner) {
      await prisma.notification.create({
        data: {
          userId: owner.id,
          kind: d.decision === "accept" ? "club_invite_accepted" : "club_invite_declined",
          title: `${profile.athlete.name} ${d.decision === "accept" ? "joined" : "declined"} ${invite.gym.name}`,
          body: d.decision === "accept" ? "They are now affiliated with your club." : "",
          link: "/portal/club",
        },
      });
      if (owner.email) {
        await sendMail({
          to: owner.email,
          subject: `W.U.C.O: ${profile.athlete.name} ${d.decision === "accept" ? "accepted" : "declined"} your invite`,
          body:
            `Hi ${owner.name},\n\n` +
            `${profile.athlete.name} ${d.decision === "accept" ? "accepted your invite to join" : "declined your invite to join"} ${invite.gym.name}.\n\n` +
            `Manage your club: ${SITE_URL}/portal/club\n\n— W.U.C.O Ireland`,
          category: "gym_join_request",
        });
      }
    }
  }

  revalidatePath("/portal/profile");
  revalidatePath("/portal/club");
}

// --------- Club cancels a pending invite --------------------------------
export async function cancelClubInvite(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  const id = Number(formData.get("invite_id"));
  if (!id) throw new Error("Missing invite id.");
  const gym = await requireGymForUser(Number(session.user.id));
  await prisma.clubFighterInvite.updateMany({
    where: { id, gymId: gym.id, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date() },
  });
  revalidatePath("/portal/club");
}


// --------- Timetable image upload / removal -------------------------------
export async function updateTimetableImage(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can edit the timetable." };
  }
  const file = formData.get("timetable") as File | null;
  if (!file || typeof file === "string" || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Image must be JPG, PNG, WEBP or GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image is larger than 5 MB." };
  }
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const name = `timetable-${gym.id}-${Date.now()}.${ext}`;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads", "timetables");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  const publicPath = `/uploads/timetables/${name}`;

  await prisma.gym.update({
    where: { id: gym.id },
    data: { timetableImageUrl: publicPath },
  });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
  return { ok: true, message: "Timetable image updated." };
}

export async function removeTimetableImage(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);
  void formData; // no fields needed
  await prisma.gym.update({
    where: { id: gym.id },
    data: { timetableImageUrl: null },
  });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
}

// --------- Structured class slots (weekly timetable) ---------------------
const classSchema = z.object({
  class_id: z.coerce.number().int().positive().optional(),
  title: z.string().min(1).max(120),
  discipline: z.string().max(60).optional().default(""),
  // 0 = Monday … 6 = Sunday (matching Date.getDay with Mon-first mapping).
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
  duration_minutes: z.coerce.number().int().min(15).max(240),
  capacity: z.coerce.number().int().min(1).max(500).default(20),
  per_class_price_eur: z.string().optional().default(""),
  revolut_url: z.string().max(400).optional().default(""),
  colour: z.string().max(40).optional().default(""),
});

export async function saveGymClass(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can edit classes." };
  }
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { ok: false, message: first ?? "Please correct the form." };
  }
  const d = parsed.data;
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);

  const priceCents =
    d.per_class_price_eur && d.per_class_price_eur.trim() !== ""
      ? Math.max(0, Math.round(Number(d.per_class_price_eur) * 100))
      : null;

  if (d.class_id) {
    // Verify ownership before writing.
    const existing = await prisma.gymClass.findFirst({
      where: { id: d.class_id, gymId: gym.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, message: "Class not found." };
    await prisma.gymClass.update({
      where: { id: d.class_id },
      data: {
        title: d.title,
        discipline: d.discipline,
        dayOfWeek: d.day_of_week,
        startTime: d.start_time,
        durationMinutes: d.duration_minutes,
        capacity: d.capacity,
        perClassPriceCents: priceCents,
        revolutUrl: d.revolut_url,
        colour: d.colour,
      },
    });
  } else {
    await prisma.gymClass.create({
      data: {
        gymId: gym.id,
        title: d.title,
        discipline: d.discipline,
        dayOfWeek: d.day_of_week,
        startTime: d.start_time,
        durationMinutes: d.duration_minutes,
        capacity: d.capacity,
        perClassPriceCents: priceCents,
        revolutUrl: d.revolut_url,
        colour: d.colour,
      },
    });
  }
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
  return { ok: true, message: "Class saved." };
}

export async function deleteGymClass(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = Number(formData.get("class_id"));
  if (!id) return;
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);
  // Scope to the signed-in gym so one owner can't delete another's class.
  await prisma.gymClass.deleteMany({ where: { id, gymId: gym.id } });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
}

// --------- Passes / paid products -----------------------------------------
const PRODUCT_KINDS = ["day_pass", "weekly_pass", "monthly_pass", "per_class"] as const;

const productSchema = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  kind: z.enum(PRODUCT_KINDS),
  title: z.string().min(1).max(120),
  price_eur: z.string().min(1, "Enter a price in EUR."),
  revolut_url: z.string().max(400).optional().default(""),
  active: z.coerce.number().int().min(0).max(1).default(1),
});

export async function saveGymProduct(
  _prev: ClubFlowState,
  formData: FormData,
): Promise<ClubFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach") {
    return { ok: false, message: "Only club accounts can edit passes." };
  }
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { ok: false, message: first ?? "Please correct the form." };
  }
  const d = parsed.data;
  const priceNum = Number(d.price_eur);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return { ok: false, message: "Price must be a positive number." };
  }
  const priceCents = Math.round(priceNum * 100);
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);

  if (d.product_id) {
    const existing = await prisma.gymProduct.findFirst({
      where: { id: d.product_id, gymId: gym.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, message: "Pass not found." };
    await prisma.gymProduct.update({
      where: { id: d.product_id },
      data: {
        kind: d.kind,
        title: d.title,
        priceCents,
        revolutUrl: d.revolut_url,
        active: d.active,
      },
    });
  } else {
    await prisma.gymProduct.create({
      data: {
        gymId: gym.id,
        kind: d.kind,
        title: d.title,
        priceCents,
        revolutUrl: d.revolut_url,
        active: d.active,
      },
    });
  }
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
  return { ok: true, message: "Pass saved." };
}

export async function deleteGymProduct(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = Number(formData.get("product_id"));
  if (!id) return;
  const gym = await requireGymForUser(Number(session.user.id));
  requireActiveGym(gym);
  await prisma.gymProduct.deleteMany({ where: { id, gymId: gym.id } });
  revalidatePath("/portal/club");
  if (gym.slug) revalidatePath(`/clubs/${gym.slug}`);
}
