"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
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
        raisedByGymId: null,
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
// The opponent must be an existing approved athlete; we create paired
// EventRegistration rows (status=offered) sharing a boutRef so each side's
// accept/decline can be matched up.
const offerSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  athlete_id: z.coerce.number().int().positive(),
  opponent_id: z.coerce.number().int().positive(),
  offer_division: z.string().min(1).max(120),
  offer_section: z.string().max(60).optional().default(""),
  offer_note: z.string().max(2000).optional().default(""),
});

export async function offerBout(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  const d = offerSchema.parse(Object.fromEntries(formData));
  if (d.athlete_id === d.opponent_id) {
    throw new Error("Opponent must be a different fighter.");
  }

  const ev = await prisma.event.findUnique({ where: { id: d.event_id } });
  if (!ev) throw new Error("Event not found.");
  const [athlete, opponent] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: d.athlete_id },
      include: { profile: { include: { user: true } } },
    }),
    prisma.athlete.findUnique({
      where: { id: d.opponent_id },
      include: { profile: { include: { user: true } } },
    }),
  ]);
  if (!athlete) throw new Error("Fighter not found.");
  if (!opponent) throw new Error("Opponent not found.");

  const now = new Date();
  const boutRef = randomUUID();

  // Paired rows so both sides see the same offer and their acceptances can be
  // joined via boutRef at confirm-time.
  for (const [self, other] of [
    [athlete, opponent],
    [opponent, athlete],
  ] as const) {
    await prisma.eventRegistration.upsert({
      where: {
        eventId_athleteId: {
          eventId: d.event_id,
          athleteId: self.id,
        },
      },
      update: {
        status: "offered",
        offerOpponent: other.name,
        offerDivision: d.offer_division,
        offerSection: d.offer_section,
        offerNote: d.offer_note,
        offerSentAt: now,
        respondedAt: null,
        confirmedAt: null,
        boutRef,
        updatedAt: now,
      },
      create: {
        eventId: d.event_id,
        athleteId: self.id,
        addedById: Number(session.user.id),
        status: "offered",
        offerOpponent: other.name,
        offerDivision: d.offer_division,
        offerSection: d.offer_section,
        offerNote: d.offer_note,
        offerSentAt: now,
        boutRef,
      },
    });
  }

  // Notify both fighters: in-app + email.
  for (const self of [athlete, opponent]) {
    const other = self.id === athlete.id ? opponent : athlete;
    if (!self.profile?.user) continue;
    const link = `/events/${d.event_id}`;
    await prisma.notification.create({
      data: {
        userId: self.profile.user.id,
        kind: "bout_offered",
        title: `Bout offered for ${ev.title}`,
        body: [
          `Opponent: ${other.name}`,
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
      to: self.profile.user.email,
      subject: `W.U.C.O: bout offered for ${ev.title}`,
      body:
        `Hi ${self.name},\n\n` +
        `A W.U.C.O admin has offered you a bout at ${ev.title}` +
        `${ev.startsAt ? ` (${ev.startsAt})` : ""}.\n\n` +
        `Opponent: ${other.name}\n` +
        (d.offer_division ? `Division: ${d.offer_division}\n` : "") +
        (d.offer_section ? `Section: ${d.offer_section}\n` : "") +
        (d.offer_note ? `\n${d.offer_note}\n` : "") +
        `\nThe bout is only confirmed once BOTH fighters accept. ` +
        `Accept or decline from the event page:\n${SITE_URL}${link}\n\n— W.U.C.O Ireland`,
      category: "fighter_signup",
    });
  }

  revalidatePath("/portal/admin/events");
  revalidatePath(`/events/${d.event_id}`);
}

// --------- Fighter accepts / declines the offer --------------------------
// Two-sided confirmation: both paired rows must be 'accepted' for status to
// flip to 'confirmed'. On decline, both sides are returned to 'declined' so
// the admin can offer again.
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

  const now = new Date();

  if (d.decision === "decline") {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: "declined", respondedAt: now },
    });
    // Reset the paired side back to 'interested' so admin can offer again.
    if (reg.boutRef) {
      await prisma.eventRegistration.updateMany({
        where: { boutRef: reg.boutRef, id: { not: reg.id } },
        data: {
          status: "interested",
          respondedAt: null,
          offerOpponent: "",
          offerDivision: "",
          offerSection: "",
          offerNote: "",
          offerSentAt: null,
          boutRef: null,
        },
      });
    }
    await sendMail({
      to: MAIL_ADMIN,
      subject: `Bout declined: ${profile.athlete.name} → ${reg.event.title}`,
      body:
        `${profile.athlete.name} has declined the bout offer for ${reg.event.title}.\n\n` +
        (reg.offerOpponent ? `Opponent was: ${reg.offerOpponent}\n` : "") +
        (reg.offerDivision ? `Division: ${reg.offerDivision}\n` : "") +
        `\nManage the event: ${SITE_URL}/portal/admin/events`,
      category: "fighter_signup",
    });
    // Notify admin in-app too.
    const admins = await prisma.portalUser.findMany({
      where: { role: "admin" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: "bout_declined",
          title: `Bout declined: ${profile.athlete.name}`,
          body: `${reg.event.title}${reg.offerOpponent ? ` · opponent was ${reg.offerOpponent}` : ""}`,
          link: "/portal/admin/events",
        })),
      });
    }
    revalidatePath(`/events/${d.event_id}`);
    revalidatePath("/portal/admin/events");
    redirect(`/events/${d.event_id}`);
  }

  // accept → set this side, then check the paired side.
  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: { status: "accepted", respondedAt: now },
  });

  const partner = reg.boutRef
    ? await prisma.eventRegistration.findFirst({
        where: { boutRef: reg.boutRef, id: { not: reg.id } },
        include: { athlete: { include: { profile: { include: { user: true } } } } },
      })
    : null;

  // Both accepted → confirm the bout on both sides.
  if (partner && partner.status === "accepted") {
    await prisma.eventRegistration.updateMany({
      where: { boutRef: reg.boutRef! },
      data: { status: "confirmed", confirmedAt: now },
    });
    // Notify both fighters + admin.
    const notifyUserIds: number[] = [];
    if (profile.userId) notifyUserIds.push(profile.userId);
    if (partner.athlete.profile?.user?.id) {
      notifyUserIds.push(partner.athlete.profile.user.id);
    }
    if (notifyUserIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyUserIds.map((userId) => ({
          userId,
          kind: "bout_confirmed",
          title: `Bout confirmed for ${reg.event.title}`,
          body: `You and your opponent have both accepted — the bout is confirmed.`,
          link: `/events/${d.event_id}`,
        })),
      });
    }
    const admins = await prisma.portalUser.findMany({
      where: { role: "admin" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: "bout_confirmed",
          title: `Bout confirmed: ${profile.athlete.name} vs ${partner.athlete.name}`,
          body: reg.event.title,
          link: "/portal/admin/events",
        })),
      });
    }
    await sendMail({
      to: MAIL_ADMIN,
      subject: `Bout confirmed: ${profile.athlete.name} vs ${partner.athlete.name}`,
      body:
        `Both fighters have accepted. The bout at ${reg.event.title} is confirmed.\n\n` +
        `Manage the event: ${SITE_URL}/portal/admin/events`,
      category: "fighter_signup",
    });
    if (partner.athlete.profile?.user?.email) {
      await sendMail({
        to: partner.athlete.profile.user.email,
        subject: `W.U.C.O: your bout at ${reg.event.title} is confirmed`,
        body:
          `Hi ${partner.athlete.name},\n\n` +
          `${profile.athlete.name} has accepted the bout — you're both confirmed for ${reg.event.title}.\n\n` +
          `— W.U.C.O Ireland`,
        category: "fighter_signup",
      });
    }
    const myEmail = (await prisma.portalUser.findUnique({
      where: { id: profile.userId! },
      select: { email: true },
    }))?.email;
    if (myEmail) {
      await sendMail({
        to: myEmail,
        subject: `W.U.C.O: your bout at ${reg.event.title} is confirmed`,
        body:
          `Hi ${profile.athlete.name},\n\n` +
          `${partner.athlete.name} has also accepted — your bout at ${reg.event.title} is confirmed.\n\n` +
          `— W.U.C.O Ireland`,
        category: "fighter_signup",
      });
    }
  } else {
    // One side accepted, the other hasn't yet.
    await sendMail({
      to: MAIL_ADMIN,
      subject: `Bout accepted (1 of 2): ${profile.athlete.name} → ${reg.event.title}`,
      body:
        `${profile.athlete.name} has accepted the bout. Waiting on the other fighter.\n\n` +
        (reg.offerOpponent ? `Opponent: ${reg.offerOpponent}\n` : "") +
        `\nManage: ${SITE_URL}/portal/admin/events`,
      category: "fighter_signup",
    });
    const admins = await prisma.portalUser.findMany({
      where: { role: "admin" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          kind: "bout_accepted",
          title: `Bout accepted (1 of 2): ${profile.athlete.name}`,
          body: `${reg.event.title} · waiting on the other fighter`,
          link: "/portal/admin/events",
        })),
      });
    }
  }

  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/portal/admin/events");
  redirect(`/events/${d.event_id}`);
}

