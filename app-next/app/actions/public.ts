"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail, MAIL_ADMIN, buildSubmissionHtml } from "@/lib/mail";

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
    to: MAIL_ADMIN,
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
import {
  MARTIAL_ARTS,
  classesForMartialArt,
  martialArtRequiresClass,
  martialArtName,
  classDisplayName,
} from "@/lib/martial-arts";
import { isValidDivision, divisionDisplayName } from "@/lib/divisions";
import { isValidCountryName } from "@/lib/countries";

const MARTIAL_ART_IDS = MARTIAL_ARTS.map((m) => m.id) as [string, ...string[]];

const disciplineRowSchema = z.object({
  martial_art: z.enum(MARTIAL_ART_IDS),
  class_code: z.string().max(40).optional().default(""),
  wins: z.coerce.number().int().min(0).max(999).optional().default(0),
  losses: z.coerce.number().int().min(0).max(999).optional().default(0),
  draws: z.coerce.number().int().min(0).max(999).optional().default(0),
  is_primary: z.boolean().optional().default(false),
});

const disciplinesSchema = z
  .string()
  .min(1, "Pick at least one discipline.")
  .transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw);
      return z.array(disciplineRowSchema).min(1).parse(parsed);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick at least one discipline.",
      });
      return z.NEVER;
    }
  });

