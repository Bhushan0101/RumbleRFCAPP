"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  nickname: z.string().max(120).optional().default(""),
  country: z.string().max(60).optional().default(""),
  biography: z.string().max(4000).optional().default(""),
  instagram_handle: z.string().max(120).optional().default(""),
  facebook_url: z.string().max(240).optional().default(""),
  tiktok_handle: z.string().max(120).optional().default(""),
});

export type ProfileState = { ok: boolean; message: string };

export async function updateOwnProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Please sign in." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Please correct the form." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };

  const d = parsed.data;
  await prisma.$transaction([
    prisma.athlete.update({
      where: { id: profile.athleteId },
      data: {
        name: d.name,
        nickname: d.nickname,
        country: d.country,
        biography: d.biography,
        instagramHandle: d.instagram_handle.trim(),
        facebookUrl: d.facebook_url.trim(),
        tiktokHandle: d.tiktok_handle.trim(),
      },
    }),
    prisma.portalUser.update({
      where: { id: session.user.id! },
      data: { name: d.name },
    }),
    prisma.applicationAudit.create({
      data: {
        athleteId: profile.athleteId,
        actorId: session.user.id!,
        action: "profile_updated",
        note: "by fighter (self)",
      },
    }),
  ]);
  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Profile saved." };
}

// ---- Photo file upload ----------------------------------------------------

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function updatePortraitUrl(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in." };
  const file = formData.get("portrait") as File | null;
  if (!file || typeof file === "string" || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Image must be JPG, PNG, WEBP or GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image is larger than 5 MB." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  // Cache-bust so the <img> refreshes immediately after re-upload.
  const name = `${profile.athleteId}-${Date.now()}.${ext}`;

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads", "fighters");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  const publicPath = `/uploads/fighters/${name}`;

  await prisma.athlete.update({
    where: { id: profile.athleteId },
    data: { portraitUrl: publicPath },
  });
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Photo updated." };
}

export async function removePortrait(
  _prev: ProfileState,
  _formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in." };
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };
  await prisma.athlete.update({
    where: { id: profile.athleteId },
    data: { portraitUrl: null },
  });
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Photo removed." };
}

// ---- Fighter gallery photos ----------------------------------------------

const MAX_PHOTOS_PER_FIGHTER = 20;

export async function addFighterPhoto(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in." };
  const file = formData.get("photo") as File | null;
  const caption = String(formData.get("caption") ?? "")
    .toString()
    .slice(0, 240);
  if (!file || typeof file === "string" || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Image must be JPG, PNG, WEBP or GIF." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image is larger than 5 MB." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true, approvalStatus: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };
  if (profile.approvalStatus !== "approved") {
    return { ok: false, message: "Your profile must be approved before you can post photos." };
  }
  const count = await prisma.fighterPhoto.count({
    where: { athleteId: profile.athleteId },
  });
  if (count >= MAX_PHOTOS_PER_FIGHTER) {
    return { ok: false, message: `You can only keep ${MAX_PHOTOS_PER_FIGHTER} photos. Remove one first.` };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const name = `${profile.athleteId}-${Date.now()}.${ext}`;

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), "public", "uploads", "fighter-photos");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, name), buf);
  const publicPath = `/uploads/fighter-photos/${name}`;

  await prisma.fighterPhoto.create({
    data: {
      athleteId: profile.athleteId,
      url: publicPath,
      caption,
    },
  });
  revalidatePath("/portal/profile");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Photo added." };
}

export async function deleteFighterPhoto(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return;
  await prisma.fighterPhoto.deleteMany({
    where: { id, athleteId: profile.athleteId },
  });
  revalidatePath("/portal/profile");
  revalidatePath(`/fighters/${profile.athleteId}`);
}

// ---- Injuries -------------------------------------------------------------

const injurySchema = z.object({
  has_injuries: z.enum(["yes", "no"]),
  injuries_details: z.string().max(4000).optional().default(""),
});

export async function updateInjuries(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in." };
  const parsed = injurySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Choose yes or no." };
  const d = parsed.data;
  if (d.has_injuries === "yes" && d.injuries_details.trim().length === 0) {
    return { ok: false, message: "Describe your injuries." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };
  await prisma.fighterProfile.update({
    where: { athleteId: profile.athleteId },
    data: {
      hasInjuries: d.has_injuries === "yes" ? 1 : 0,
      injuriesDetails: d.has_injuries === "yes" ? d.injuries_details : "",
      injuryAnsweredAt: new Date(),
    },
  });
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true, message: "Injury information saved." };
}

// ---- Fight history --------------------------------------------------------

const fightSchema = z.object({
  fight_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opponent: z.string().min(1).max(200),
  event_name: z.string().max(200).optional().default(""),
  location: z.string().max(200).optional().default(""),
  result: z.enum(["win", "loss", "draw"]),
  method: z.string().max(80).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
});

async function recomputeRecord(athleteId: number) {
  const history = await prisma.fightHistory.findMany({
    where: { athleteId },
    select: { result: true },
  });
  const wins = history.filter((h) => h.result === "win").length;
  const losses = history.filter((h) => h.result === "loss").length;
  const draws = history.filter((h) => h.result === "draw").length;
  await prisma.athlete.update({
    where: { id: athleteId },
    data: { wins, losses, draws },
  });
}