// --------- Club raises interest on behalf of one of its fighters ---------
// Fighter must confirm before admin treats it as real interest.
const clubInterestSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  athlete_id: z.coerce.number().int().positive(),
});

export async function registerClubInterest(
  _prev: EventFlowState,
  formData: FormData,
): Promise<EventFlowState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Sign in required." };
  if (session.user.role !== "gym" && session.user.role !== "coach" && session.user.role !== "admin") {
    return { ok: false, message: "Only club accounts can register interest on a fighter's behalf." };
  }
  const parsed = clubInterestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Pick a fighter and event." };
  const { event_id, athlete_id } = parsed.data;

  const gym = await prisma.gym.findFirst({
    where: { ownerId: Number(session.user.id) },
    select: { id: true, name: true },
  });
  if (!gym) return { ok: false, message: "No club linked to this account." };

  // The fighter must be an approved member of this gym.
  const profile = await prisma.fighterProfile.findFirst({
    where: { athleteId: athlete_id, gymId: gym.id, approvalStatus: "approved" },
    include: { athlete: true, user: true },
  });
  if (!profile) {
    return { ok: false, message: "That fighter isn't a member of your club." };
  }

  const ev = await prisma.event.findUnique({ where: { id: event_id } });
  if (!ev) return { ok: false, message: "Event not found." };
  if (ev.status === "Past") {
    return { ok: false, message: "That event is already past." };
  }

  // Awaiting-fighter state is 'pending_fighter'. Admin only sees the row flip
  // to 'interested' after the fighter agrees.
  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_athleteId: { eventId: event_id, athleteId: athlete_id } },
  });
  if (existing && existing.status !== "declined") {
    return { ok: true, message: "Your fighter is already on this event's list." };
  }
  if (existing) {
    await prisma.eventRegistration.update({
      where: { id: existing.id },
      data: {
        status: "pending_fighter",
        addedById: Number(session.user.id),
        raisedByGymId: gym.id,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.eventRegistration.create({
      data: {
        eventId: event_id,
        athleteId: athlete_id,
        addedById: Number(session.user.id),
        raisedByGymId: gym.id,
        status: "pending_fighter",
      },
    });
  }

  // Notify the fighter — mail + in-app.
  if (profile.user) {
    const link = `/events/${event_id}`;
    await prisma.notification.create({
      data: {
        userId: profile.user.id,
        kind: "club_interest_proposed",
        title: `${gym.name} wants to put you forward for ${ev.title}`,
        body: `Your club has raised interest on your behalf. Confirm to let the W.U.C.O admin know, or decline.`,
        link,
      },
    });
    await sendMail({
      to: profile.user.email,
      subject: `W.U.C.O: ${gym.name} wants to put you forward for ${ev.title}`,
      body:
        `Hi ${profile.athlete.name},\n\n` +
        `${gym.name} has registered interest in ${ev.title}${ev.startsAt ? ` (${ev.startsAt})` : ""} on your behalf. ` +
        `The W.U.C.O admin won't see it as interest until you confirm.\n\n` +
        `Confirm or decline from the event page:\n${SITE_URL}${link}\n\n— W.U.C.O Ireland`,
      category: "fighter_signup",
    });
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/portal/club");
  return {
    ok: true,
    message: "Your fighter has been notified — the admin will see this once they confirm.",
  };
}

// Fighter responds to a club-raised interest.
const clubInterestResponseSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  decision: z.enum(["accept", "decline"]),
});

export async function respondToClubInterest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in required.");
  const d = clubInterestResponseSchema.parse(Object.fromEntries(formData));

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
  if (!reg || reg.status !== "pending_fighter") {
    throw new Error("No club interest to respond to.");
  }

  if (d.decision === "decline") {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: "cancelled", respondedAt: new Date(), raisedByGymId: null },
    });
  } else {
    await prisma.eventRegistration.update({
      where: { id: reg.id },
      data: { status: "interested", respondedAt: new Date() },
    });
    await sendMail({
      to: MAIL_ADMIN,
      subject: `Fighter interest (via club): ${profile.athlete.name} → ${reg.event.title}`,
      body:
        `${profile.athlete.name} confirmed club-raised interest in ${reg.event.title}.\n\n` +
        `Open the event in the admin portal to offer a bout: ${SITE_URL}/portal/admin/events`,
      category: "fighter_signup",
    });
  }

  revalidatePath(`/events/${d.event_id}`);
  revalidatePath("/portal/admin/events");
  revalidatePath("/portal/club");
  redirect(`/events/${d.event_id}`);
}

