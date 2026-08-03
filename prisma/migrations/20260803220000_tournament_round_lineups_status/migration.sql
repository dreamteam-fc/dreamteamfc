-- Per-round lineup lifecycle (DRAFT → OPEN → LOCKED), aligned with league matchdays.
CREATE TYPE "TournamentRoundLineupsStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED');

ALTER TABLE "TournamentRound"
ADD COLUMN "lineupsStatus" "TournamentRoundLineupsStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill from legacy Tournament.lineupsOpen + round activity.
UPDATE "TournamentRound" AS tr
SET "lineupsStatus" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "TournamentRequiredVotePlayer" rv
    WHERE rv."roundId" = tr.id
  )
  OR EXISTS (
    SELECT 1
    FROM "TournamentFixture" tf
    WHERE tf."roundId" = tr.id
      AND tf.status = 'COMPLETED'
  ) THEN 'LOCKED'::"TournamentRoundLineupsStatus"
  WHEN EXISTS (
    SELECT 1
    FROM "Tournament" t
    WHERE t.id = tr."tournamentId"
      AND t."lineupsOpen" = true
  )
  AND EXISTS (
    SELECT 1
    FROM "TournamentFixture" tf
    WHERE tf."roundId" = tr.id
      AND tf.status = 'READY'
  ) THEN 'OPEN'::"TournamentRoundLineupsStatus"
  WHEN EXISTS (
    SELECT 1
    FROM "Tournament" t
    WHERE t.id = tr."tournamentId"
      AND t."lineupsOpen" = false
  )
  AND EXISTS (
    SELECT 1
    FROM "TournamentFixture" tf
    WHERE tf."roundId" = tr.id
      AND tf.status = 'READY'
  ) THEN 'LOCKED'::"TournamentRoundLineupsStatus"
  ELSE 'DRAFT'::"TournamentRoundLineupsStatus"
END;

-- Sync denormalized tournament flag from per-round OPEN status.
UPDATE "Tournament" AS t
SET "lineupsOpen" = EXISTS (
  SELECT 1
  FROM "TournamentRound" tr
  WHERE tr."tournamentId" = t.id
    AND tr."lineupsStatus" = 'OPEN'
);

CREATE INDEX "TournamentRound_lineupsStatus_idx" ON "TournamentRound"("lineupsStatus");
