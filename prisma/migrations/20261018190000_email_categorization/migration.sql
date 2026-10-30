ALTER TABLE "Email"
    ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "classificationReason" TEXT;

CREATE INDEX "Email_isRead_idx" ON "Email"("isRead");
