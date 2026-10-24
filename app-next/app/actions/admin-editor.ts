"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

const CLASS_CODES = ["", "J", "N", "L", "C", "B", "A"] as const;

const fighterEditSchema = z.object({
  athlete_id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(120),
  nickname: z.string().max(120).optional().default(""),
  martial_art: z.string().max(120).optional().default(""),
  class_code: z.enum(CLASS_CODES).optional().default(""),
  division: z.string().min(1).max(120),
  country: z.string().max(60).optional().default(""),
  biography: z.string().max(4000).optional().default(""),
  wins: z.coerce.number().int().min(0).max(999),
  losses: z.coerce.number().int().min(0).max(999),
  draws: z.coerce.number().int().min(0).max(999),
});

export async function updateFighter(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = fighterEditSchema.parse(Object.fromEntries(formData));
  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: parsed.athlete_id },
      data: {
        name: parsed.name,
        nickname: parsed.nickname,
        martialArt: parsed.martial_art,
        classCode: parsed.class_code || null,
        division: parsed.division,
        country: parsed.country,
        biography: parsed.biography,
        wins: parsed.wins,
        losses: parsed.losses,
        draws: parsed.draws,
      },
    });
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
