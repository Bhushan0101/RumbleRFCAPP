-- CreateTable
CREATE TABLE "portal_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "tokenHash" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "expiresAt" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "athletes" (
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
    "martialArt" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "fighter_profiles" (
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
    CONSTRAINT "fighter_profiles_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coaches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fighter_profiles_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fighter_passports" (
    "athleteId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fighterNo" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fighter_passports_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_audit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_audit_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "application_audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gyms" (
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
    CONSTRAINT "gyms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "coaches" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "gymId" INTEGER,
    "name" TEXT NOT NULL,
    CONSTRAINT "coaches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "coaches_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gym_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "revolutUrl" TEXT NOT NULL DEFAULT '',
    "active" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "gym_products_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gym_classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT NOT NULL DEFAULT '',
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "perClassPriceCents" INTEGER,
    "revolutUrl" TEXT NOT NULL DEFAULT '',
    "colour" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "gym_classes_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_bookings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "classId" INTEGER NOT NULL,
    "userId" INTEGER,
    "guestName" TEXT NOT NULL DEFAULT '',
    "guestEmail" TEXT NOT NULL DEFAULT '',
    "bookedForDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedPaidAt" DATETIME,
    CONSTRAINT "class_bookings_classId_fkey" FOREIGN KEY ("classId") REFERENCES "gym_classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "class_bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gym_join_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "reviewedById" INTEGER,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "gym_join_requests_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gym_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "gym_join_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gym_enquiries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gymName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "invitedById" INTEGER,
    "invitedAt" DATETIME,
    "reviewedById" INTEGER,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "gym_enquiries_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "gym_enquiries_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gym_onboarding_tokens" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "enquiryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" INTEGER NOT NULL,
    "usedAt" DATETIME,
    CONSTRAINT "gym_onboarding_tokens_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "gym_enquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "promotions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "portal_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "events" (
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
    "categories" TEXT NOT NULL DEFAULT '["Featherweight","Lightweight"]',
    CONSTRAINT "events_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "addedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "registrationRef" TEXT,
    "updatedAt" DATETIME,
    CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_registrations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bouts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "redAthleteId" INTEGER NOT NULL,
    "blueAthleteId" INTEGER NOT NULL,
    "boutOrder" INTEGER NOT NULL DEFAULT 0,
    "cardSection" TEXT NOT NULL DEFAULT 'Main',
    "division" TEXT,
    "winnerId" INTEGER,
    "resultMethod" TEXT,
    "resultRound" INTEGER,
    "resultTime" TEXT,
    CONSTRAINT "bouts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bouts_redAthleteId_fkey" FOREIGN KEY ("redAthleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bouts_blueAthleteId_fkey" FOREIGN KEY ("blueAthleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bouts_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "athletes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bout_results" (
    "boutId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outcome" TEXT NOT NULL,
    "updatedBy" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bout_results_boutId_fkey" FOREIGN KEY ("boutId") REFERENCES "bouts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "movement" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rankings_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outbound_mail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "readAt" DATETIME
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_email_key" ON "portal_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "fighter_profiles_userId_key" ON "fighter_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fighter_passports_fighterNo_key" ON "fighter_passports"("fighterNo");

-- CreateIndex
CREATE UNIQUE INDEX "gyms_ownerId_key" ON "gyms"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "gyms_joinCode_key" ON "gyms"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "gyms_slug_key" ON "gyms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "coaches_userId_key" ON "coaches"("userId");

-- CreateIndex
CREATE INDEX "class_bookings_classId_bookedForDate_idx" ON "class_bookings"("classId", "bookedForDate");

-- CreateIndex
CREATE UNIQUE INDEX "gym_join_requests_gymId_userId_key" ON "gym_join_requests"("gymId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_registrationRef_key" ON "event_registrations"("registrationRef");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_eventId_athleteId_key" ON "event_registrations"("eventId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_athleteId_division_key" ON "rankings"("athleteId", "division");

-- CreateIndex
CREATE INDEX "outbound_mail_createdAt_idx" ON "outbound_mail"("createdAt" DESC);
