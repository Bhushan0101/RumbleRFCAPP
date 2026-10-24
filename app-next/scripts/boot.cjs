// Server bootstrap: run on every container start.
// Applies Prisma migrations against the SQLite file on the persistent disk,
// then seeds a baseline dataset if the DB is empty.
//
// Rendered as plain Node + CommonJS so it works without needing tsx/ts-node.

const { execSync } = require("node:child_process");
const path = require("node:path");

// Make sure we run everything from the Next.js app's directory, regardless
// of where Render actually invokes us from. The `__dirname` of this file is
// always .../app-next/scripts, so the app root is one level up.
const appRoot = path.resolve(__dirname, "..");
process.chdir(appRoot);
console.log(`[boot] working dir: ${process.cwd()}`);

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  // 1. Apply migrations against whatever DATABASE_URL points to.
  //    This is safe to re-run on every start — Prisma skips already-applied migrations.
  console.log("[boot] applying Prisma migrations…");
  try {
    run("npx prisma migrate deploy");
  } catch (e) {
    console.error("[boot] prisma migrate deploy failed:", e.message);
    process.exit(1);
  }

  // 2. Idempotent seed: only run if the DB is empty (no portal_users yet).
  //    Reseeding every boot would reset admin passwords, which is bad.
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const existingUsers = await prisma.portalUser.count();
    if (existingUsers === 0) {
      console.log("[boot] empty DB detected — running seed…");
      await prisma.$disconnect();
      run("node ./scripts/seed-prod.cjs");
    } else {
      console.log(`[boot] DB already has ${existingUsers} users — skipping seed`);
      await prisma.$disconnect();
    }
  } catch (e) {
    console.error("[boot] seed check failed:", e.message);
    await prisma.$disconnect();
    // Non-fatal — the server can still start even if seed check fails.
  }

  // 3. Hand off to the Next.js server.
  console.log("[boot] starting Next.js…");
  // Use execSync so `next start` inherits stdio and the Render log stream.
  // This blocks forever — correct behaviour for a server process.
  run(`npx next start -p ${process.env.PORT || 3000} -H ${process.env.HOSTNAME || "0.0.0.0"}`);
}

main().catch((e) => {
  console.error("[boot] fatal:", e);
  process.exit(1);
});
