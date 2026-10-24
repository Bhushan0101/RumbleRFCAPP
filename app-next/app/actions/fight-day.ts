"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireRankingAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "ranking_admin") throw new Error("Forbidden");
  return session!.user;
}

// -------- Add a bout to a live/upcoming event -------------------------
const addBoutSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  red_id: z.coerce.number().int().positive(),
  blue_id: z.coerce.number().int().positive(),
  card_section: z.string().max(40).optional().default("Main"),
});

export async function addBout(formData: FormData) {
  await requireRankingAccess();
  const d = addBoutSchema.parse(Object.fromEntries(formData));
  if (d.red_id === d.blue_id) throw new Error("A fighter can't face themselves.");
  const nextOrder = await prisma.bout.count({ where: { eventId: d.event_id } });
  await prisma.bout.create({
    data: {
      eventId: d.event_id,
      redAthleteId: d.red_id,
      blueAthleteId: d.blue_id,
      boutOrder: nextOrder + 1,
      cardSection: d.card_section || "Main",
    },
  });
  revalidatePath("/portal/ranking");
  revalidatePath(`/portal/ranking/events/${d.event_id}`);
  revalidatePath(`/events/${d.event_id}`);
}

// -------- Settle a bout: pick winner, update athletes atomically -----
const settleSchema = z.object({
  bout_id: z.coerce.number().int().positive(),
  outcome: z.enum(["red", "blue", "draw", "no_contest"]),
  method: z.string().max(60).optional().default("Decision"),
  round: z.coerce.number().int().min(1).max(20).optional(),
  time: z.string().max(10).optional().default(""),
});

export async function settleBout(formData: FormData) {
  const actor = await requireRankingAccess();
  const d = settleSchema.parse(Object.fromEntries(formData));

  await prisma.$transaction(async (tx) => {
    const bout = await tx.bout.findUnique({
      where: { id: d.bout_id },
      include: { result: true },
    });
    if (!bout) throw new Error("Bout not found");

    // Reverse any prior result's record impact before applying the new one.
    if (bout.result) {
      const prev = bout.result.outcome;
      if (prev === "red") {
        await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { wins: { decrement: 1 } } });
        await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { losses: { decrement: 1 } } });
      } else if (prev === "blue") {
        await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { wins: { decrement: 1 } } });
        await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { losses: { decrement: 1 } } });
      } else if (prev === "draw") {
        await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { draws: { decrement: 1 } } });
        await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { draws: { decrement: 1 } } });
      }
    }

    const winnerId =
      d.outcome === "red"
        ? bout.redAthleteId
        : d.outcome === "blue"
          ? bout.blueAthleteId
          : null;

    await tx.bout.update({
      where: { id: d.bout_id },
      data: {
        winnerId,
        resultMethod: d.method,
        resultRound: d.round ?? null,
        resultTime: d.time,
      },
    });

    await tx.boutResult.upsert({
      where: { boutId: d.bout_id },
      update: {
        outcome: d.outcome,
        updatedBy: Number(actor.id),
      },
      create: {
        boutId: d.bout_id,
        outcome: d.outcome,
        updatedBy: Number(actor.id),
      },
    });

    if (d.outcome === "red") {
      await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { wins: { increment: 1 } } });
      await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { losses: { increment: 1 } } });
    } else if (d.outcome === "blue") {
      await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { wins: { increment: 1 } } });
      await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { losses: { increment: 1 } } });
    } else if (d.outcome === "draw") {
      await tx.athlete.update({ where: { id: bout.redAthleteId }, data: { draws: { increment: 1 } } });
      await tx.athlete.update({ where: { id: bout.blueAthleteId }, data: { draws: { increment: 1 } } });
    }

    // Audit on both fighters.
    await tx.applicationAudit.createMany({
      data: [
        {
          athleteId: bout.redAthleteId,
          actorId: Number(actor.id),
          action: `bout_${d.outcome}`,
          note: `Bout #${bout.id}: outcome=${d.outcome}`,
        },
        {
          athleteId: bout.blueAthleteId,
          actorId: Number(actor.id),
          action: `bout_${d.outcome}`,
          note: `Bout #${bout.id}: outcome=${d.outcome}`,
        },
      ],
    });
  });

  revalidatePath("/portal/ranking");
  const bout = await prisma.bout.findUnique({
    where: { id: d.bout_id },
    select: { eventId: true },
  });
  if (bout) {
    revalidatePath(`/portal/ranking/events/${bout.eventId}`);
    revalidatePath(`/events/${bout.eventId}`);
  }
  revalidatePath("/");
  revalidatePath("/rankings");
}

// -------- Flip event status Upcoming → Live → Past --------------------
const statusSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  status: z.enum(["Upcoming", "Live", "Past"]),
});

export async function setEventStatus(formData: FormData) {
  await requireRankingAccess();
  const d = statusSchema.parse(Object.fromEntries(formData));
  await prisma.event.update({
    where: { id: d.event_id },
    data: { status: d.status },
  });
  revalidatePath("/portal/ranking");
  revalidatePath(`/portal/ranking/events/${d.event_id}`);
  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/events");
  revalidatePath("/");
}
