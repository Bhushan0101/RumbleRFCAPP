-- Fighter asks for extended rankings access. Admin fulfills by minting a
-- RankingShareToken (24h) and emailing the signed link to the requester.
CREATE TABLE "ranking_access_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'full',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" INTEGER,
    "shareToken" TEXT,
    CONSTRAINT "ranking_access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ranking_access_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "portal_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ranking_access_requests_status_createdAt_idx" ON "ranking_access_requests"("status", "createdAt" DESC);
CREATE INDEX "ranking_access_requests_userId_idx" ON "ranking_access_requests"("userId");

CREATE TABLE "ranking_share_tokens" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "scope" TEXT NOT NULL DEFAULT 'full',
    CONSTRAINT "ranking_share_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ranking_share_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "portal_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ranking_share_tokens_userId_idx" ON "ranking_share_tokens"("userId");
CREATE INDEX "ranking_share_tokens_expiresAt_idx" ON "ranking_share_tokens"("expiresAt");
