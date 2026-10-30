ALTER TABLE "Email"
    ADD COLUMN "threadId" TEXT,
    ADD COLUMN "body" TEXT,
    ALTER COLUMN "senderEmail" DROP NOT NULL;

CREATE INDEX "Email_receivedAt_idx" ON "Email"("receivedAt");

CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "accountEmail" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GmailOAuthState" (
    "stateHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailOAuthState_pkey" PRIMARY KEY ("stateHash")
);

CREATE INDEX "GmailOAuthState_expiresAt_idx" ON "GmailOAuthState"("expiresAt");
