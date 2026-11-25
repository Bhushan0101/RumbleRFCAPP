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
  return_to: z.string().max(400).optional().default(""),
});

export async function setRanking(formData: FormData) {
  await requireRankingAccess();
  const parsed = rankingSchema.parse(Object.fromEntries(formData));

  // Capture the prior position (if any) so we only email on new or changed
  // assignments — not on a no-op save.
  const prior = await prisma.ranking.findUnique({
    where: {
      athleteId_division: {
        athleteId: parsed.athlete_id,
        division: parsed.division,
      },
    },
  });

  // Fighters evicted by this change — their position is vacated so no two
  // athletes share a rank.
  const vacatedNames: string[] = [];

  if (parsed.position === 0) {
    // Explicit removal from the division.
    await prisma.ranking.deleteMany({
      where: {
        athleteId: parsed.athlete_id,
        division: parsed.division,
      },
    });
  } else {
    // If someone else currently holds the target position, vacate them first
    // so we never end up with two fighters on the same rank.
    const conflict = await prisma.ranking.findFirst({
      where: {
        division: parsed.division,
        position: parsed.position,
        athleteId: { not: parsed.athlete_id },
      },
      include: { athlete: true },
    });
    if (conflict) {
      await prisma.ranking.delete({ where: { id: conflict.id } });
      vacatedNames.push(conflict.athlete.name);
    }

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

  // DO NOT compact positions — the admin wants intentional gaps when a
  // fighter is bumped out. Blank slots are surfaced via the vacated banner
  // and the admin re-fills them explicitly.

  // Notify the fighter whenever their position changes to a non-zero rank.
  if (parsed.position > 0 && prior?.position !== parsed.position) {
    const finalRow = await prisma.ranking.findUnique({
      where: {
        athleteId_division: {
          athleteId: parsed.athlete_id,
          division: parsed.division,
        },
      },
    });
    if (finalRow) {
      const athlete = await prisma.athlete.findUnique({
        where: { id: parsed.athlete_id },
        include: {
          passport: true,
          profile: { include: { user: true } },
        },
      });
      if (athlete?.profile?.user?.email) {
        const { sendMail, SITE_URL } = await import("@/lib/mail");
        const { divisionDisplayName } = await import("@/lib/divisions");
        const fighterNo = athlete.passport?.fighterNo;
        const divisionName =
          divisionDisplayName(athlete.gender, parsed.division) || parsed.division;
        const passportLine = fighterNo
          ? `\nYour passport (now showing your ranking): ${SITE_URL}/passport/${fighterNo}\n`
          : "";
        const action = prior ? "updated" : "allotted";
        await sendMail({
          to: athlete.profile.user.email,
          subject: `W.U.C.O: your ranking has been ${action}`,
          body:
            `Hi ${athlete.name},\n\n` +
            `Your official W.U.C.O ranking has been ${action}.\n\n` +
            `Division: ${divisionName}\n` +
            `Position: #${finalRow.position}\n` +
            passportLine +
            `\n— W.U.C.O Ireland`,
          category: "fighter_ranked",
        });
      }
    }
  }

  // Notify anyone evicted by this change — they need to know their previous
  // position is now vacant.
  for (const name of vacatedNames) {
    const evicted = await prisma.athlete.findFirst({
      where: { name },
      include: { profile: { include: { user: true } } },
    });
    if (evicted?.profile?.user?.email) {
      const { sendMail } = await import("@/lib/mail");
      const { divisionDisplayName } = await import("@/lib/divisions");
      const divisionName =
        divisionDisplayName(evicted.gender, parsed.division) || parsed.division;
      await sendMail({
        to: evicted.profile.user.email,
        subject: "W.U.C.O: your ranking has been vacated",
        body:
          `Hi ${evicted.name},\n\n` +
          `A W.U.C.O admin has reassigned your previous position in ${divisionName}. ` +
          `You are currently unranked in this division while the admin reviews the standings. ` +
          `We'll email you again when a position is allotted.\n\n— W.U.C.O Ireland`,
        category: "fighter_ranked",
      });
    }
  }

  revalidatePath("/portal/admin/rankings");
  revalidatePath("/portal/ranking/rankings");
  revalidatePath("/rankings");
  revalidatePath("/");

  // Preserve the filtered admin view and surface vacancies in a banner.
  if (parsed.return_to) {
    const sep = parsed.return_to.includes("?") ? "&" : "?";
    const suffix = vacatedNames.length
      ? `${sep}vacated=${encodeURIComponent(vacatedNames.join(", "))}`
      : "";
    const { redirect } = await import("next/navigation");
    redirect(`${parsed.return_to}${suffix}`);
  }
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
  // Optional "clear this" flag for the cover photo — set to "1" when the
  // admin ticks the "remove cover" checkbox.
  remove_poster: z.string().optional().default(""),
});