// --------- Admin schedules a bout BEFORE anyone registered interest --------
// Used from the admin "Add bout" form on an event. Creates paired offer rows
// so both fighters must accept; stores desired boutOrder / cardSection in the
// offer so publishConfirmedBout can promote them to a real Bout.
const scheduleSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  red_id: z.coerce.number().int().positive(),
  blue_id: z.coerce.number().int().positive(),
  division: z.string().min(1).max(120),
  card_section: z.string().max(60).optional().default("Main"),
  bout_order: z.coerce.number().int().min(1).max(99).optional().default(1),
});

export async function scheduleBoutFromAdmin(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  const d = scheduleSchema.parse(Object.fromEntries(formData));
  if (d.red_id === d.blue_id) throw new Error("A fighter can't face themselves.");

  const [ev, red, blue] = await Promise.all([
    prisma.event.findUnique({ where: { id: d.event_id } }),
    prisma.athlete.findUnique({
      where: { id: d.red_id },
      include: { profile: { include: { user: true } } },
    }),
    prisma.athlete.findUnique({
      where: { id: d.blue_id },
      include: { profile: { include: { user: true } } },
    }),
  ]);
  if (!ev) throw new Error("Event not found.");
  if (!red || !blue) throw new Error("Fighter not found.");

  const now = new Date();
  const boutRef = randomUUID();
  // Stash desired bout_order in offerSection as a suffix so we can parse it
  // back when publishing (keeps schema untouched).
  const sectionWithOrder = `${d.card_section}|order=${d.bout_order}`;

  for (const [self, other] of [
    [red, blue],
    [blue, red],
  ] as const) {
    await prisma.eventRegistration.upsert({
      where: { eventId_athleteId: { eventId: d.event_id, athleteId: self.id } },
      update: {
        status: "offered",
        offerOpponent: other.name,
        offerDivision: d.division,
        offerSection: sectionWithOrder,
        offerNote: "",
        offerSentAt: now,
        respondedAt: null,
        confirmedAt: null,
        boutRef,
        updatedAt: now,
      },
      create: {
        eventId: d.event_id,
        athleteId: self.id,
        addedById: Number(session.user.id),
        status: "offered",
        offerOpponent: other.name,
        offerDivision: d.division,
        offerSection: sectionWithOrder,
        offerSentAt: now,
        boutRef,
      },
    });
  }

  // Notify both fighters: in-app + email.
  for (const self of [red, blue]) {
    const other = self.id === red.id ? blue : red;
    if (!self.profile?.user) continue;
    const link = `/events/${d.event_id}`;
    await prisma.notification.create({
      data: {
        userId: self.profile.user.id,
        kind: "bout_offered",
        title: `Bout offered for ${ev.title}`,
        body: `Opponent: ${other.name} · Division: ${d.division} · Section: ${d.card_section}`,
        link,
      },
    });
    await sendMail({
      to: self.profile.user.email,
      subject: `W.U.C.O: bout offered for ${ev.title}`,
      body:
        `Hi ${self.name},\n\n` +
        `A W.U.C.O admin has offered you a bout at ${ev.title}` +
        `${ev.startsAt ? ` (${ev.startsAt})` : ""}.\n\n` +
        `Opponent: ${other.name}\n` +
        `Division: ${d.division}\n` +
        `Section: ${d.card_section}\n\n` +
        `The bout is only confirmed once BOTH fighters accept — then admin ` +
        `publishes it onto the card.\n\n` +
        `Accept or decline:\n${SITE_URL}${link}\n\n— W.U.C.O Ireland`,
      category: "fighter_signup",
    });
  }

  revalidatePath("/portal/admin/events");
  revalidatePath(`/events/${d.event_id}`);
}

