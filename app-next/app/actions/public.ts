"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

const ADMIN_INBOX = process.env.WUCO_ADMIN_INBOX ?? "ops@wuco.ie";

export type FormState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// -------- GYM ENQUIRY ---------------------------------------------------
const enquirySchema = z.object({
  gym_name: z.string().min(1).max(120),
  contact_name: z.string().min(1).max(120),
  contact_email: z.string().email().max(254),
  phone: z.string().max(60).optional(),
  city: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
});

export async function submitGymEnquiry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = enquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the form.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const enquiry = await prisma.gymEnquiry.create({
    data: {
      gymName: d.gym_name,
      contactName: d.contact_name,
      contactEmail: d.contact_email.toLowerCase(),
      phone: d.phone ?? "",
      city: d.city ?? "",
      message: d.message ?? "",
    },
  });
  await sendMail({
    to: ADMIN_INBOX,
    subject: `New gym enquiry: ${d.gym_name}`,
    body: `${d.contact_name} <${d.contact_email}> submitted an enquiry for ${d.gym_name} (${d.city || "no city"}, ${d.phone || "no phone"}).\n\nMessage:\n${d.message || "—"}`,
    category: "gym_enquiry",
  });
  return {
    ok: true,
    message:
      "Thanks — your enquiry has reached the W.U.C.O admin team. You'll receive the full onboarding form by email once reviewed.",
  };
}

// -------- CLASS BOOKING --------------------------------------------------
const bookingSchema = z
  .object({
    class_id: z.coerce.number().int().positive(),
    booked_for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guest_name: z.string().max(120).optional().default(""),
    guest_email: z.string().email().max(254).or(z.literal("")).default(""),
  })
  .refine((v) => v.guest_name && v.guest_email, {
    message: "Enter your name and email.",
    path: ["guest_name"],
  });

export async function bookClass(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the form.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const cls = await prisma.gymClass.findUnique({
    where: { id: d.class_id },
    include: { gym: true },
  });
  if (!cls) return { ok: false, message: "Class not found." };
  const taken = await prisma.classBooking.count({
    where: {
      classId: d.class_id,
      bookedForDate: d.booked_for_date,
      status: { not: "cancelled" },
    },
  });
  if (taken >= cls.capacity) {
    return { ok: false, message: "This class is full for that date." };
  }
  await prisma.classBooking.create({
    data: {
      classId: d.class_id,
      guestName: d.guest_name ?? "",
      guestEmail: d.guest_email ?? "",
      bookedForDate: d.booked_for_date,
    },
  });
  if (cls.gym.contactEmail) {
    await sendMail({
      to: cls.gym.contactEmail,
      subject: `New class booking: ${cls.title}`,
      body: `A new booking has been placed for ${cls.title} on ${d.booked_for_date} at ${cls.gym.name}.`,
      category: "class_booking",
    });
  }
  return {
    ok: true,
    message: cls.revolutUrl
      ? `Booking saved. Complete payment at ${cls.revolutUrl}`
      : "Booking saved. Pay the gym directly to confirm your place.",
  };
}

// -------- FIGHTER REGISTRATION -------------------------------------------
import { hashPassword } from "@/lib/password";

const CLASS_CODES = ["J", "N", "L", "C", "B", "A"] as const;
const registerSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  class_code: z.enum(CLASS_CODES),
  martial_art: z.string().min(1).max(120),
  country: z.string().min(1).max(60),
  // Declared career record. Admin reviews; verified counts come from recorded bouts.
  wins: z.coerce.number().int().min(0).max(999).optional().default(0),
  losses: z.coerce.number().int().min(0).max(999).optional().default(0),
  draws: z.coerce.number().int().min(0).max(999).optional().default(0),
  record_note: z.string().max(2000).optional().default(""),
});

export async function registerFighter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the form.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();
  const existing = await prisma.portalUser.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, message: "An account with that email already exists." };
  }
  const { salt, hash } = hashPassword(d.password);
  const name = `${d.first_name} ${d.last_name}`.trim();
  await prisma.$transaction(async (tx) => {
    const user = await tx.portalUser.create({
      data: { email, name, role: "fighter", salt, passwordHash: hash },
    });
    const athlete = await tx.athlete.create({
      data: {
        name,
        division: "Featherweight",
        country: d.country,
        classCode: d.class_code,
        martialArt: d.martial_art,
        wins: d.wins ?? 0,
        losses: d.losses ?? 0,
        draws: d.draws ?? 0,
        isSample: 0,
      },
    });
    await tx.fighterProfile.create({
      data: {
        athleteId: athlete.id,
        userId: user.id,
        approvalStatus: "pending_approval",
        legacyMember: 0,
        createdById: user.id,
        reviewNote: d.record_note
          ? `Declared record note: ${d.record_note}`
          : "",
      },
    });
    await tx.applicationAudit.create({
      data: {
        athleteId: athlete.id,
        actorId: user.id,
        action: "submitted",
        note: `Declared record ${d.wins ?? 0}-${d.losses ?? 0}-${d.draws ?? 0}. ${d.record_note ?? ""}`.trim(),
      },
    });
  });
  await sendMail({
    to: ADMIN_INBOX,
    subject: `New fighter signup: ${name}`,
    body: `${name} <${email}> has registered.\nClass: ${d.class_code}\nDiscipline: ${d.martial_art}\nDeclared record: ${d.wins ?? 0}-${d.losses ?? 0}-${d.draws ?? 0}${d.record_note ? `\nRecord notes: ${d.record_note}` : ""}\n\nReview in the admin portal.`,
    category: "fighter_signup",
  });
  return {
    ok: true,
    message:
      "Your application has been submitted. You'll receive an email when an administrator reviews it.",
  };
}
