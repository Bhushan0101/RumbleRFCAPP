"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail, MAIL_ADMIN } from "@/lib/mail";
import type { FormState } from "./public";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "gym";
}

// Keep year/int fields optional and tolerant of blanks — the admin should be
// able to come back to fill details later.
const yearOpt = z
  .preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(1800).max(2100).optional(),
  );
const countOpt = z
  .preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(100000).optional(),
  );

const onboardingSchema = z.object({
  token: z.string().min(10).max(200),

  // Club info
  name: z.string().min(1, "Club name is required.").max(200),
  address_line_1: z.string().max(240).optional().default(""),
  eircode: z.string().max(16).optional().default(""),
  city: z.string().max(120).optional().default(""),
  county: z.string().max(120).optional().default(""),
  year_established: yearOpt,
  phone: z.string().max(60).optional().default(""),
  website: z.string().max(400).optional().default(""),
  social_links: z.string().max(2000).optional().default(""),
  members_total: countOpt,
  members_under18: countOpt,
  disciplines: z.string().max(500).optional().default(""),
  governing_body: z.string().max(500).optional().default(""),
  about: z.string().max(4000).optional().default(""),
  revolut_handle: z.string().max(80).optional().default(""),

  // Head coach info
  coach_name: z.string().max(200).optional().default(""),
  coach_rank: z.string().max(200).optional().default(""),
  coach_years_training: countOpt,
  coach_style: z.string().max(200).optional().default(""),
  coach_last_grade_year: yearOpt,
  coach_phone: z.string().max(60).optional().default(""),
  coach_email: z.string().max(200).optional().default(""),
  coach_qualifications: z.string().max(2000).optional().default(""),
  coach_years_coaching: countOpt,
  coach_certifications: z.string().max(2000).optional().default(""),
  coach_first_aid_expiry: z.string().max(40).optional().default(""),
  coach_safeguarding: z.string().max(500).optional().default(""),
  coach_garda_vetting: z.string().max(500).optional().default(""),
});

const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function submitOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Split the logo file off before zod — zod would discard it.
  const logoFile = formData.get("logo");
  const entries = Object.fromEntries(formData);
  delete (entries as Record<string, unknown>).logo;

  const parsed = onboardingSchema.safeParse(entries);
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

  // Handle the logo upload (optional).
  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
      return { ok: false, message: "Logo must be JPG, PNG, WEBP, GIF or SVG." };
    }
    if (logoFile.size > MAX_LOGO_BYTES) {
      return { ok: false, message: "Logo is larger than 5 MB." };
    }
    const ext =
      logoFile.type === "image/png"
        ? "png"
        : logoFile.type === "image/webp"
          ? "webp"
          : logoFile.type === "image/gif"
            ? "gif"
            : logoFile.type === "image/svg+xml"
              ? "svg"
              : "jpg";
    const safeName = slugify(d.name);
    const name = `${safeName}-${Date.now()}.${ext}`;
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "public", "uploads", "gyms");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await logoFile.arrayBuffer());
    await writeFile(join(dir, name), buf);
    logoUrl = `/uploads/gyms/${name}`;
  }

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
        logoUrl,
        addressLine1: d.address_line_1,
        eircode: d.eircode,
        county: d.county,
        yearEstablished: d.year_established,
        phone: d.phone,
        website: d.website,
        socialLinks: d.social_links,
        membersTotal: d.members_total,
        membersUnder18: d.members_under18,
        disciplines: d.disciplines,
        governingBody: d.governing_body,
        coachName: d.coach_name,
        coachRank: d.coach_rank,
        coachYearsTraining: d.coach_years_training,
        coachStyle: d.coach_style,
        coachLastGradeYear: d.coach_last_grade_year,
        coachPhone: d.coach_phone,
        coachEmail: d.coach_email,
        coachQualifications: d.coach_qualifications,
        coachYearsCoaching: d.coach_years_coaching,
        coachCertifications: d.coach_certifications,
        coachFirstAidExpiry: d.coach_first_aid_expiry,
        coachSafeguarding: d.coach_safeguarding,
        coachGardaVetting: d.coach_garda_vetting,
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
    to: MAIL_ADMIN,
    subject: `Club onboarding submitted: ${d.name}`,
    body:
      `${tokenRow.enquiry.contactName} <${tokenRow.enquiry.contactEmail}> ` +
      `submitted the detailed onboarding form for ${d.name}.\n\n` +
      `County: ${d.county || "—"} · Established: ${d.year_established ?? "—"} · ` +
      `Members: ${d.members_total ?? "—"} (${d.members_under18 ?? "—"} u18)\n` +
      `Head coach: ${d.coach_name || "—"} (${d.coach_rank || "—"})\n\n` +
      `Review and approve it in the admin portal.`,
    category: "gym_submitted",
  });

  return {
    ok: true,
    message:
      "Thanks — your club onboarding is in. A W.U.C.O admin will review and get in touch.",
  };
}

