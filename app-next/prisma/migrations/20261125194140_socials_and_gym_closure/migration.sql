-- CreateTable
CREATE TABLE "gym_closure_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "requestedById" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "processedById" INTEGER,
    CONSTRAINT "gym_closure_requests_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "instagramHandle" TEXT NOT NULL DEFAULT '',
    "facebookUrl" TEXT NOT NULL DEFAULT '',
    "tiktokHandle" TEXT NOT NULL DEFAULT '',
    "isSample" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "classCode" TEXT,
    "martialArt" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TEXT NOT NULL DEFAULT '',
    "declaredWins" INTEGER NOT NULL DEFAULT 0,
    "declaredLosses" INTEGER NOT NULL DEFAULT 0,
    "declaredDraws" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_athletes" ("biography", "cartoonUrl", "classCode", "country", "dateOfBirth", "declaredDraws", "declaredLosses", "declaredWins", "displayOrder", "division", "draws", "gender", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins") SELECT "biography", "cartoonUrl", "classCode", "country", "dateOfBirth", "declaredDraws", "declaredLosses", "declaredWins", "displayOrder", "division", "draws", "gender", "id", "isSample", "losses", "martialArt", "name", "nickname", "portraitUrl", "wins" FROM "athletes";
DROP TABLE "athletes";
ALTER TABLE "new_athletes" RENAME TO "athletes";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "gym_closure_requests_status_createdAt_idx" ON "gym_closure_requests"("status", "createdAt" DESC);
