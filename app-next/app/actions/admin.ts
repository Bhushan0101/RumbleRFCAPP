"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { hashPassword } from "@/lib/password";

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
    let fighterNo: string | null = null;
    await prisma.$transaction(async (tx) => {
      const profile = await tx.fighterProfile.findUnique({
        where: { athleteId: p.athlete_id },
        include: { athlete: true, user: true },
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
      }
      if (profile.user?.email) {
        await sendMail({
          to: profile.user.email,
          subject: `W.U.C.O: your application was ${p.decision}`,
          body: `Hi ${profile.athlete.name},\n\nYour fighter application has been ${p.decision}.${p.note ? `\n\nAdmin note: ${p.note}` : ""}\n\n— W.U.C.O Ireland`,
          category:
            p.decision === "approved" ? "fighter_approved" : "fighter_rejected",
        });
      }
    });
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
