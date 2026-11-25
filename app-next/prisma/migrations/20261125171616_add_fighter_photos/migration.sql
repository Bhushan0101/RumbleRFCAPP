-- CreateTable
CREATE TABLE "fighter_photos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fighter_photos_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "fighter_photos_athleteId_idx" ON "fighter_photos"("athleteId");