const registerSchema = z
  .object({
    first_name: z.string().min(1).max(120),
    last_name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: z.string().min(10).max(128),
    gender: z.enum(["male", "female"]),
    disciplines: disciplinesSchema,
    // Gender-prefixed division id ("M-57kg", "F-55kg", "MMA-Lightweight").
    division: z.string().min(1).max(120),
    country: z.string().min(1).max(60),
    // Optional ISO yyyy-mm-dd. Admin may use for J-Class eligibility.
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    // Club picker: either an existing Gym id (as a stringified int) or the
    // literal "new" when the fighter types a name we don't have yet.
    gym_choice: z.string().min(1, "Pick your gym."),
    gym_name_new: z.string().max(200).optional().default(""),
    coach_name: z.string().min(1, "Enter your coach's name.").max(200),
    // Required acknowledgements from the review step. Checkbox value is "on"
    // when ticked, missing otherwise — a mismatch makes the whole submit fail.
    accept_terms: z.literal("on", { message: "You must agree to the Terms & Conditions." }),
    accept_privacy: z.literal("on", { message: "You must acknowledge the Privacy Policy." }),
    accept_accuracy: z.literal("on", { message: "You must confirm the information is accurate." }),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    let primaryCount = 0;
    for (const [i, row] of data.disciplines.entries()) {
      if (seen.has(row.martial_art)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["disciplines", i, "martial_art"],
          message: "Duplicate discipline.",
        });
      }
      seen.add(row.martial_art);
      if (row.is_primary) primaryCount += 1;
      if (martialArtRequiresClass(row.martial_art)) {
        const allowed = classesForMartialArt(row.martial_art).map((c) => c.id);
        if (!row.class_code) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["disciplines", i, "class_code"],
            message: "Choose a class.",
          });
        } else if (!allowed.includes(row.class_code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["disciplines", i, "class_code"],
            message: "Not a valid class for this discipline.",
          });
        }
      }
    }
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disciplines"],
        message: "Mark exactly one discipline as primary.",
      });
    }
    const primary = data.disciplines.find((r) => r.is_primary) ?? data.disciplines[0];
    if (primary && !isValidDivision(data.gender, primary.martial_art, data.division)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["division"],
        message: "Not a valid weight division for this gender and primary discipline.",
      });
    }
    if (!isValidCountryName(data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["country"],
        message: "Pick a country from the list.",
      });
    }
    // Club picker: either an int gym id or the sentinel "new" with a name.
    if (data.gym_choice !== "new" && !/^\d+$/.test(data.gym_choice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gym_choice"],
        message: "Pick your gym from the list.",
      });
    }
    if (data.gym_choice === "new" && !data.gym_name_new.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gym_name_new"],
        message: "Type your gym's name.",
      });
    }
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
  // Resolve club picker to an existing Gym row (if any). Picker is either an
  // int id of an active gym, or the sentinel "new" with gym_name_new text.
  let selectedGymId: number | null = null;
  let selectedGymName = "";
  if (d.gym_choice !== "new") {
    const gymId = Number(d.gym_choice);
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, status: "active" },
      select: { id: true, name: true },
    });
    if (!gym) {
      return {
        ok: false,
        message: "Please correct the form.",
        errors: { gym_choice: ["Pick your gym from the list."] },
      };
    }
    selectedGymId = gym.id;
    selectedGymName = gym.name;
  } else {
    selectedGymName = d.gym_name_new.trim();
  }
  const { salt, hash } = await hashPassword(d.password);
  const name = `${d.first_name} ${d.last_name}`.trim();
  const primary = d.disciplines.find((r) => r.is_primary) ?? d.disciplines[0];
  const primaryWins = primary.wins ?? 0;
  const primaryLosses = primary.losses ?? 0;
  const primaryDraws = primary.draws ?? 0;
  let newAthleteId = 0;
  await prisma.$transaction(async (tx) => {
    const user = await tx.portalUser.create({
      data: { email, name, role: "fighter", salt, passwordHash: hash },
    });
    const athlete = await tx.athlete.create({
      data: {
        name,
        gender: d.gender,
        division: d.division,
        country: d.country,
        classCode: primary.class_code,
        martialArt: primary.martial_art,
        dateOfBirth: d.date_of_birth || "",
        wins: primaryWins,
        losses: primaryLosses,
        draws: primaryDraws,
        declaredWins: primaryWins,
        declaredLosses: primaryLosses,
        declaredDraws: primaryDraws,
        isSample: 0,
      },
    });
    newAthleteId = athlete.id;
    await tx.athleteDiscipline.createMany({
      data: d.disciplines.map((row) => ({
        athleteId: athlete.id,
        martialArt: row.martial_art,
        classCode: row.class_code || null,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        draws: row.draws ?? 0,
        isPrimary: row.is_primary ? 1 : 0,
      })),
    });
    await tx.fighterProfile.create({
      data: {
        athleteId: athlete.id,
        userId: user.id,
        approvalStatus: "pending_approval",
        legacyMember: 0,
        createdById: user.id,
        reviewNote: [
          `Gym: ${selectedGymName}${selectedGymId ? ` (#${selectedGymId})` : " (not on WUCO yet)"}`,
          `Coach: ${d.coach_name}`,
        ].join(" · "),
      },
    });
    const auditLines = d.disciplines
      .map(
        (r) =>
          `${martialArtName(r.martial_art)}${r.is_primary ? " (primary)" : ""}: ${r.wins ?? 0}-${r.losses ?? 0}-${r.draws ?? 0}`,
      )
      .join("; ");
    await tx.applicationAudit.create({
      data: {
        athleteId: athlete.id,
        actorId: user.id,
        action: "submitted",
        note: `Declared records → ${auditLines}. Gym: ${selectedGymName}. Coach: ${d.coach_name}.`.trim(),
      },
    });
    // If they picked an existing WUCO club, queue a join request now so the
    // club admin sees it immediately after we approve the fighter.
    if (selectedGymId) {
      await tx.gymJoinRequest.upsert({
        where: {
          gymId_userId: { gymId: selectedGymId, userId: user.id },
        },
        update: { status: "pending", reviewNote: "Selected at registration" },
        create: {
          gymId: selectedGymId,
          userId: user.id,
          status: "pending",
          reviewNote: "Selected at registration",
        },
      });
    }
  });
  void newAthleteId;
  const divisionName = divisionDisplayName(d.gender, d.division);
  const disciplineLines = d.disciplines
    .map((r) => {
      const art = martialArtName(r.martial_art);
      const cls = r.class_code ? ` (${classDisplayName(r.martial_art, r.class_code)})` : "";
      const rec = `${r.wins ?? 0}-${r.losses ?? 0}-${r.draws ?? 0}`;
      const tag = r.is_primary ? " [PRIMARY]" : "";
      return `  • ${art}${cls}: ${rec}${tag}`;
    })
    .join("\n");

  await sendMail({
    to: MAIL_ADMIN,
    subject: `New fighter signup: ${name}`,
    body: `${name} <${email}> has registered.\nGym: ${selectedGymName}${selectedGymId ? "" : " (not on WUCO yet — follow up)"}\nCoach: ${d.coach_name}\nDivision: ${divisionName}\nDisciplines:\n${disciplineLines}\n\nReview in the admin portal.`,
    category: "fighter_signup",
  });
  await sendMail({
    to: email,
    subject: "W.U.C.O: your fighter application was received",
    body: `Hi ${name},\n\nThanks — your W.U.C.O fighter application is in.\n\nDivision: ${divisionName}\nDisciplines:\n${disciplineLines}\n\nA W.U.C.O admin will review your application and get back to you by email.\n\n— W.U.C.O Ireland`,
    html: buildSubmissionHtml({
      name,
      division: divisionName,
      disciplines: d.disciplines.map((r) => ({
        name: martialArtName(r.martial_art),
        className: r.class_code ? classDisplayName(r.martial_art, r.class_code) : "—",
        record: `${r.wins ?? 0}-${r.losses ?? 0}-${r.draws ?? 0}`,
        isPrimary: !!r.is_primary,
      })),
    }),
    category: "fighter_submitted",
  });
  return {
    ok: true,
    message:
      "Your application has been submitted. You'll receive an email when an administrator reviews it.",
  };
}
