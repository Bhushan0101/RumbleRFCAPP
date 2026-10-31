// Minimal log + DB outbound mail. Mirrors the Python wuco_mail.send() API.
//
// On Render / local dev we also append to logs/outbound_mail.log for
// convenience; on Workers (no filesystem) we only write the DB row — the
// admin inbox at /portal/admin/inbox is still the source of truth.
import { prisma } from "@/lib/prisma";

const IS_CLOUDFLARE = process.env.DEPLOY_TARGET === "cloudflare";

export type MailCategory =
  | "fighter_signup"
  | "fighter_approved"
  | "fighter_rejected"
  | "gym_enquiry"
  | "gym_onboarding"
  | "gym_submitted"
  | "gym_approved"
  | "gym_join_request"
  | "class_booking";

async function logToFile(entry: Record<string, unknown>) {
  if (IS_CLOUDFLARE) return;
  try {
    const { mkdir, appendFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "logs");
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, "outbound_mail.log"), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

export async function sendMail(args: {
  to: string;
  subject: string;
  body: string;
  category: MailCategory;
}) {
  const ts = new Date().toISOString();
  await logToFile({ ts, ...args });
  await prisma.outboundMail.create({
    data: {
      toAddress: args.to,
      subject: args.subject,
      body: args.body,
      category: args.category,
    },
  });
}
