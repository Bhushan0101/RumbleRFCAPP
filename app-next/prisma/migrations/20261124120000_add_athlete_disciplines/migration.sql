-- CreateTable
CREATE TABLE "athlete_disciplines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "martialArt" TEXT NOT NULL,
    "classCode" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "athlete_disciplines_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_disciplines_athleteId_martialArt_key" ON "athlete_disciplines"("athleteId", "martialArt");
