// Minimal log + DB outbound mail. Mirrors the Python wuco_mail.send() API.
import { prisma } from "@/lib/prisma";
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "outbound_mail.log");

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
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
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
