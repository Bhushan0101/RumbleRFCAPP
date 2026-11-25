-- CreateTable
CREATE TABLE "gym_enquiry_followups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "enquiryId" INTEGER NOT NULL,
    "askedById" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "askedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    CONSTRAINT "gym_enquiry_followups_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "gym_enquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_gym_onboarding_tokens" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "enquiryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" INTEGER NOT NULL,
    "usedAt" DATETIME,
    "kind" TEXT NOT NULL DEFAULT 'onboarding',
    CONSTRAINT "gym_onboarding_tokens_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "gym_enquiries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_gym_onboarding_tokens" ("createdAt", "enquiryId", "expiresAt", "token", "usedAt") SELECT "createdAt", "enquiryId", "expiresAt", "token", "usedAt" FROM "gym_onboarding_tokens";
DROP TABLE "gym_onboarding_tokens";
ALTER TABLE "new_gym_onboarding_tokens" RENAME TO "gym_onboarding_tokens";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "gym_enquiry_followups_enquiryId_idx" ON "gym_enquiry_followups"("enquiryId");
