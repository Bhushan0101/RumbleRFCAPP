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