// --------- Admin publishes a confirmed bout onto the fight card ------------
// Promotes a confirmed EventRegistration pair (same boutRef, status=confirmed)
// into a real Bout row so it appears on the event's fight card.
const publishSchema = z.object({
  event_id: z.coerce.number().int().positive(),
  bout_ref: z.string().min(10),
});

export async function publishConfirmedBout(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Forbidden");
  const d = publishSchema.parse(Object.fromEntries(formData));

  const pair = await prisma.eventRegistration.findMany({
    where: { boutRef: d.bout_ref, eventId: d.event_id, status: "confirmed" },
    include: { athlete: true },
  });
  if (pair.length !== 2) {
    throw new Error("Both fighters must be confirmed before publishing.");
  }
  // Parse card section + order back out of the offerSection sentinel.
  const first = pair[0];
  let cardSection = first.offerSection || "Main";
  let boutOrder = 1;
  const m = cardSection.match(/^(.*?)\|order=(\d+)$/);
  if (m) {
    cardSection = m[1] || "Main";
    boutOrder = Number(m[2]) || 1;
  }

  // If a bout for this ref was already published, bail.
  const existing = await prisma.bout.findFirst({
    where: {
      eventId: d.event_id,
      redAthleteId: pair[0].athleteId,
      blueAthleteId: pair[1].athleteId,
    },
  });
  if (!existing) {
    await prisma.bout.create({
      data: {
        eventId: d.event_id,
        redAthleteId: pair[0].athleteId,
        blueAthleteId: pair[1].athleteId,
        boutOrder,
        cardSection,
        division: pair[0].offerDivision || null,
      },
    });
  }

  revalidatePath("/portal/admin/events");
  revalidatePath(`/events/${d.event_id}`);
}
