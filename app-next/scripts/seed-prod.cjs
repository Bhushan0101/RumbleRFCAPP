// Production seed — CommonJS so it runs with plain Node, no tsx needed.
// Idempotent: uses upsert everywhere. Only called by boot.cjs when the DB
// is completely empty (no users yet), so it won't clobber production data
// after the first launch.
//
// Keeps parity with prisma/seed.ts (the dev seed) — same taxonomy, same
// discipline rows, same division strings. Any schema change should update
// both files.

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
  console.log("Seeding W.U.C.O database (prod)…");

  await upsertUser({ email: "admin@wuco.ie", name: "Platform Administrator", role: "admin", password: "WucoAdmin2026!" });
  const promoter = await upsertUser({ email: "promoter@wuco.ie", name: "Dublin Combat Promotions", role: "promoter", password: "WucoDemo2026!" });
  const fighterUser = await upsertUser({ email: "fighter@wuco.ie", name: "Conor Byrne", role: "fighter", password: "WucoDemo2026!" });
  await upsertUser({ email: "rankings@wuco.ie", name: "Rankings Officer", role: "ranking_admin", password: "WucoRankings2026!" });
  console.log("  users: admin / ranking_admin / promoter / fighter");

  // Approved fighters — matches prisma/seed.ts. `extra` = secondary disciplines.
  const approved = [
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

  for (const [i, f] of approved.entries()) {
    const athlete = await prisma.athlete.upsert({
      where: { id: i + 1 },
      update: {},
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
  console.log(`  fighters: ${approved.length} approved`);

  // Rankings — top athletes per populated division.
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

  // Suppress unused-var noise for promoter — kept because dev seed uses it
  // and future changes may want promotion/event seeding here too.
  void promoter;

  console.log("\nDone. LOGINS:");
  console.log("  admin:    admin@wuco.ie / WucoAdmin2026!");
  console.log("  rankings: rankings@wuco.ie / WucoRankings2026!");
  console.log("  fighter:  fighter@wuco.ie / WucoDemo2026!");
  console.log("  promoter: promoter@wuco.ie / WucoDemo2026!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