// --------- Club answers admin follow-up questions ---------------------------
const followupSchema = z.object({
  token: z.string().min(10).max(200),
  // Answers keyed as "answer_<followupId>".
}).passthrough();

export async function submitFollowupAnswers(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const entries = Object.fromEntries(formData);
  const parsed = followupSchema.safeParse(entries);
  if (!parsed.success) {
    return { ok: false, message: "Invalid form." };
  }
  const token = String(parsed.data.token);
  const tokenRow = await prisma.gymOnboardingToken.findUnique({
    where: { token },
    include: { enquiry: { include: { followups: { orderBy: { askedAt: "asc" } } } } },
  });
  if (!tokenRow || tokenRow.kind !== "followup") {
    return { ok: false, message: "Invalid follow-up link." };
  }
  if (tokenRow.expiresAt * 1000 < Date.now()) {
    return { ok: false, message: "This follow-up link has expired." };
  }
  if (tokenRow.usedAt) {
    return { ok: false, message: "This follow-up link has already been used." };
  }

  // Collect answers for unanswered questions only.
  const open = tokenRow.enquiry.followups.filter((f) => !f.answeredAt);
  if (open.length === 0) {
    return { ok: false, message: "There are no open questions to answer." };
  }
  const now = new Date();
  const updates: Promise<unknown>[] = [];
  const unanswered: string[] = [];
  for (const f of open) {
    const raw = String(entries[`answer_${f.id}`] ?? "").trim().slice(0, 4000);
    if (!raw) {
      unanswered.push(f.question);
      continue;
    }
    updates.push(
      prisma.gymEnquiryFollowup.update({
        where: { id: f.id },
        data: { answer: raw, answeredAt: now },
      }),
    );
  }
  if (unanswered.length > 0) {
    return {
      ok: false,
      message: `Please answer every open question (${unanswered.length} left blank).`,
    };
  }
  await Promise.all(updates);

  // Flip the enquiry back to "submitted" so admin sees it in the review queue.
  await prisma.gymEnquiry.update({
    where: { id: tokenRow.enquiryId },
    data: { status: "submitted" },
  });

  // Build an admin-facing summary of the latest Q&A.
  const refreshed = await prisma.gymEnquiry.findUnique({
    where: { id: tokenRow.enquiryId },
    include: { followups: { orderBy: { askedAt: "asc" } } },
  });
  const qaSummary = (refreshed?.followups ?? [])
    .map(
      (f) =>
        `Q: ${f.question}\nA: ${f.answer || "(no answer)"}\n`,
    )
    .join("\n");

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Follow-up answered: ${tokenRow.enquiry.gymName}`,
    body:
      `${tokenRow.enquiry.contactName} <${tokenRow.enquiry.contactEmail}> answered the follow-up questions for ${tokenRow.enquiry.gymName}.\n\n` +
      `${qaSummary}\n\nReview in the admin portal: /portal/admin/gyms`,
    category: "gym_submitted",
  });

  return {
    ok: true,
    message:
      "Thanks — your answers have been sent back to the W.U.C.O admin team. They'll be in touch once reviewed.",
  };
}
