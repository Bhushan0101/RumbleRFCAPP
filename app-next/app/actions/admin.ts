"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, buildPassportCardHtml, SITE_URL } from "@/lib/mail";
import { hashPassword } from "@/lib/password";
import { martialArtName, classDisplayName } from "@/lib/martial-arts";
import { divisionDisplayName } from "@/lib/divisions";

function randomBase64Url(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  return session.user;
}

async function nextFighterNo(): Promise<string> {
  const last = await prisma.fighterPassport.findFirst({
    where: { fighterNo: { startsWith: "IRL-" } },
    orderBy: { fighterNo: "desc" },
  });
  const n = last ? parseInt(last.fighterNo.slice(4), 10) + 1 : 1;
  return `IRL-${String(n).padStart(6, "0")}`;
}

const reviewSchema = z.object({
  athlete_id: z.coerce.number().int().positive(),
  decision: z.enum(["approved", "rejected", "suspended"]),
  note: z.string().max(2000).optional().default(""),
});

export type ReviewState = { ok: boolean; message: string };

export async function reviewFighter(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  try {
    const admin = await requireAdmin();
    const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: "Invalid review form data." };
    }
    const p = parsed.data;
    type Notify = {
      email: string;
      name: string;
      discipline: string;
      division: string;
      className: string;
      record: string;
      nationality: string;
      club: string;
    };
    let fighterNo: string | null = null;
    let notify: Notify | null = null;
    await prisma.$transaction(async (tx) => {
      const profile = await tx.fighterProfile.findUnique({
        where: { athleteId: p.athlete_id },
        include: { athlete: true, user: true, gym: true },
      });
      if (!profile) throw new Error("Fighter not found");
      await tx.fighterProfile.update({
        where: { athleteId: p.athlete_id },
        data: {
          approvalStatus: p.decision,
          reviewedById: Number(admin.id),
          reviewedAt: new Date(),
          reviewNote: p.note,
        },
      });
      await tx.applicationAudit.create({
        data: {
          athleteId: p.athlete_id,
          actorId: Number(admin.id),
          action: p.decision,
          note: p.note,
        },
      });
      if (p.decision === "approved") {
        const existing = await tx.fighterPassport.findUnique({
          where: { athleteId: p.athlete_id },
        });
        if (existing) {
          fighterNo = existing.fighterNo;
        } else {
          fighterNo = await nextFighterNo();
          await tx.fighterPassport.create({
            data: { athleteId: p.athlete_id, fighterNo },
          });
        }
        // Notify peers in the same gender + division + martial art.
        const peers = await tx.fighterProfile.findMany({
          where: {
            approvalStatus: "approved",
            athleteId: { not: p.athlete_id },
            athlete: {
              gender: profile.athlete.gender,
              division: profile.athlete.division,
              martialArt: profile.athlete.martialArt,
            },
            userId: { not: null },
          },
          select: { userId: true },
        });
        if (peers.length > 0) {
          const divisionLabel = divisionDisplayName(
            profile.athlete.gender,
            profile.athlete.division,
          );
          await tx.notification.createMany({
            data: peers
              .filter((p2) => p2.userId !== null)
              .map((p2) => ({
                userId: p2.userId as number,
                kind: "new_division_peer",
                title: `New fighter in your division: ${profile.athlete.name}`,
                body: `${profile.athlete.name} has been approved in ${divisionLabel}.`,
                link: fighterNo ? `/passport/${fighterNo}` : "/rankings",
              })),
          });
        }
      }
      if (profile.user?.email) {
        notify = {
          email: profile.user.email,
          name: profile.athlete.name,
          discipline: martialArtName(profile.athlete.martialArt),
          division: divisionDisplayName(profile.athlete.gender, profile.athlete.division),
          className: profile.athlete.classCode
            ? classDisplayName(profile.athlete.martialArt, profile.athlete.classCode)
            : "—",
          record: `${profile.athlete.wins}-${profile.athlete.losses}-${profile.athlete.draws}`,
          nationality: profile.athlete.country,
          club: profile.gym?.name ?? "",
        };
      }
    });

    if (notify) {
      const n: Notify = notify;
      if (p.decision === "approved" && fighterNo) {
        const passportUrl = `${SITE_URL}/passport/${fighterNo}`;
        await sendMail({
          to: n.email,
          subject: `W.U.C.O: your fighter passport ${fighterNo} is live`,
          body: `Hi ${n.name},\n\nYour W.U.C.O fighter application has been approved.\n\nFighter number: ${fighterNo}\nDiscipline: ${n.discipline}\nDivision: ${n.division}\nClass: ${n.className}\nRecord: ${n.record}\n\nYour passport is live at: ${passportUrl}${p.note ? `\n\nAdmin note: ${p.note}` : ""}\n\n— W.U.C.O Ireland`,
          html: buildPassportCardHtml({
            name: n.name,
            fighterNo,
            discipline: n.discipline,
            division: n.division,
            className: n.className,
            record: n.record,
            nationality: n.nationality,
            club: n.club,
            passportUrl,
          }),
          category: "fighter_approved",
        });
      } else {
        await sendMail({
          to: n.email,
          subject: `W.U.C.O: your application was ${p.decision}`,
          body: `Hi ${n.name},\n\nYour fighter application has been ${p.decision}.${p.note ? `\n\nAdmin note: ${p.note}` : ""}\n\n— W.U.C.O Ireland`,
          category: "fighter_rejected",
        });
      }
    }
    revalidatePath("/portal/admin/fighters");
    revalidatePath("/portal");
    revalidatePath("/");
    return {
      ok: true,
      message:
        p.decision === "approved"
          ? `Approved — passport ${fighterNo} issued.`
          : `Marked as ${p.decision}.`,
    };
  } catch (e) {
    console.error("[reviewFighter] failed:", e);
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Review failed. Check server logs.",
    };
  }
}

