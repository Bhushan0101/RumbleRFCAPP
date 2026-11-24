-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fight_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "fightDate" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "eventName" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fight_history_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "authorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "news_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fighter_profiles" (
    "athleteId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "gymId" INTEGER,
    "coachId" INTEGER,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending_approval',
    "legacyMember" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER,
    "reviewedById" INTEGER,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "hasInjuries" INTEGER NOT NULL DEFAULT 0,
    "injuriesDetails" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "fighter_profiles_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_fighter_profiles" ("approvalStatus", "athleteId", "coachId", "createdById", "gymId", "legacyMember", "reviewNote", "reviewedAt", "reviewedById", "userId") SELECT "approvalStatus", "athleteId", "coachId", "createdById", "gymId", "legacyMember", "reviewNote", "reviewedAt", "reviewedById", "userId" FROM "fighter_profiles";
DROP TABLE "fighter_profiles";
ALTER TABLE "new_fighter_profiles" RENAME TO "fighter_profiles";
CREATE UNIQUE INDEX "fighter_profiles_userId_key" ON "fighter_profiles"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "fight_history_athleteId_fightDate_idx" ON "fight_history"("athleteId", "fightDate");

-- CreateIndex
CREATE UNIQUE INDEX "news_posts_slug_key" ON "news_posts"("slug");

-- CreateIndex
CREATE INDEX "news_posts_publishedAt_idx" ON "news_posts"("publishedAt" DESC);
