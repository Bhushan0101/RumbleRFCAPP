"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

const ADMIN_INBOX = process.env.WUCO_ADMIN_INBOX ?? "ops@wuco.ie";

const supportSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
});

export type SupportState = { ok: boolean; message: string };

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
  const { subject, message } = parsed.data;
  await sendMail({
    to: ADMIN_INBOX,
    subject: `Support request from ${session.user.name}: ${subject}`,
    body: `From: ${session.user.name} <${session.user.email}>\nRole: ${
      session.user.role ?? "member"
    }\n\n${message}`,
    category: "fighter_signup", // reuses the audit lane; category expansion is noted in docs
  });
  return { ok: true, message: "Thanks — your message has been sent to the W.U.C.O team." };
}