// -------- DELETE FIGHTER (destructive) -----------------------------------
// Removes the athlete and every row that references them: profile (cascade),
// passport (cascade), rankings, bouts, event registrations, application audit,
// and the linked portal user if any. Admin-only.
export async function deleteFighter(formData: FormData) {
  await requireAdmin();
  const athleteId = Number(formData.get("athlete_id"));
  if (!athleteId) throw new Error("Missing athlete id.");
  const profile = await prisma.fighterProfile.findUnique({
    where: { athleteId },
    select: { userId: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.ranking.deleteMany({ where: { athleteId } });
    await tx.eventRegistration.deleteMany({ where: { athleteId } });
    await tx.applicationAudit.deleteMany({ where: { athleteId } });
    // Bouts reference the athlete via red/blue/winner — remove result first.
    const bouts = await tx.bout.findMany({
      where: {
        OR: [
          { redAthleteId: athleteId },
          { blueAthleteId: athleteId },
          { winnerId: athleteId },
        ],
      },
      select: { id: true },
    });
    const boutIds = bouts.map((b) => b.id);
    if (boutIds.length > 0) {
      await tx.boutResult.deleteMany({ where: { boutId: { in: boutIds } } });
      await tx.bout.deleteMany({ where: { id: { in: boutIds } } });
    }
    // FighterProfile + FighterPassport cascade on athlete delete.
    await tx.athlete.delete({ where: { id: athleteId } });
    // Remove the linked portal user so they can re-register with the same email.
    if (profile?.userId) {
      await tx.portalUser.delete({ where: { id: profile.userId } });
    }
  });
  revalidatePath("/portal/admin/fighters");
  revalidatePath("/fighters");
  revalidatePath("/rankings");
  revalidatePath("/");
}

// -------- GYM ENQUIRY FLOW ----------------------------------------------
export async function inviteGym(formData: FormData) {
  const admin = await requireAdmin();
  const enquiryId = Number(formData.get("enquiry_id"));
  const enquiry = await prisma.gymEnquiry.findUnique({ where: { id: enquiryId } });
  if (!enquiry) throw new Error("Enquiry not found");
  const token = randomBase64Url(24);
  const expires = Math.floor(Date.now() / 1000) + 14 * 24 * 3600;
  await prisma.$transaction([
    prisma.gymOnboardingToken.create({
      data: { token, enquiryId, expiresAt: expires },
    }),
    prisma.gymEnquiry.update({
      where: { id: enquiryId },
      data: {
        status: "invited",
        invitedById: Number(admin.id),
        invitedAt: new Date(),
      },
    }),
  ]);
  const link = `/clubs/onboarding?token=${token}`;
  await sendMail({
    to: enquiry.contactEmail,
    subject: "W.U.C.O gym onboarding link",
    body: `Hi ${enquiry.contactName},\n\nThanks for your interest in bringing ${enquiry.gymName} into W.U.C.O. Please complete the onboarding form (valid for 14 days):\n\n${link}\n\nW.U.C.O Ireland`,
    category: "gym_onboarding",
  });
  revalidatePath("/portal/admin/gyms");
}

export async function rejectEnquiry(formData: FormData) {
  const admin = await requireAdmin();
  const enquiryId = Number(formData.get("enquiry_id"));
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  await prisma.gymEnquiry.update({
    where: { id: enquiryId },
    data: {
      status: "rejected",
      reviewedById: Number(admin.id),
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
  revalidatePath("/portal/admin/gyms");
}

export async function approveGymEnquiry(formData: FormData) {
  const admin = await requireAdmin();
  const enquiryId = Number(formData.get("enquiry_id"));
  const enquiry = await prisma.gymEnquiry.findUnique({ where: { id: enquiryId } });
  if (!enquiry) throw new Error("Enquiry not found");
  if (enquiry.status !== "submitted")
    throw new Error("Only submitted onboardings can be approved");
  const gym = await prisma.gym.findFirst({
    where: { contactEmail: enquiry.contactEmail },
    orderBy: { id: "desc" },
  });
  if (!gym) throw new Error("No matching gym onboarding found");

  const tempPassword = randomBase64Url(8);
  const { salt, hash } = await hashPassword(tempPassword);
  await prisma.$transaction([
    prisma.portalUser.create({
      data: {
        email: enquiry.contactEmail,
        name: enquiry.contactName,
        role: "gym",
        salt,
        passwordHash: hash,
      },
    }),
    prisma.gym.update({
      where: { id: gym.id },
      data: { status: "active" },
    }),
    prisma.gymEnquiry.update({
      where: { id: enquiryId },
      data: {
        status: "approved",
        reviewedById: Number(admin.id),
        reviewedAt: new Date(),
      },
    }),
  ]);
  // Link gym owner. (Prisma can't do this in a single transaction above because
  // we need the new user id.)
  const newUser = await prisma.portalUser.findUnique({
    where: { email: enquiry.contactEmail },
  });
  if (newUser) {
    await prisma.gym.update({
      where: { id: gym.id },
      data: { ownerId: newUser.id },
    });
    await prisma.coach.create({
      data: {
        userId: newUser.id,
        gymId: gym.id,
        name: enquiry.contactName,
      },
    });
  }
  await sendMail({
    to: enquiry.contactEmail,
    subject: "Your W.U.C.O gym page is live",
    body: `Hi ${enquiry.contactName},\n\n${gym.name} is now approved on W.U.C.O. Your coach account has been created.\n\n  Email: ${enquiry.contactEmail}\n  Temporary password: ${tempPassword}\n\nPlease change the password after your first sign in.`,
    category: "gym_approved",
  });
  revalidatePath("/portal/admin/gyms");
}

// ---------- Account deletion processing --------------------------------------
export async function closeAccountFromRequest(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("request_id"));
  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw new Error("Invalid request id");
  }
  const req = await prisma.accountDeletionRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { include: { fighterProfile: true } },
    },
  });
  if (!req) throw new Error("Request not found");
  if (req.status !== "pending") return;

  const userId = req.userId;
  const athleteId = req.user.fighterProfile?.athleteId ?? null;
  const email = req.user.email;
  const name = req.user.name;

  await prisma.$transaction(async (tx) => {
    // Mark request processed first so the row exists even if subsequent
    // deletes touch the user cascade.
    await tx.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: "processed",
        processedAt: new Date(),
        processedById: Number(admin.id),
      },
    });
    // Suspend the athlete's public passport if any, before the user row goes.
    if (athleteId != null) {
      await tx.fighterProfile.update({
        where: { athleteId },
        data: { approvalStatus: "suspended" },
      });
    }
    // Delete the PortalUser. Cascades remove sessions and any related rows.
    await tx.portalUser.delete({ where: { id: userId } });
  });

  await sendMail({
    to: email,
    subject: "W.U.C.O: your account has been closed",
    body:
      `Hi ${name},\n\nYour W.U.C.O Ireland account has been closed as requested. Your fighter passport (if applicable) has been withdrawn and your sign-in access is no longer active.\n\nIf you did not request this, reply to this email as soon as possible.\n\n— W.U.C.O Ireland`,
    category: "account_closed",
  });

  revalidatePath("/portal/admin/account-deletions");
  revalidatePath("/portal/admin/fighters");
}