const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_POSTER_BYTES = 5 * 1024 * 1024; // 5 MB

export async function saveEvent(formData: FormData) {
  await requireAdmin();
  // Pull the file side-channel first, then strip it before the zod parse
  // (zod + Object.fromEntries would swallow File values anyway).
  const posterFile = formData.get("poster");
  const entries = Object.fromEntries(formData);
  delete (entries as Record<string, unknown>).poster;
  const parsed = eventSchema.parse(entries);

  // Handle the poster upload — writes to public/uploads/events/.
  // We need the event id before writing the file (so the filename is stable);
  // on create we run the DB write first, then the upload, then persist the URL.
  let posterUrl: string | null | undefined; // undefined = don't touch
  if (parsed.remove_poster === "1") {
    posterUrl = null;
  }

  let eventId = parsed.id ?? 0;

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
        ...(posterUrl === null ? { posterUrl: null } : {}),
      },
    });
  } else {
    const created = await prisma.event.create({
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
    eventId = created.id;
  }

  if (posterFile instanceof File && posterFile.size > 0) {
    if (!ALLOWED_POSTER_TYPES.includes(posterFile.type)) {
      throw new Error("Cover photo must be JPG, PNG, WEBP or GIF.");
    }
    if (posterFile.size > MAX_POSTER_BYTES) {
      throw new Error("Cover photo is larger than 5 MB.");
    }
    const ext =
      posterFile.type === "image/png"
        ? "png"
        : posterFile.type === "image/webp"
          ? "webp"
          : posterFile.type === "image/gif"
            ? "gif"
            : "jpg";
    const name = `${eventId}-${Date.now()}.${ext}`;
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "public", "uploads", "events");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await posterFile.arrayBuffer());
    await writeFile(join(dir, name), buf);
    posterUrl = `/uploads/events/${name}`;
    await prisma.event.update({
      where: { id: eventId },
      data: { posterUrl },
    });
  }

  revalidatePath("/portal/admin/events");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
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
  round: z
    .preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().int().min(1).max(20).optional(),
    ),
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
  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/events");
  revalidatePath(`/fighters/${d.red_id}`);
  revalidatePath(`/fighters/${d.blue_id}`);
  revalidatePath("/fighters");
  revalidatePath("/rankings");
  revalidatePath("/");
}

// -------- Bout (scheduling, no result yet) -------------------------------
const addBoutSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  red_id: z.coerce.number().int().positive(),
  blue_id: z.coerce.number().int().positive(),
  bout_order: z.preprocess(
    (v) => (v === "" || v == null ? 1 : Number(v)),
    z.number().int().min(1).max(999),
  ),
  card_section: z.string().max(40).optional().default("Main"),
  division: z.string().max(120).optional().default(""),
});

export async function addBout(formData: FormData) {
  await requireAdmin();
  const d = addBoutSchema.parse(Object.fromEntries(formData));
  if (d.red_id === d.blue_id) throw new Error("A fighter can't face themselves.");
  await prisma.bout.create({
    data: {
      eventId: d.event_id,
      redAthleteId: d.red_id,
      blueAthleteId: d.blue_id,
      boutOrder: d.bout_order,
      cardSection: d.card_section || "Main",
      division: d.division || null,
    },
  });
  revalidatePath("/portal/admin/events");
  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/events");
  revalidatePath("/");
}

export async function deleteBout(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id) return;
  // If a result was already recorded we DO NOT want to silently rewind athlete
  // records — refuse the delete so the admin reverses the result explicitly.
  const bout = await prisma.bout.findUnique({
    where: { id },
    include: { result: true, event: true },
  });
  if (!bout) return;
  if (bout.result) {
    throw new Error("Can't delete a bout with a recorded result. Clear the result first.");
  }
  await prisma.bout.delete({ where: { id } });
  revalidatePath("/portal/admin/events");
  if (bout.eventId) {
    revalidatePath(`/events/${bout.eventId}`);
  }
  revalidatePath("/events");
}
