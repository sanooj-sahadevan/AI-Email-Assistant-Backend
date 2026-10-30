ALTER TABLE "NotificationConfig"
  ALTER COLUMN "enabledCategories" SET DEFAULT ARRAY['LINKEDIN_NOTIFICATION']::TEXT[],
  ALTER COLUMN "recipientPhone" SET DEFAULT '+917994811405';

UPDATE "NotificationConfig"
SET
  "enabledCategories" = ARRAY['LINKEDIN_NOTIFICATION']::TEXT[],
  "recipientPhone" = '+917994811405'
WHERE "id" = 'primary'
  AND "enabledCategories" = ARRAY['JOB_OPPORTUNITY', 'RECRUITER']::TEXT[]
  AND "recipientPhone" = '+15551234567';
