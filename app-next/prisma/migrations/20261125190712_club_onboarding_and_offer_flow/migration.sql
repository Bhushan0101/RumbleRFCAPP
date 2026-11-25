-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_event_registrations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "addedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "registrationRef" TEXT,
    "updatedAt" DATETIME,
    "offerNote" TEXT NOT NULL DEFAULT '',
    "offerOpponent" TEXT NOT NULL DEFAULT '',
    "offerDivision" TEXT NOT NULL DEFAULT '',
    "offerSection" TEXT NOT NULL DEFAULT '',
    "offerSentAt" DATETIME,
    "respondedAt" DATETIME,
    CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_registrations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_event_registrations" ("addedById", "athleteId", "createdAt", "eventId", "id", "registrationRef", "status", "updatedAt") SELECT "addedById", "athleteId", "createdAt", "eventId", "id", "registrationRef", "status", "updatedAt" FROM "event_registrations";
DROP TABLE "event_registrations";
ALTER TABLE "new_event_registrations" RENAME TO "event_registrations";
CREATE UNIQUE INDEX "event_registrations_registrationRef_key" ON "event_registrations"("registrationRef");
CREATE UNIQUE INDEX "event_registrations_eventId_athleteId_key" ON "event_registrations"("eventId", "athleteId");
CREATE TABLE "new_gyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "joinCode" TEXT,
    "logoUrl" TEXT,
    "heroUrl" TEXT,
    "about" TEXT NOT NULL DEFAULT '',
    "revolutHandle" TEXT NOT NULL DEFAULT '',
    "timetableImageUrl" TEXT,
    "slug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "eircode" TEXT NOT NULL DEFAULT '',
    "county" TEXT NOT NULL DEFAULT '',
    "yearEstablished" INTEGER,
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "socialLinks" TEXT NOT NULL DEFAULT '',
    "membersTotal" INTEGER,
    "membersUnder18" INTEGER,
    "disciplines" TEXT NOT NULL DEFAULT '',
    "governingBody" TEXT NOT NULL DEFAULT '',
    "coachName" TEXT NOT NULL DEFAULT '',
    "coachRank" TEXT NOT NULL DEFAULT '',
    "coachYearsTraining" INTEGER,
    "coachStyle" TEXT NOT NULL DEFAULT '',
    "coachLastGradeYear" INTEGER,
    "coachPhone" TEXT NOT NULL DEFAULT '',
    "coachEmail" TEXT NOT NULL DEFAULT '',
    "coachQualifications" TEXT NOT NULL DEFAULT '',
    "coachYearsCoaching" INTEGER,
    "coachCertifications" TEXT NOT NULL DEFAULT '',
    "coachFirstAidExpiry" TEXT NOT NULL DEFAULT '',
    "coachSafeguarding" TEXT NOT NULL DEFAULT '',
    "coachGardaVetting" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "gyms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_gyms" ("about", "city", "contactEmail", "heroUrl", "id", "joinCode", "logoUrl", "name", "ownerId", "revolutHandle", "slug", "status", "timetableImageUrl") SELECT "about", "city", "contactEmail", "heroUrl", "id", "joinCode", "logoUrl", "name", "ownerId", "revolutHandle", "slug", "status", "timetableImageUrl" FROM "gyms";
DROP TABLE "gyms";
ALTER TABLE "new_gyms" RENAME TO "gyms";
CREATE UNIQUE INDEX "gyms_ownerId_key" ON "gyms"("ownerId");
CREATE UNIQUE INDEX "gyms_joinCode_key" ON "gyms"("joinCode");
CREATE UNIQUE INDEX "gyms_slug_key" ON "gyms"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
