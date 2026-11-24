// Seed script — safe, idempotent, generates realistic sample data.
// Run: npx tsx prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@wuco.ie";
const ADMIN_PASSWORD = "WucoAdmin2026!";

async function upsertUser(opts: {
  email: string;
  name: string;
  role: string;
  password: string;
}) {
  const { salt, hash } = await hashPassword(opts.password);
  return prisma.portalUser.upsert({
    where: { email: opts.email },
    update: {},
    create: {
      email: opts.email,
      name: opts.name,
      role: opts.role,
      salt,
      passwordHash: hash,
    },
  });
}

async function main() {
  console.log("Seeding W.U.C.O database…");

  // --- Users ---
  const admin = await upsertUser({
    email: ADMIN_EMAIL,
    name: "Platform Administrator",
    role: "admin",
    password: ADMIN_PASSWORD,
  });
  const promoter = await upsertUser({
    email: "promoter@wuco.ie",
    name: "Dublin Combat Promotions",
    role: "promoter",
    password: "WucoDemo2026!",
  });
  const fighterUser = await upsertUser({
    email: "fighter@wuco.ie",
    name: "Conor Byrne",
    role: "fighter",
    password: "WucoDemo2026!",
  });
  const rankingAdmin = await upsertUser({
    email: "rankings@wuco.ie",
    name: "Rankings Officer",
    role: "ranking_admin",
    password: "WucoRankings2026!",
  });
  console.log(`  users: admin / ranking_admin / promoter / fighter`);

  // --- Approved fighters (seeded, high quality) ---
  // `extra` = secondary disciplines (same shape as primary: class + W-L-D).
  // The primary (martial/class/wins/losses/draws) is mirrored onto the Athlete row.
  type Secondary = { martial: string; class: string; wins: number; losses: number; draws: number };
  const approved: Array<{
    name: string; gender: string; class: string; martial: string;
    division: string; country: string; wins: number; losses: number; draws: number;
    userId?: number; extra?: Secondary[];
  }> = [
    { name: "Conor Byrne",    gender: "male",   class: "B",            martial: "kickboxing", division: "M-70kg",            country: "Ireland", wins: 5,  losses: 1, draws: 0, userId: fighterUser.id,
      extra: [{ martial: "muay-thai", class: "N", wins: 2, losses: 0, draws: 0 }] },
    { name: "Aoife Walsh",    gender: "female", class: "elite",        martial: "mma",        division: "MMA-Featherweight", country: "Ireland", wins: 8,  losses: 2, draws: 0 },
    { name: "Darius Kane",    gender: "male",   class: "A",            martial: "kickboxing", division: "M-70kg",            country: "Ireland", wins: 11, losses: 3, draws: 1,
      extra: [{ martial: "boxing", class: "elite", wins: 4, losses: 1, draws: 0 }] },
    { name: "Mateus Silva",   gender: "male",   class: "A",            martial: "muay-thai",  division: "M-70kg",            country: "Brazil",  wins: 7,  losses: 1, draws: 0 },
    { name: "Kenji Arai",     gender: "male",   class: "pro",          martial: "mma",        division: "MMA-Lightweight",   country: "Japan",   wins: 14, losses: 1, draws: 0 },
    { name: "Molly Rourke",   gender: "female", class: "N",            martial: "kickboxing", division: "F-57kg",            country: "Ireland", wins: 3,  losses: 0, draws: 0 },
    { name: "Shea O'Mahony",  gender: "male",   class: "C",            martial: "kickboxing", division: "M-67kg",            country: "Ireland", wins: 2,  losses: 1, draws: 0,
      extra: [{ martial: "muay-thai", class: "L", wins: 1, losses: 1, draws: 0 }] },
    { name: "Lara Mazzotti",  gender: "female", class: "intermediate", martial: "boxing",     division: "F-60kg",            country: "Italy",   wins: 7,  losses: 2, draws: 1 },
    { name: "Pádraig Nolan",  gender: "male",   class: "elite",        martial: "mma",        division: "MMA-Lightweight",   country: "Ireland", wins: 10, losses: 4, draws: 0 },
    { name: "Niamh Doyle",    gender: "female", class: "B",            martial: "kickboxing", division: "F-55kg",            country: "Ireland", wins: 6,  losses: 3, draws: 0 },
    { name: "Rónan Kelly",    gender: "male",   class: "C",            martial: "kickboxing", division: "M-63kg",            country: "Ireland", wins: 1,  losses: 0, draws: 0 },
    { name: "Siobhán Casey",  gender: "female", class: "pro",          martial: "mma",        division: "MMA-Featherweight", country: "Ireland", wins: 9,  losses: 2, draws: 0 },
  ];

  const pending = [
    { name: "Fiona Donnelly", gender: "female", class: "N", martial: "kickboxing", division: "F-57kg", country: "Ireland" },
    { name: "Oisín Murphy",   gender: "male",   class: "L", martial: "kickboxing", division: "M-60kg", country: "Ireland" },
  ];

  const rejected = [
    { name: "Rejected Example", gender: "male", class: "novice", martial: "mma", division: "MMA-Lightweight", country: "Ireland", note: "Insufficient documentation." },
  ];

  // Clear slate and reseed deterministically — safe because this is dev data.
  for (const [i, f] of approved.entries()) {
    const athlete = await prisma.athlete.upsert({
      where: { id: i + 1 },
      update: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        classCode: f.class,
        martialArt: f.martial,
        wins: f.wins,
        losses: f.losses,
        draws: f.draws,
      },
      create: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        wins: f.wins,
        losses: f.losses,
        draws: f.draws,
        classCode: f.class,
        martialArt: f.martial,
        isSample: 1,
        displayOrder: i,
      },
    });
    await prisma.fighterProfile.upsert({
      where: { athleteId: athlete.id },
      update: { approvalStatus: "approved", userId: f.userId ?? undefined },
      create: {
        athleteId: athlete.id,
        userId: f.userId,
        approvalStatus: "approved",
        legacyMember: 1,
      },
    });
    await prisma.fighterPassport.upsert({
      where: { athleteId: athlete.id },
      update: {},
      create: {
        athleteId: athlete.id,
        fighterNo: `IRL-${String(i + 1).padStart(6, "0")}`,
      },
    });

    // Rebuild discipline rows deterministically.
    await prisma.athleteDiscipline.deleteMany({ where: { athleteId: athlete.id } });
    await prisma.athleteDiscipline.create({
      data: {
        athleteId: athlete.id,
        martialArt: f.martial,
        classCode: f.class,
        wins: f.wins,
        losses: f.losses,
        draws: f.draws,
        isPrimary: 1,
      },
    });
    for (const s of f.extra ?? []) {
      await prisma.athleteDiscipline.create({
        data: {
          athleteId: athlete.id,
          martialArt: s.martial,
          classCode: s.class,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          isPrimary: 0,
        },
      });
    }
  }

  for (const [i, f] of pending.entries()) {
    const id = approved.length + 1 + i;
    const athlete = await prisma.athlete.upsert({
      where: { id },
      update: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        classCode: f.class,
        martialArt: f.martial,
      },
      create: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        classCode: f.class,
        martialArt: f.martial,
        isSample: 1,
      },
    });
    await prisma.fighterProfile.upsert({
      where: { athleteId: athlete.id },
      update: { approvalStatus: "pending_approval" },
      create: {
        athleteId: athlete.id,
        approvalStatus: "pending_approval",
        legacyMember: 0,
      },
    });
    await prisma.athleteDiscipline.deleteMany({ where: { athleteId: athlete.id } });
    await prisma.athleteDiscipline.create({
      data: {
        athleteId: athlete.id,
        martialArt: f.martial,
        classCode: f.class,
        isPrimary: 1,
      },
    });
  }

  for (const [i, f] of rejected.entries()) {
    const id = approved.length + pending.length + 1 + i;
    const athlete = await prisma.athlete.upsert({
      where: { id },
      update: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        classCode: f.class,
        martialArt: f.martial,
      },
      create: {
        name: f.name,
        gender: f.gender,
        division: f.division,
        country: f.country,
        classCode: f.class,
        martialArt: f.martial,
        isSample: 1,
      },
    });
    await prisma.fighterProfile.upsert({
      where: { athleteId: athlete.id },
      update: { approvalStatus: "rejected", reviewNote: f.note },
      create: {
        athleteId: athlete.id,
        approvalStatus: "rejected",
        reviewNote: f.note,
        legacyMember: 0,
      },
    });
    await prisma.athleteDiscipline.deleteMany({ where: { athleteId: athlete.id } });
    await prisma.athleteDiscipline.create({
      data: {
        athleteId: athlete.id,
        martialArt: f.martial,
        classCode: f.class,
        isPrimary: 1,
      },
    });
  }
  console.log(`  fighters: ${approved.length} approved · ${pending.length} pending · ${rejected.length} rejected`);

  // --- Monarch Fight Academy ---
  const existingGym = await prisma.gym.findUnique({
    where: { slug: "monarch-fight-academy" },
  });
  const gym =
    existingGym ??
    (await prisma.gym.create({
      data: {
        name: "Monarch Fight Academy",
        city: "Dublin",
        slug: "monarch-fight-academy",
        about:
          "A modern Irish combat sports gym offering Kickboxing (K-1), Muay Thai, Boxing and Kids classes.",
        revolutHandle: "revolut.me/monarchfight",
        timetableImageUrl: "/brand/monarch-timetable.png",
        joinCode: "MONARCH1",
        status: "active",
        contactEmail: "coach@monarchfight.ie",
      },
    }));
  if (!existingGym) {
    const products = [
      { kind: "day_pass",     title: "Single day pass",     priceCents: 1500 },
      { kind: "weekly_pass",  title: "Weekly pass",         priceCents: 4000 },
      { kind: "monthly_pass", title: "Monthly pass",        priceCents: 12000 },
      { kind: "per_class",    title: "Per-class drop-in",   priceCents: 1500 },
    ];
    for (const p of products) {
      await prisma.gymProduct.create({
        data: {
          gymId: gym.id, kind: p.kind, title: p.title, priceCents: p.priceCents,
          revolutUrl: "https://revolut.me/monarchfight",
        },
      });
    }
    const classes = [
      ["Kickboxing (K-1)",             "K-1",          1, "07:45", 60, 25],
      ["Kickboxing (K-1)",             "K-1",          3, "07:45", 60, 25],
      ["Kids Kickboxing (K-1)",        "K-1",          5, "11:00", 60, 25],
      ["Muay Thai (Open Mat)",         "Muay Thai",    6, "15:00", 90, 30],
      ["Kids Boxing",                  "Boxing",       0, "17:00", 60, 25],
      ["Kids Kickboxing (K-1)",        "K-1",          1, "17:00", 60, 25],
      ["Kickboxing (K-1)",             "K-1",          0, "18:00", 60, 30],
      ["Muay Thai (Intermediate)",     "Muay Thai",    1, "18:00", 60, 30],
      ["Women-only Kickboxing (K-1)",  "K-1",          2, "18:00", 60, 25],
      ["Boxing (All levels)",          "Boxing",       0, "19:30", 60, 30],
      ["Muay Thai (Advanced)",         "Muay Thai",    3, "19:30", 60, 30],
    ] as const;
    for (const [title, discipline, day, start, duration, cap] of classes) {
      await prisma.gymClass.create({
        data: {
          gymId: gym.id, title, discipline, dayOfWeek: day, startTime: start,
          durationMinutes: duration, capacity: cap, perClassPriceCents: 1500,
          revolutUrl: "https://revolut.me/monarchfight",
        },
      });
    }
    console.log(`  gym: Monarch (${classes.length} classes + 4 products)`);
  }

  // --- Events ---
  const existingPromo = await prisma.promotion.findFirst({
    where: { ownerId: promoter.id },
  });
  const promotion =
    existingPromo ??
    (await prisma.promotion.create({
      data: { ownerId: promoter.id, name: "Dublin Combat Promotions" },
    }));
  const events = [
    { title: "WUCO Rookies",                subtitle: "W.U.C.O · Showcase",    startsAt: "2026-12-06", city: "Dublin 2", venue: "The National Stadium", status: "Upcoming" },
    { title: "WUCO National Championships", subtitle: "W.U.C.O · Championship", startsAt: "2026-03-14", city: "Dublin",   venue: "3Arena",                status: "Upcoming" },
    { title: "WUCO Open",                   subtitle: "W.U.C.O · Open",        startsAt: "2026-05-23", city: "Cork",     venue: "Cork City Hall",        status: "Upcoming" },
    { title: "WUCO Classic (archive)",      subtitle: "W.U.C.O · Archive",     startsAt: "2026-02-11", city: "Dublin",   venue: "National Stadium",      status: "Past" },
    { title: "WUCO Masters (archive)",      subtitle: "W.U.C.O · Archive",     startsAt: "2026-01-20", city: "Galway",   venue: "Leisureland Galway",    status: "Past" },
  ];
  for (const e of events) {
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (!exists) {
      await prisma.event.create({
        data: { ...e, promotionId: promotion.id, registrationOpen: 1 },
      });
    }
  }
  console.log(`  events: ${events.length} seeded (1 live + 3 upcoming + 2 past)`);

  // --- Live-event bouts (unsettled) ---
  const liveEvent = await prisma.event.findFirst({
    where: { title: "WUCO Fight Night (LIVE)" },
  });
  if (liveEvent) {
    const existingBouts = await prisma.bout.count({
      where: { eventId: liveEvent.id },
    });
    if (existingBouts === 0) {
      const lineup = [
        ["Conor Byrne", "Darius Kane",   "Main event"],
        ["Aoife Walsh", "Molly Rourke",  "Co-main"],
        ["Kenji Arai", "Pádraig Nolan", "Featured"],
        ["Mateus Silva", "Shea O'Mahony","Prelim"],
      ] as const;
      for (const [i, [redName, blueName, section]] of lineup.entries()) {
        const red = await prisma.athlete.findFirst({ where: { name: redName } });
        const blue = await prisma.athlete.findFirst({ where: { name: blueName } });
        if (red && blue) {
          await prisma.bout.create({
            data: {
              eventId: liveEvent.id,
              redAthleteId: red.id,
              blueAthleteId: blue.id,
              boutOrder: i + 1,
              cardSection: section,
            },
          });
        }
      }
      console.log(`  live bouts: ${lineup.length} unsettled matchups`);
    }
  }

  // --- Rankings ---
  // Group approved fighters by their current division and rank the top 5 by wins.
  const rankedDivisions = ["M-70kg", "M-67kg", "F-57kg", "F-60kg", "MMA-Lightweight", "MMA-Featherweight"];
  let rankingCount = 0;
  for (const division of rankedDivisions) {
    const top = await prisma.athlete.findMany({
      where: { division, profile: { approvalStatus: "approved" } },
      orderBy: { wins: "desc" },
      take: 5,
    });
    for (const [pos, a] of top.entries()) {
      await prisma.ranking.upsert({
        where: { athleteId_division: { athleteId: a.id, division } },
        update: { position: pos + 1 },
        create: { athleteId: a.id, division, position: pos + 1 },
      });
      rankingCount++;
    }
  }
  console.log(`  rankings: ${rankingCount} entries`);

  // --- Dummy activity for dashboard ---
  const now = Date.now();
  const day = 86400_000;

  const existingEnquiries = await prisma.gymEnquiry.count();
  if (existingEnquiries === 0) {
    await prisma.gymEnquiry.createMany({
      data: [
        {
          gymName: "Westside Boxing Club",
          contactName: "Mark Hughes",
          contactEmail: "mark@westsidebc.ie",
          phone: "+353 1 555 1234",
          city: "Dublin 7",
          message: "Established boxing & kickboxing gym looking to affiliate.",
          status: "new",
          createdAt: new Date(now - 2 * day),
        },
        {
          gymName: "Shannonside Fight Club",
          contactName: "Elaine Walsh",
          contactEmail: "elaine@shannonsidefc.ie",
          phone: "+353 61 555 0000",
          city: "Limerick",
          message: "15 competing fighters — we'd like to be ranked.",
          status: "invited",
          invitedAt: new Date(now - 1 * day),
        },
      ],
    });
  }

  const existingBookings = await prisma.classBooking.count();
  if (existingBookings === 0) {
    const monarchClasses = await prisma.gymClass.findMany({
      where: { gymId: gym.id },
      take: 5,
    });
    const today = new Date();
    for (const [i, c] of monarchClasses.entries()) {
      const d = new Date(today.getTime() - i * day);
      const iso = d.toISOString().slice(0, 10);
      await prisma.classBooking.create({
        data: {
          classId: c.id,
          guestName: ["Mia O.", "Tom R.", "Lee K.", "Nora C.", "Finn O."][i],
          guestEmail: `guest${i}@test.ie`,
          bookedForDate: iso,
          status: i === 0 ? "pending_payment" : "paid",
          createdAt: new Date(now - i * day),
        },
      });
    }
  }

  const existingMail = await prisma.outboundMail.count();
  if (existingMail === 0) {
    await prisma.outboundMail.createMany({
      data: [
        { toAddress: "ops@wuco.ie", subject: "New gym enquiry: Westside Boxing Club", body: "Mark Hughes submitted an enquiry.", category: "gym_enquiry" },
        { toAddress: "elaine@shannonsidefc.ie", subject: "W.U.C.O gym onboarding link", body: "Please complete the onboarding form.", category: "gym_onboarding" },
        { toAddress: "fighter@wuco.ie", subject: "W.U.C.O: your application was approved", body: "Welcome aboard!", category: "fighter_approved" },
      ],
    });
  }
  console.log("  activity: 2 enquiries · 5 bookings · 3 mail entries");

  console.log("\nDone.");
  console.log(`\nLOGINS:`);
  console.log(`  admin:    admin@wuco.ie / WucoAdmin2026!`);
  console.log(`  fighter:  fighter@wuco.ie / WucoDemo2026!`);
  console.log(`  promoter: promoter@wuco.ie / WucoDemo2026!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
