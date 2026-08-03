-- Product: max 1 auto-sub per role (bench 1P/1D/1C/1A) → ceiling 4 per team.
ALTER TABLE "League" ALTER COLUMN "maxAutoSubs" SET DEFAULT 4;

UPDATE "League" SET "maxAutoSubs" = 4 WHERE "maxAutoSubs" = 1;
