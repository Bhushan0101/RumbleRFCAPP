"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import type { FormState } from "./public";

const ADMIN_INBOX = process.env.WUCO_ADMIN_INBOX ?? "ops@wuco.ie";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "gym";
}

const onboardingSchema = z.object({
  token: z.string().min(10).max(200),
  name: z.string().min(1).max(120),
  city: z.string().max(120).optional().default(""),
  about: z.string().max(2000).optional().default(""),
  revolut_handle: z.string().max(80).optional().default(""),
});

export async function submitOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      message: "Please correct the form.",
      errors: parsed.error.flatten().fieldErrors,
    };
  const d = parsed.data;
  const tokenRow = await prisma.gymOnboardingToken.findUnique({
    where: { token: d.token },
    include: { enquiry: true },
  });
  if (!tokenRow) return { ok: false, message: "Invalid onboarding link." };
  if (tokenRow.usedAt) return { ok: false, message: "Link already used." };
  if (tokenRow.expiresAt * 1000 < Date.now())
    return { ok: false, message: "Link expired." };

  // Build a unique slug.
  const base = slugify(d.name);
  let slug = base;
  for (let i = 2; await prisma.gym.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

  await prisma.$transaction([
    prisma.gym.create({
      data: {
        name: d.name,
        city: d.city || tokenRow.enquiry.city,
        about: d.about,
        revolutHandle: d.revolut_handle,
        slug,
        status: "pending_review",
        contactEmail: tokenRow.enquiry.contactEmail,
        joinCode: slug.toUpperCase().slice(0, 8),
      },
    }),
    prisma.gymOnboardingToken.update({
      where: { token: d.token },
      data: { usedAt: new Date() },
    }),
    prisma.gymEnquiry.update({
      where: { id: tokenRow.enquiryId },
      data: { status: "submitted" },
    }),
  ]);
  await sendMail({
    to: ADMIN_INBOX,
    subject: `Gym onboarding submitted: ${d.name}`,
    body: `${tokenRow.enquiry.contactName} <${tokenRow.enquiry.contactEmail}> submitted the onboarding form for ${d.name}. Review it in the admin portal.`,
    category: "gym_submitted",
  });

  return {
    ok: true,
    message:
      "Thanks — your onboarding is in. A W.U.C.O admin will approve and send you a coach login by email.",
  };
}
