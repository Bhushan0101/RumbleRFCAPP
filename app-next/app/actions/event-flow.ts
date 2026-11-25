"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, MAIL_ADMIN, SITE_URL } from "@/lib/mail";

export type EventFlowState = { ok: boolean; message: string };

// --------- Fighter self-register interest in an event --------------------
const interestSchema = z.object({
  event_id: z.coerce.number().int().positive(),
});

export async function registerEventInterest(
  _prev: EventFlowState,
  formData: FormData,
): Promise<EventFlowState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Sign in to register your interest." };
  }
  const parsed = interestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid event." };
  const { event_id } = parsed.data;

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: Number(session.user.id) },
    include: { athlete: true },
  });
  if (!profile) {
    return { ok: false, message: "Only approved fighters can register interest." };
  }
  if (profile.approvalStatus !== "approved") {
    return { ok: false, message: "Your profile must be approved first." };
  }
  const ev = await prisma.event.findUnique({ where: { id: event_id } });
  if (!ev) return { ok: false, message: "Event not found." };
  if (ev.status === "Past") {
    return { ok: false, message: "This event is already in the past." };
  }

  // Upsert — if the fighter has been offered or already accepted, we don't
  // demote them back to "interested".
  const existing = await prisma.eventRegistration.findUnique({
    where: {
      eventId_athleteId: {
        eventId: event_id,
        athleteId: profile.athleteId,
      },
    },
  });
  if (existing && existing.status !== "interested" && existing.status !== "declined") {
    return {
      ok: true,
      message: "You're already on this event's list.",
    };
  }

  if (existing) {
    await prisma.eventRegistration.update({
      where: { id: existing.id },
      data: {
        status: "interested",
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.eventRegistration.create({
      data: {
        eventId: event_id,
        athleteId: profile.athleteId,
        addedById: Number(session.user.id),
        status: "interested",
      },
    });
  }

  await sendMail({
    to: MAIL_ADMIN,
    subject: `Fighter interest: ${profile.athlete.name} → ${ev.title}`,
    body:
      `${profile.athlete.name} has registered interest in ${ev.title}` +
      `${ev.startsAt ? ` (${ev.startsAt})` : ""}.\n\n` +
      `Open the event in the admin portal to offer a bout.\n` +
      `${SITE_URL}/portal/admin/events`,
    category: "fighter_signup",
  });

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/portal/admin/events");
  return {
    ok: true,
    message: "Thanks — the W.U.C.O admin has been notified of your interest.",
  };
}

// --------- Admin offers a bout to an interested fighter ------------------
const offerSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  athlete_id: z.coerce.number().int().positive(),
  offer_opponent: z.string().max(200).optional().default(""),
  offer_division: z.string().max(120).optional().default(""),
  offer_section: z.string().max(60).optional().default(""),
  offer_note: z.string().max(2000).optional().default(""),
});

export async function offerBout(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  const d = offerSchema.parse(Object.fromEntries(formData));

  const ev = await prisma.event.findUnique({ where: { id: d.event_id } });
  if (!ev) throw new Error("Event not found.");
  const athlete = await prisma.athlete.findUnique({
    where: { id: d.athlete_id },
    include: { profile: { include: { user: true } } },
  });
  if (!athlete) throw new Error("Fighter not found.");

  const now = new Date();
  await prisma.eventRegistration.upsert({
    where: {
      eventId_athleteId: {
        eventId: d.event_id,
        athleteId: d.athlete_id,
      },
    },
    update: {
      status: "offered",
      offerOpponent: d.offer_opponent,
      offerDivision: d.offer_division,
      offerSection: d.offer_section,
      offerNote: d.offer_note,
      offerSentAt: now,
      respondedAt: null,
      updatedAt: now,
    },
    create: {
      eventId: d.event_id,
      athleteId: d.athlete_id,
      addedById: Number(session.user.id),
      status: "offered",
      offerOpponent: d.offer_opponent,
      offerDivision: d.offer_division,
      offerSection: d.offer_section,
      offerNote: d.offer_note,
      offerSentAt: now,
    },
  });

  // In-app notification + email.
  if (athlete.profile?.user) {
    const link = `/events/${d.event_id}`;
    await prisma.notification.create({
      data: {
        userId: athlete.profile.user.id,
        kind: "bout_offered",
        title: `Bout offered for ${ev.title}`,
        body: [
          d.offer_opponent ? `Opponent: ${d.offer_opponent}` : "",
          d.offer_division ? `Division: ${d.offer_division}` : "",
          d.offer_section ? `Section: ${d.offer_section}` : "",
          d.offer_note ? `Note: ${d.offer_note}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        link,
      },
    });
    await sendMail({
      to: athlete.profile.user.email,
      subject: `W.U.C.O: bout offered for ${ev.title}`,
      body:
        `Hi ${athlete.name},\n\n` +
        `A W.U.C.O admin has offered you a bout at ${ev.title}` +
        `${ev.startsAt ? ` (${ev.startsAt})` : ""}.\n\n` +
        (d.offer_opponent ? `Opponent: ${d.offer_opponent}\n` : "") +
        (d.offer_division ? `Division: ${d.offer_division}\n` : "") +
        (d.offer_section ? `Section: ${d.offer_section}\n` : "") +
        (d.offer_note ? `\n${d.offer_note}\n` : "") +
        `\nAccept or decline from the event page:\n${SITE_URL}${link}\n\n— W.U.C.O Ireland`,
      category: "fighter_signup",
    });
  }

  revalidatePath("/portal/admin/events");
  revalidatePath(`/events/${d.event_id}`);
}

// --------- Fighter accepts / declines the offer --------------------------
const respondSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  decision: z.enum(["accept", "decline"]),
});

export async function respondToBoutOffer(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  const d = respondSchema.parse(Object.fromEntries(formData));

  const profile = await prisma.fighterProfile.findFirst({
    where: { userId: Number(session.user.id) },
    include: { athlete: true },
  });
  if (!profile) throw new Error("Fighter profile not found.");

  const reg = await prisma.eventRegistration.findUnique({
    where: {
      eventId_athleteId: {
        eventId: d.event_id,
        athleteId: profile.athleteId,
      },
    },
    include: { event: true },
  });
  if (!reg || reg.status !== "offered") {
    throw new Error("No open bout offer to respond to.");
  }

  const newStatus = d.decision === "accept" ? "accepted" : "declined";
  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: { status: newStatus, respondedAt: new Date() },
  });

  // Notify admin.
  await sendMail({
    to: MAIL_ADMIN,
    subject: `Bout ${newStatus}: ${profile.athlete.name} → ${reg.event.title}`,
    body:
      `${profile.athlete.name} has ${newStatus} the bout offer for ${reg.event.title}.\n\n` +
      (reg.offerOpponent ? `Opponent: ${reg.offerOpponent}\n` : "") +
      (reg.offerDivision ? `Division: ${reg.offerDivision}\n` : "") +
      (reg.offerSection ? `Section: ${reg.offerSection}\n` : "") +
      `\nManage the event: ${SITE_URL}/portal/admin/events`,
    category: "fighter_signup",
  });

  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/portal/admin/events");
  redirect(`/events/${d.event_id}`);
}
