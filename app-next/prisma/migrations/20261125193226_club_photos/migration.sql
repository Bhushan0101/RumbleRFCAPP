-- CreateTable
CREATE TABLE "club_photos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_photos_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "club_photos_gymId_idx" ON "club_photos"("gymId");
