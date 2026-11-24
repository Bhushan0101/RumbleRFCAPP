"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MARTIAL_ARTS,
  classesForMartialArt,
  martialArtRequiresClass,
} from "@/lib/martial-arts";
import { isValidDivision } from "@/lib/divisions";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  return session.user;
}

/** Allow admin OR ranking_admin — used for fight-day result updates. */
async function requireRankingAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "ranking_admin") throw new Error("Forbidden");
  return session!.user;
}

const MARTIAL_ART_IDS = MARTIAL_ARTS.map((m) => m.id) as [string, ...string[]];
const GENDER_IDS = ["", "male", "female"] as const;

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
  .transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw);
      return z.array(disciplineRowSchema).parse(parsed);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid disciplines payload.",
      });
      return z.NEVER;
    }
  });

const fighterEditSchema = z
  .object({
    athlete_id: z.coerce.number().int().positive(),
    name: z.string().min(1).max(120),
    nickname: z.string().max(120).optional().default(""),
    gender: z.enum(GENDER_IDS).optional().default(""),
    disciplines: disciplinesSchema,
    division: z.string().max(120).optional().default(""),
    country: z.string().max(60).optional().default(""),
    biography: z.string().max(4000).optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (d.disciplines.length === 0) return; // allow clearing all for admin (unusual but OK)
    let primaryCount = 0;
    const seen = new Set<string>();
    for (const [i, row] of d.disciplines.entries()) {
      if (seen.has(row.martial_art)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["disciplines", i, "martial_art"],
          message: "Duplicate discipline.",
        });
      }
      seen.add(row.martial_art);
      if (row.is_primary) primaryCount++;
      if (martialArtRequiresClass(row.martial_art) && row.class_code) {
        const allowed = classesForMartialArt(row.martial_art).map((c) => c.id);
        if (!allowed.includes(row.class_code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["disciplines", i, "class_code"],
            message: "Class is not valid for this discipline.",
          });
        }
      }
    }
    if (primaryCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disciplines"],
        message: "Exactly one discipline must be primary.",
      });
    }
    const primary = d.disciplines.find((r) => r.is_primary) ?? d.disciplines[0];
    if (d.division && primary && !isValidDivision(d.gender, primary.martial_art, d.division)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["division"],
        message: "Not a valid division for this gender and primary discipline.",
      });
    }
  });

export async function updateFighter(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = fighterEditSchema.parse(Object.fromEntries(formData));
  const primary = parsed.disciplines.find((r) => r.is_primary) ?? parsed.disciplines[0];
  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: parsed.athlete_id },
      data: {
        name: parsed.name,
        nickname: parsed.nickname,
        gender: parsed.gender,
        martialArt: primary?.martial_art ?? "",
        classCode: primary?.class_code || null,
        division: parsed.division,
        country: parsed.country,
        biography: parsed.biography,
        wins: primary?.wins ?? 0,
        losses: primary?.losses ?? 0,
        draws: primary?.draws ?? 0,
      },
    });
    await tx.athleteDiscipline.deleteMany({ where: { athleteId: parsed.athlete_id } });
    if (parsed.disciplines.length > 0) {
      await tx.athleteDiscipline.createMany({
        data: parsed.disciplines.map((r) => ({
          athleteId: parsed.athlete_id,
          martialArt: r.martial_art,
          classCode: r.class_code || null,
          wins: r.wins ?? 0,
          losses: r.losses ?? 0,
          draws: r.draws ?? 0,
          isPrimary: r.is_primary ? 1 : 0,
        })),
      });
    }
    await tx.applicationAudit.create({
      data: {
        athleteId: parsed.athlete_id,
        actorId: Number(admin.id),
        action: "profile_updated",
        note: `by admin: ${admin.name}`,
      },
    });
    // Keep the linked portal user name in sync if any.
    const profile = await tx.fighterProfile.findUnique({
      where: { athleteId: parsed.athlete_id },
      select: { userId: true },
    });
    if (profile?.userId) {
      await tx.portalUser.update({
        where: { id: profile.userId },
        data: { name: parsed.name },
      });
    }
  });
  revalidatePath("/portal/admin/fighters");
  revalidatePath(`/fighters/${parsed.athlete_id}`);
  revalidatePath("/");
}

// -------- Rankings -------------------------------------------------------
const rankingSchema = z.object({
  athlete_id: z.coerce.number().int().positive(),
  division: z.string().min(1).max(120),
  position: z.coerce.number().int().min(0).max(999),
});

