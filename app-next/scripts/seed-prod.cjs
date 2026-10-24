// Production seed — CommonJS so it runs with plain Node, no tsx needed.
// Idempotent: uses upsert everywhere. Only called by boot.cjs when the DB
// is completely empty (no users yet), so it won't clobber production data
// after the first launch.

const { PrismaClient } = require("@prisma/client");
const { pbkdf2Sync, randomBytes } = require("node:crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 200_000, 32, "sha256").toString("hex");
  return { salt, hash };
}

async function upsertUser({ email, name, role, password }) {
  const { salt, hash } = hashPassword(password);
  return prisma.portalUser.upsert({
    where: { email },
    update: {},
    create: { email, name, role, salt, passwordHash: hash },
  });
}

async function main() {
  console.log("Seeding W.U.C.O database…");

  await upsertUser({ email: "admin@wuco.ie", name: "Platform Administrator", role: "admin", password: "WucoAdmin2026!" });
  const promoter = await upsertUser({ email: "promoter@wuco.ie", name: "Dublin Combat Promotions", role: "promoter", password: "WucoDemo2026!" });
  const fighterUser = await upsertUser({ email: "fighter@wuco.ie", name: "Conor Byrne", role: "fighter", password: "WucoDemo2026!" });
  await upsertUser({ email: "rankings@wuco.ie", name: "Rankings Officer", role: "ranking_admin", password: "WucoRankings2026!" });
  console.log("  users: admin / ranking_admin / promoter / fighter");

  const approved = [
    { name: "Conor Byrne",    class: "B", martial: "K-1",                division: "Lightweight",  country: "Ireland",       wins: 5,  losses: 1, draws: 0, userId: fighterUser.id },
    { name: "Aoife Walsh",    class: "A", martial: "MMA",                division: "Featherweight",country: "Ireland",       wins: 8,  losses: 2, draws: 0 },
    { name: "Darius Kane",    class: "A", martial: "Kickboxing",         division: "Lightweight",  country: "Ireland",       wins: 11, losses: 3, draws: 1 },
    { name: "Diego Santos",   class: "B", martial: "Brazilian Jiu Jitsu",division: "Featherweight",country: "Brazil",        wins: 6,  losses: 2, draws: 0 },
    { name: "Kenji Arai",     class: "A", martial: "MMA",                division: "Lightweight",  country: "Japan",         wins: 14, losses: 1, draws: 0 },
    { name: "Molly Rourke",   class: "N", martial: "K-1",                division: "Featherweight",country: "Ireland",       wins: 3,  losses: 0, draws: 0 },
    { name: "Shea O'Mahony",  class: "C", martial: "Kickboxing",         division: "Lightweight",  country: "Ireland",       wins: 2,  losses: 1, draws: 0 },
    { name: "Lara Mazzotti",  class: "B", martial: "Muay Thai",          division: "Featherweight",country: "Italy",         wins: 7,  losses: 2, draws: 1 },
    { name: "Pádraig Nolan",  class: "A", martial: "MMA",                division: "Lightweight",  country: "Ireland",       wins: 10, losses: 4, draws: 0 },
    { name: "Niamh Doyle",    class: "B", martial: "Kickboxing",         division: "Featherweight",country: "Ireland",       wins: 6,  losses: 3, draws: 0 },
    { name: "Rónan Kelly",    class: "C", martial: "K-1",                division: "Lightweight",  country: "Ireland",       wins: 1,  losses: 0, draws: 0 },
    { name: "Siobhán Casey",  class: "A", martial: "MMA",                division: "Featherweight",country: "Ireland",       wins: 9,  losses: 2, draws: 0 },
  ];

  for (const [i, f] of approved.entries()) {
    const athlete = await prisma.athlete.upsert({
      where: { id: i + 1 },
      update: {},
      create: {
        name: f.name, division: f.division, country: f.country,
        wins: f.wins, losses: f.losses, draws: f.draws,
        classCode: f.class, martialArt: f.martial,
        isSample: 1, displayOrder: i,
      },
    });
    await prisma.fighterProfile.upsert({
      where: { athleteId: athlete.id },
      update: { approvalStatus: "approved", userId: f.userId || undefined },
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
  }

  const pending = [
    { name: "Fiona Donnelly", class: "N", martial: "K-1",       division: "Featherweight", country: "Ireland" },
    { name: "Oisín Murphy",   class: "L", martial: "Kickboxing",division: "Lightweight",   country: "Ireland" },
  ];
  for (const [i, f] of pending.entries()) {
    const id = approved.length + 1 + i;
    const athlete = await prisma.athlete.upsert({
      where: { id },
      update: {},
      create: {
        name: f.name, division: f.division, country: f.country,
        classCode: f.class, martialArt: f.martial, isSample: 1,
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
  }
  console.log(`  fighters: ${approved.length} approved + ${pending.length} pending`);

  // Gym
  const gym = await prisma.gym.upsert({
    where: { slug: "monarch-fight-academy" },
    update: {},
    create: {
      name: "Monarch Fight Academy",
      city: "Dublin",
      slug: "monarch-fight-academy",
      about: "A modern Irish combat sports gym offering K-1, Brazilian Jiu Jitsu, Kids classes and women-only sessions.",
      revolutHandle: "revolut.me/monarchfight",
      timetableImageUrl: "/brand/monarch-timetable.png",
      joinCode: "MONARCH1",
      status: "active",
      contactEmail: "coach@monarchfight.ie",
    },
  });
  const productCount = await prisma.gymProduct.count({ where: { gymId: gym.id } });
  if (productCount === 0) {
    const products = [
      { kind: "day_pass",     title: "Single day pass",   priceCents: 1500 },
      { kind: "weekly_pass",  title: "Weekly pass",       priceCents: 4000 },
      { kind: "monthly_pass", title: "Monthly pass",      priceCents: 12000 },
      { kind: "per_class",    title: "Per-class drop-in", priceCents: 1500 },
    ];
    for (const p of products) {
      await prisma.gymProduct.create({
        data: { gymId: gym.id, ...p, revolutUrl: "https://revolut.me/monarchfight" },
      });
    }
    const classes = [
      ["Kickboxing (K-1)", "K-1", 1, "07:45", 60, 25],
      ["Kickboxing (K-1)", "K-1", 3, "07:45", 60, 25],
      ["Kids Kickboxing", "K-1", 5, "11:00", 60, 25],
      ["Open Mat (GI & No GI)", "Brazilian Jiu Jitsu", 6, "15:00", 90, 30],
      ["Kids BJJ (GI)", "Brazilian Jiu Jitsu", 0, "17:00", 60, 25],
      ["Kickboxing (K-1)", "K-1", 0, "18:00", 60, 30],
      ["No Gi Jiu Jitsu", "Brazilian Jiu Jitsu", 1, "18:00", 60, 30],
      ["Women-only Kickboxing", "K-1", 2, "18:00", 60, 25],
      ["Brazilian Jiu Jitsu (GI)", "Brazilian Jiu Jitsu", 0, "19:30", 60, 30],
      ["No Gi Jiu Jitsu", "Brazilian Jiu Jitsu", 3, "19:30", 60, 30],
    ];
    for (const [title, discipline, day, start, duration, cap] of classes) {
      await prisma.gymClass.create({
        data: {
          gymId: gym.id, title, discipline, dayOfWeek: day, startTime: start,
          durationMinutes: duration, capacity: cap, perClassPriceCents: 1500,
          revolutUrl: "https://revolut.me/monarchfight",
        },
      });
    }
    console.log(`  gym: Monarch (${classes.length} classes + ${products.length} products)`);
  }

  // Events
  const promotion = await prisma.promotion.upsert({
    where: { id: 1 },
    update: { ownerId: promoter.id, name: "Dublin Combat Promotions" },
    create: { ownerId: promoter.id, name: "Dublin Combat Promotions" },
  });
  const events = [
    { title: "WUCO Fight Night (LIVE)", subtitle: "W.U.C.O · Fight Day", startsAt: new Date().toISOString().slice(0, 10), city: "Dublin", venue: "National Stadium", status: "Live" },
    { title: "WUCO Rookies", subtitle: "W.U.C.O · Showcase", startsAt: "2026-12-06", city: "Dublin 2", venue: "The National Stadium", status: "Upcoming" },
    { title: "WUCO National Championships", subtitle: "W.U.C.O · Championship", startsAt: "2026-03-14", city: "Dublin", venue: "3Arena", status: "Upcoming" },
    { title: "WUCO Open", subtitle: "W.U.C.O · Open", startsAt: "2026-05-23", city: "Cork", venue: "Cork City Hall", status: "Upcoming" },
    { title: "WUCO Classic (archive)", subtitle: "W.U.C.O · Archive", startsAt: "2026-02-11", city: "Dublin", venue: "National Stadium", status: "Past" },
    { title: "WUCO Masters (archive)", subtitle: "W.U.C.O · Archive", startsAt: "2026-01-20", city: "Galway", venue: "Leisureland Galway", status: "Past" },
  ];
  for (const e of events) {
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (!exists) {
      await prisma.event.create({
        data: { ...e, promotionId: promotion.id, registrationOpen: 1 },
      });
    }
  }

  // Live event bouts
  const liveEvent = await prisma.event.findFirst({ where: { title: "WUCO Fight Night (LIVE)" } });
  if (liveEvent) {
    const existingBouts = await prisma.bout.count({ where: { eventId: liveEvent.id } });
    if (existingBouts === 0) {
      const lineup = [
        ["Conor Byrne", "Darius Kane", "Main event"],
        ["Aoife Walsh", "Molly Rourke", "Co-main"],
        ["Kenji Arai", "Pádraig Nolan", "Featured"],
        ["Diego Santos", "Shea O'Mahony", "Prelim"],
      ];
      for (let i = 0; i < lineup.length; i++) {
        const [redName, blueName, section] = lineup[i];
        const red = await prisma.athlete.findFirst({ where: { name: redName } });
        const blue = await prisma.athlete.findFirst({ where: { name: blueName } });
        if (red && blue) {
          await prisma.bout.create({
            data: {
              eventId: liveEvent.id, redAthleteId: red.id, blueAthleteId: blue.id,
              boutOrder: i + 1, cardSection: section,
            },
          });
        }
      }
    }
  }

  // Rankings
  const topFeather = await prisma.athlete.findMany({
    where: { division: "Featherweight", profile: { approvalStatus: "approved" } },
    orderBy: { wins: "desc" }, take: 5,
  });
  const topLight = await prisma.athlete.findMany({
    where: { division: "Lightweight", profile: { approvalStatus: "approved" } },
    orderBy: { wins: "desc" }, take: 5,
  });
  for (const [pos, a] of topFeather.entries()) {
    await prisma.ranking.upsert({
      where: { athleteId_division: { athleteId: a.id, division: a.division } },
      update: { position: pos + 1 },
      create: { athleteId: a.id, division: a.division, position: pos + 1 },
    });
  }
  for (const [pos, a] of topLight.entries()) {
    await prisma.ranking.upsert({
      where: { athleteId_division: { athleteId: a.id, division: a.division } },
      update: { position: pos + 1 },
      create: { athleteId: a.id, division: a.division, position: pos + 1 },
    });
  }

  console.log("\nDone. LOGINS:");
  console.log("  admin:    admin@wuco.ie / WucoAdmin2026!");
  console.log("  rankings: rankings@wuco.ie / WucoRankings2026!");
  console.log("  fighter:  fighter@wuco.ie / WucoDemo2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
