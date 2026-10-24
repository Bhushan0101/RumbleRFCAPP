"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

const ADMIN_INBOX = process.env.WUCO_ADMIN_INBOX ?? "ops@wuco.ie";

const correctionSchema = z.object({
  details: z.string().min(10).max(4000),
});

export type CorrectionState = { ok: boolean; message: string };

export async function submitCorrectionRequest(
  _prev: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  const session = await auth();
  if (!session?.user)
    return { ok: false, message: "Please sign in to request a correction." };
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please describe the correction in at least 10 characters.",
    };
  }
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: session.user.id },
    include: { athlete: { include: { passport: true } } },
  });
  const subject = `Profile correction from ${session.user.name}`;
  const bodyParts = [
    `From: ${session.user.name} <${session.user.email}>`,
    `Role: ${session.user.role ?? "member"}`,
    profile
      ? `Athlete: ${profile.athlete.name} (id ${profile.athlete.id}${
          profile.athlete.passport?.fighterNo
            ? ", " + profile.athlete.passport.fighterNo
            : ""
        })`
      : `No fighter profile linked to this account.`,
    "",
    "Request:",
    parsed.data.details,
  ];
  await sendMail({
    to: ADMIN_INBOX,
    subject,
    body: bodyParts.join("\n"),
    // Re-uses existing enum. We'll surface this in the admin inbox verbatim.
    category: "fighter_signup",
  });
  if (profile) {
    await prisma.applicationAudit.create({
      data: {
        athleteId: profile.athlete.id,
        actorId: session.user.id!,
        action: "profile_correction_requested",
        note: parsed.data.details.slice(0, 1000),
      },
    });
  }
  return {
    ok: true,
    message:
      "Thanks — your correction request has been sent to the W.U.C.O admin team.",
  };
}
