CREATE TYPE "NotificationStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'SKIPPED'
);

CREATE TYPE "NotificationType" AS ENUM (
    'WHATSAPP_ALERT',
    'TEST'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "emailId" TEXT,
    "gmailMessageId" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'WHATSAPP_ALERT',
    "recipient" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT NOT NULL,
    "category" "EmailCategory",
    "preview" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorDetails" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_gmailMessageId_type_key" ON "Notification"("gmailMessageId", "type");
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "enabledCategories" TEXT[] DEFAULT ARRAY['JOB_OPPORTUNITY', 'RECRUITER']::TEXT[],
    "rules" JSONB NOT NULL DEFAULT '[]',
    "recipientPhone" TEXT NOT NULL DEFAULT '+15551234567',
    "maxSnippetLength" INTEGER NOT NULL DEFAULT 150,
    "initialSyncCutoffHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);
