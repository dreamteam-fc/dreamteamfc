-- FantasyRoster league-wide player exclusivity:
-- denormalize leagueId from FantasyTeam + UNIQUE(leagueId, playerId).
--
-- Pre-deploy check (2026-08-03, local DB): 4 duplicate (leagueId, playerId) groups
-- in league cmsa9jr300001tz4wt6cgdm83:
--   Akanji, Acerbi, Adams C., Addai — each on squadra1lega1 (older) and squadra2lega1 (newer).
-- Resolution: keep oldest FantasyRoster row per (leagueId, playerId) by createdAt/id;
-- delete the newer extras (4 rows removed from squadra2lega1).

-- AlterTable
ALTER TABLE "FantasyRoster" ADD COLUMN "leagueId" TEXT;

-- Backfill from owning FantasyTeam
UPDATE "FantasyRoster" AS fr
SET "leagueId" = ft."leagueId"
FROM "FantasyTeam" AS ft
WHERE ft.id = fr."fantasyTeamId";

-- Fail clearly if any row could not be backfilled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FantasyRoster" WHERE "leagueId" IS NULL) THEN
    RAISE EXCEPTION 'FantasyRoster.leagueId backfill failed: rows with NULL leagueId remain';
  END IF;
END $$;

-- Remove cross-team duplicates in the same league (keep oldest entry)
DELETE FROM "FantasyRoster" AS fr
WHERE fr.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "leagueId", "playerId"
        ORDER BY "createdAt" ASC, id ASC
      ) AS rn
    FROM "FantasyRoster"
  ) AS ranked
  WHERE ranked.rn > 1
);

-- Enforce NOT NULL after backfill + dedupe
ALTER TABLE "FantasyRoster" ALTER COLUMN "leagueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FantasyRoster_leagueId_idx" ON "FantasyRoster"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyRoster_leagueId_playerId_key" ON "FantasyRoster"("leagueId", "playerId");

-- AddForeignKey
ALTER TABLE "FantasyRoster" ADD CONSTRAINT "FantasyRoster_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
