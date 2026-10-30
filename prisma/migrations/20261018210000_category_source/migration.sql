CREATE TYPE "EmailCategorySource" AS ENUM ('RULE', 'MANUAL');

ALTER TABLE "Email"
ADD COLUMN "categorySource" "EmailCategorySource" NOT NULL DEFAULT 'RULE';
