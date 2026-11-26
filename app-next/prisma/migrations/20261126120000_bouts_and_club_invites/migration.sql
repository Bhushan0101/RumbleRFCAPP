-- Two-sided bout confirmation + club-initiated flows.

-- EventRegistration gains confirmedAt + boutRef for paired offers.
ALTER TABLE "event_registrations" ADD COLUMN "confirmedAt" DATETIME;
ALTER TABLE "event_registrations" ADD COLUMN "boutRef" TEXT;
ALTER TABLE "event_registrations" ADD COLUMN "raisedByGymId" INTEGER;
CREATE INDEX "event_registrations_boutRef_idx" ON "event_registrations"("boutRef");

-- Club-initiated fighter invite (club → fighter).
CREATE TABLE "club_fighter_invites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gymId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "invitedById" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "club_fighter_invites_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "club_fighter_invites_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "club_fighter_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "club_fighter_invites_gymId_athleteId_key" ON "club_fighter_invites"("gymId", "athleteId");
CREATE INDEX "club_fighter_invites_athleteId_status_idx" ON "club_fighter_invites"("athleteId", "status");
