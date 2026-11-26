"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendMail, MAIL_ADMIN, SITE_URL, buildSupportHtml } from "@/lib/mail";

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

// Fighter-side "show me the full rankings" ask — persists a
// RankingAccessRequest and emails admin. Admin fulfils from the admin page by
// minting a RankingShareToken.
export async function requestFullRankings(
  _prev: SupportState,
  _formData: FormData,
): Promise<SupportState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to request access." };
  }
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

  // Idempotent-ish: if there's already a pending request, don't stack another.
  const existing = await prisma.rankingAccessRequest.findFirst({
    where: { userId: user.id, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const request =
    existing ??
    (await prisma.rankingAccessRequest.create({
      data: { userId: user.id, scope: "full", note: detailsLines, status: "pending" },
    }));

  // Notify every admin so the bell pops. Link deep-opens the review modal.
  const admins = await prisma.portalUser.findMany({
    where: { role: { in: ["admin", "ranking_admin"] } },
    select: { id: true },
  });
  if (!existing && admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        kind: "rankings_access_request",
        title: `Rankings access request from ${user.name}`,
        body: detailsLines,
        link: `/portal/admin/ranking-requests?open=${request.id}`,
      })),
    });
  }

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Full-rankings access request: ${user.name}`,
    body:
      `${user.name} is asking to view the full W.U.C.O national rankings ` +
      `(not just the public top 10).\n\n${detailsLines}\n\n` +
      `Review and share the rankings link from the admin portal:\n` +
      `${SITE_URL}/portal/admin/ranking-requests?open=${request.id}`,
    category: "fighter_signup",
  });

  return {
    ok: true,
    message: "Request sent. A W.U.C.O admin will share a link with you by email.",
  };
}

// Fighter-side "show me rankings for other divisions". Same persistence path
// but the admin sees a clearer prompt.
export async function requestExtraRankings(
  _prev: SupportState,
  _formData: FormData,
): Promise<SupportState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to request rankings." };
  }
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.portalUser.findUnique({
    where: { id: Number(session.user.id) },
    include: {
      fighterProfile: {
        include: {
          athlete: { include: { passport: true } },
        },
      },
    },
  });
  if (!user) return { ok: false, message: "Account not found." };
  const a = user.fighterProfile?.athlete;
  const details = [
    `From: ${user.name} <${user.email}>`,
    a ? `Athlete: ${a.name} (#${a.id})` : null,
    a?.passport?.fighterNo ? `Fighter No: ${a.passport.fighterNo}` : null,
    a?.division ? `Current division: ${a.division}` : null,
    a?.martialArt ? `Primary discipline: ${a.martialArt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const existing = await prisma.rankingAccessRequest.findFirst({
    where: { userId: user.id, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const request =
    existing ??
    (await prisma.rankingAccessRequest.create({
      data: { userId: user.id, scope: "full", note: details, status: "pending" },
    }));

  const admins = await prisma.portalUser.findMany({
    where: { role: { in: ["admin", "ranking_admin"] } },
    select: { id: true },
  });
  if (!existing && admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((adm) => ({
        userId: adm.id,
        kind: "rankings_access_request",
        title: `${user.name} wants other-division rankings`,
        body: details,
        link: `/portal/admin/ranking-requests?open=${request.id}`,
      })),
    });
  }

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Rankings request (other divisions): ${user.name}`,
    body:
      `${user.name} wants visibility into rankings outside their own division.\n\n${details}\n\n` +
      `Share a link from: ${SITE_URL}/portal/admin/ranking-requests?open=${request.id}`,
    category: "fighter_signup",
  });

  return {
    ok: true,
    message: "Request sent. A W.U.C.O admin will share a link with you by email.",
  };
}
