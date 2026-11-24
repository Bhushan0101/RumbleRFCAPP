-- CreateTable
CREATE TABLE "verification_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "athleteId" INTEGER,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME,
    "verifiedById" INTEGER,
    CONSTRAINT "verification_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "verification_requests_userId_createdAt_idx" ON "verification_requests"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "verification_requests_status_createdAt_idx" ON "verification_requests"("status", "createdAt" DESC);