export async function setRanking(formData: FormData) {
  await requireRankingAccess();
  const parsed = rankingSchema.parse(Object.fromEntries(formData));
  if (parsed.position === 0) {
    // Remove from division.
    await prisma.ranking.deleteMany({
      where: {
        athleteId: parsed.athlete_id,
        division: parsed.division,
      },
    });
  } else {
    await prisma.ranking.upsert({
      where: {
        athleteId_division: {
          athleteId: parsed.athlete_id,
          division: parsed.division,
        },
      },
      update: { position: parsed.position },
      create: {
        athleteId: parsed.athlete_id,
        division: parsed.division,
        position: parsed.position,
      },
    });
  }
  // Compact positions (keep them 1..n with no gaps).
  const all = await prisma.ranking.findMany({
    where: { division: parsed.division },
    orderBy: { position: "asc" },
  });
  await prisma.$transaction(
    all.map((r, i) =>
      prisma.ranking.update({
        where: { id: r.id },
        data: { position: i + 1 },
      }),
    ),
  );
  revalidatePath("/portal/admin/rankings");
  revalidatePath("/portal/ranking/rankings");
  revalidatePath("/rankings");
  revalidatePath("/");
}

// -------- Events ---------------------------------------------------------
const eventSchema = z.object({
  id: z.coerce.number().int().optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional().default(""),
  starts_at: z.string().max(40).optional().default(""),
  venue: z.string().max(200).optional().default(""),
  city: z.string().max(120).optional().default(""),
  description: z.string().max(4000).optional().default(""),
  status: z.enum(["Upcoming", "Live", "Past"]).default("Upcoming"),
});

export async function saveEvent(formData: FormData) {
  await requireAdmin();
  const parsed = eventSchema.parse(Object.fromEntries(formData));
  if (parsed.id) {
    await prisma.event.update({
      where: { id: parsed.id },
      data: {
        title: parsed.title,
        subtitle: parsed.subtitle,
        startsAt: parsed.starts_at,
        venue: parsed.venue,
        city: parsed.city,
        description: parsed.description,
        status: parsed.status,
      },
    });
  } else {
    await prisma.event.create({
      data: {
        title: parsed.title,
        subtitle: parsed.subtitle,
        startsAt: parsed.starts_at,
        venue: parsed.venue,
        city: parsed.city,
        description: parsed.description,
        status: parsed.status,
      },
    });
  }
  revalidatePath("/portal/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
}

export async function deleteEvent(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  await prisma.event.delete({ where: { id } });
  revalidatePath("/portal/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
}

// -------- Bout result (updates athlete record atomically) ----------------
const boutResultSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  red_id: z.coerce.number().int().positive(),
  blue_id: z.coerce.number().int().positive(),
  outcome: z.enum(["red", "blue", "draw"]),
  method: z.string().max(60).optional().default(""),
  round: z.coerce.number().int().min(1).max(20).optional(),
  time: z.string().max(10).optional().default(""),
});

export async function recordBoutResult(formData: FormData) {
  const admin = await requireAdmin();
  const d = boutResultSchema.parse(Object.fromEntries(formData));
  if (d.red_id === d.blue_id) throw new Error("A fighter can't face themselves.");
  await prisma.$transaction(async (tx) => {
    const bout = await tx.bout.create({
      data: {
        eventId: d.event_id,
        redAthleteId: d.red_id,
        blueAthleteId: d.blue_id,
        boutOrder: 1,
        cardSection: "Main",
        resultMethod: d.method,
        resultRound: d.round ?? null,
        resultTime: d.time,
        winnerId:
          d.outcome === "red"
            ? d.red_id
            : d.outcome === "blue"
              ? d.blue_id
              : null,
      },
    });
    await tx.boutResult.create({
      data: {
        boutId: bout.id,
        outcome: d.outcome,
        updatedBy: Number(admin.id),
      },
    });
    if (d.outcome === "red") {
      await tx.athlete.update({ where: { id: d.red_id }, data: { wins: { increment: 1 } } });
      await tx.athlete.update({ where: { id: d.blue_id }, data: { losses: { increment: 1 } } });
    } else if (d.outcome === "blue") {
      await tx.athlete.update({ where: { id: d.blue_id }, data: { wins: { increment: 1 } } });
      await tx.athlete.update({ where: { id: d.red_id }, data: { losses: { increment: 1 } } });
    } else {
      await tx.athlete.update({ where: { id: d.red_id }, data: { draws: { increment: 1 } } });
      await tx.athlete.update({ where: { id: d.blue_id }, data: { draws: { increment: 1 } } });
    }
  });
  revalidatePath("/portal/admin/events");
  revalidatePath("/");
}