export async function addFightHistory(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Please sign in." };
  const parsed = fightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Fill in date, opponent and result." };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return { ok: false, message: "No fighter profile linked." };
  const d = parsed.data;

  // Soft cap: can't log more fights of a given result than declared at signup.
  const athlete = await prisma.athlete.findUnique({
    where: { id: profile.athleteId },
    select: {
      declaredWins: true,
      declaredLosses: true,
      declaredDraws: true,
    },
  });
  if (!athlete) return { ok: false, message: "Athlete record missing." };
  const existing = await prisma.fightHistory.groupBy({
    by: ["result"],
    where: { athleteId: profile.athleteId },
    _count: { result: true },
  });
  const counts = { win: 0, loss: 0, draw: 0 };
  for (const row of existing) {
    counts[row.result as keyof typeof counts] = row._count.result;
  }
  const declaredFor = {
    win: athlete.declaredWins,
    loss: athlete.declaredLosses,
    draw: athlete.declaredDraws,
  };
  if (counts[d.result] >= declaredFor[d.result]) {
    const label = d.result === "win" ? "wins" : d.result === "loss" ? "losses" : "draws";
    return {
      ok: false,
      message: `You already logged all ${declaredFor[d.result]} declared ${label}. Request a correction if your declared count is wrong.`,
    };
  }

  await prisma.fightHistory.create({
    data: {
      athleteId: profile.athleteId,
      fightDate: d.fight_date,
      opponent: d.opponent,
      eventName: d.event_name,
      location: d.location,
      result: d.result,
      method: d.method,
      notes: d.notes,
    },
  });
  await recomputeRecord(profile.athleteId);
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  revalidatePath(`/fighters/${profile.athleteId}`);
  return { ok: true, message: "Fight added." };
}

export async function deleteFightHistory(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    select: { athleteId: true },
  });
  if (!profile) return;
  // Only delete if the fight belongs to this fighter.
  await prisma.fightHistory.deleteMany({
    where: { id, athleteId: profile.athleteId },
  });
  await recomputeRecord(profile.athleteId);
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
}

// -------- Account deletion request ---------------------------------------
const deletionSchema = z.object({
  reason: z.string().max(2000).optional().default(""),
});

export type DeletionState = { ok: boolean; message: string };

export async function requestAccountDeletion(
  _prev: DeletionState,
  formData: FormData,
): Promise<DeletionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = deletionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const reason = parsed.data.reason?.trim() ?? "";

  const userId = Number(session.user.id);
  const user = await prisma.portalUser.findUnique({
    where: { id: userId },
    include: { fighterProfile: true },
  });
  if (!user) return { ok: false, message: "Account not found." };

  // Idempotency — don't stack multiple pending requests.
  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId, status: "pending" },
  });
  if (existing) {
    return {
      ok: true,
      message: "You already have a pending request. A W.U.C.O admin will be in touch.",
    };
  }

  await prisma.accountDeletionRequest.create({
    data: {
      userId,
      athleteId: user.fighterProfile?.athleteId ?? null,
      reason,
      status: "pending",
    },
  });

  const { sendMail, MAIL_ADMIN } = await import("@/lib/mail");
  await sendMail({
    to: MAIL_ADMIN,
    subject: `Account deletion request: ${user.name} <${user.email}>`,
    body:
      `${user.name} <${user.email}> (user #${userId}) requested account deletion.\n` +
      `Role: ${user.role}\n` +
      (user.fighterProfile ? `Athlete #${user.fighterProfile.athleteId}\n` : "") +
      `\nReason: ${reason || "(no reason given)"}\n\n` +
      `Review in the admin portal: /portal/admin/account-deletions`,
    category: "account_deletion",
  });
  await sendMail({
    to: user.email,
    subject: "W.U.C.O: your account deletion request was received",
    body:
      `Hi ${user.name},\n\n` +
      `We've received your request to close your W.U.C.O Ireland account.\n\n` +
      (reason ? `Reason you shared: ${reason}\n\n` : "") +
      `A W.U.C.O admin will review and close your account. You can keep using the site until then; once the request is actioned, your access ends and your fighter passport is withdrawn (where applicable).\n\n` +
      `If this wasn't you, reply to this email right away.\n\n— W.U.C.O Ireland`,
    category: "account_deletion_ack",
  });

  return {
    ok: true,
    message: "Your account deletion request has been submitted.",
  };
}

// -------- Verification request (free-text, admin reviews) ----------------
const verificationSchema = z.object({
  body: z.string().min(10, "Add a little more detail (min 10 characters).").max(4000),
});

export type VerificationState = { ok: boolean; message: string };

export async function submitVerificationRequest(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = verificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.body?.[0];
    return { ok: false, message: first ?? "Please correct the form." };
  }
  const userId = Number(session.user.id);
  // Only one pending request at a time per user.
  const pending = await prisma.verificationRequest.findFirst({
    where: { userId, status: "pending" },
  });
  if (pending) {
    return { ok: false, message: "You already have a pending verification request." };
  }
  const user = await prisma.portalUser.findUnique({
    where: { id: userId },
    include: { fighterProfile: true },
  });
  if (!user) return { ok: false, message: "Account not found." };

  await prisma.verificationRequest.create({
    data: {
      userId,
      athleteId: user.fighterProfile?.athleteId ?? null,
      body: parsed.data.body.trim(),
      status: "pending",
    },
  });

  const { sendMail, MAIL_ADMIN } = await import("@/lib/mail");
  await sendMail({
    to: MAIL_ADMIN,
    subject: `Verification request: ${user.name}`,
    body:
      `${user.name} <${user.email}> submitted a verification request.\n\n` +
      `Role: ${user.role}\n` +
      (user.fighterProfile ? `Athlete #${user.fighterProfile.athleteId}\n` : "") +
      `\n${parsed.data.body}\n\n` +
      `Review in the admin portal: /portal/admin/verifications`,
    category: "verification_submitted",
  });

  revalidatePath("/portal/profile");
  return { ok: true, message: "Submitted. A W.U.C.O admin will review and get back to you." };
}
