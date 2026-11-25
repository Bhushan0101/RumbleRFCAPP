-- CreateTable
CREATE TABLE "password_resets" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");