// ---------- Verification review ---------------------------------------------
export async function verifyVerificationRequest(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("request_id"));
  const note = String(formData.get("admin_note") ?? "").slice(0, 2000);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid request id");
  const req = await prisma.verificationRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!req || req.status !== "pending") return;

  await prisma.verificationRequest.update({
    where: { id },
    data: {
      status: "verified",
      adminNote: note,
      verifiedAt: new Date(),
      verifiedById: Number(admin.id),
    },
  });
  await sendMail({
    to: req.user.email,
    subject: "W.U.C.O: your verification request was approved",
    body:
      `Hi ${req.user.name},\n\nYour verification request has been approved by a W.U.C.O admin.\n\n` +
      (note ? `Note: ${note}\n\n` : "") +
      `You can view the approved submission on your profile. If you need another entry verified, submit a new request from your profile page.\n\n— W.U.C.O Ireland`,
    category: "verification_verified",
  });
  revalidatePath("/portal/admin/verifications");
  revalidatePath("/portal/profile");
}

export async function rejectVerificationRequest(formData: FormData) {
  const admin = await requireAdmin();
  const id = Number(formData.get("request_id"));
  const note = String(formData.get("admin_note") ?? "").slice(0, 2000);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid request id");
  const req = await prisma.verificationRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!req || req.status !== "pending") return;

  await prisma.verificationRequest.update({
    where: { id },
    data: {
      status: "rejected",
      adminNote: note,
      verifiedAt: new Date(),
      verifiedById: Number(admin.id),
    },
  });
  await sendMail({
    to: req.user.email,
    subject: "W.U.C.O: your verification request needs attention",
    body:
      `Hi ${req.user.name},\n\nYour recent verification request could not be approved as submitted.\n\n` +
      (note ? `Admin note: ${note}\n\n` : "") +
      `You can submit a new request with updated information from your W.U.C.O profile page.\n\n— W.U.C.O Ireland`,
    category: "verification_rejected",
  });
  revalidatePath("/portal/admin/verifications");
  revalidatePath("/portal/profile");
}
