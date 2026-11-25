"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendMail, MAIL_ADMIN, buildSupportHtml } from "@/lib/mail";

const supportSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export type SupportState = { ok: boolean; message: string };

const PRIORITY_LABEL: Record<"low" | "normal" | "high" | "urgent", string> = {
  low: "LOW",
  normal: "NORMAL",
  high: "HIGH",
  urgent: "URGENT",
};

export async function sendSupportRequest(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to request support." };
  }
  const parsed = supportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Please add a subject and a message." };
  }
  const { subject, message, priority } = parsed.data;
  const priorityTag = PRIORITY_LABEL[priority];
  await sendMail({
    to: MAIL_ADMIN,
    subject: `[${priorityTag}] Support request from ${session.user.name}: ${subject}`,
    body: `Priority: ${priorityTag}\nFrom: ${session.user.name} <${session.user.email}>\nRole: ${
      session.user.role ?? "member"
    }\n\n${message}`,
    html: buildSupportHtml({
      priority,
      fromName: session.user.name ?? "Member",
      fromEmail: session.user.email ?? "",
      role: session.user.role ?? "member",
      subject,
      message,
    }),
    category: "fighter_signup",
  });
  return { ok: true, message: "Thanks — your message has been sent to the W.U.C.O team." };
}

// Fighter-side "show me the full rankings" ask — admin reviews and responds
// out-of-band (there is no auto-elevation yet).
export async function requestFullRankings(
  _prev: SupportState,
  _formData: FormData,
): Promise<SupportState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to request access." };
  }
  // Pull the fighter's division/discipline from Prisma so the admin has enough
  // context to decide without needing to look anything up.
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.portalUser.findUnique({
    where: { id: Number(session.user.id) },
    include: {
      fighterProfile: {
        include: {
          athlete: { include: { passport: true } },
          gym: true,
        },
      },
    },
  });
  if (!user) return { ok: false, message: "Account not found." };

  const f = user.fighterProfile;
  const detailsLines = [
    `From: ${user.name} <${user.email}> (role: ${user.role})`,
    f?.athlete ? `Athlete: ${f.athlete.name} (#${f.athlete.id})` : null,
    f?.athlete?.passport?.fighterNo ? `Fighter No: ${f.athlete.passport.fighterNo}` : null,
    f?.athlete?.martialArt ? `Primary discipline: ${f.athlete.martialArt}` : null,
    f?.athlete?.division ? `Primary division: ${f.athlete.division}` : null,
    f?.athlete ? `Record: ${f.athlete.wins}-${f.athlete.losses}-${f.athlete.draws}` : null,
    f?.gym?.name ? `Gym: ${f.gym.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Full-rankings access request: ${user.name}`,
    body:
      `${user.name} is asking to view the full W.U.C.O national rankings ` +
      `(not just the public top 10).\n\n${detailsLines}\n\n` +
      `Review the fighter in the admin portal and reply with next steps if appropriate.`,
    category: "fighter_signup",
  });

  return {
    ok: true,
    message: "Request sent. A W.U.C.O admin will review and get back to you.",
  };
}
