-- Hand-copied from prisma/migrations/20261104183957_add_gender_and_divisions/migration.sql
-- Keep in sync — see docs/MIGRATIONS.md for the dual-tree rule.
-- Adds Athlete.gender and resets Event.categories default to '[]'.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_athletes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "division" TEXT NOT NULL DEFAULT 'Featherweight',
    "country" TEXT NOT NULL DEFAULT '',
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "biography" TEXT,
    "portraitUrl" TEXT,
    "cartoonUrl" TEXT,
    "isSample" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "classCode" TEXT,
    "martialArt" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_athletes" ("biography", "cartoonUrl", "classCode", "country", "displayOrder", "division", "draws", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins") SELECT "biography", "cartoonUrl", "classCode", "country", "displayOrder", "division", "draws", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins" FROM "athletes";
DROP TABLE "athletes";
ALTER TABLE "new_athletes" RENAME TO "athletes";
CREATE TABLE "new_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "startsAt" TEXT,
    "timezone" TEXT,
    "venue" TEXT,
    "city" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "promotionId" INTEGER,
    "registrationOpen" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "registrationClosesAt" TEXT,
    "categories" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "events_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_events" ("capacity", "categories", "city", "description", "id", "posterUrl", "promotionId", "registrationClosesAt", "registrationOpen", "startsAt", "status", "subtitle", "timezone", "title", "venue") SELECT "capacity", "categories", "city", "description", "id", "posterUrl", "promotionId", "registrationClosesAt", "registrationOpen", "startsAt", "status", "subtitle", "timezone", "title", "venue" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
