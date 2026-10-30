CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "EmailCategory" AS ENUM (
    'LINKEDIN_NOTIFICATION',
    'JOB_OPPORTUNITY',
    'RECRUITER',
    'COMPANY',
    'PERSONAL',
    'OTHER'
);

CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" "EmailCategory" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Email_gmailMessageId_key" ON "Email"("gmailMessageId");

CREATE INDEX "Email_category_receivedAt_idx" ON "Email"("category", "receivedAt");
