-- Per-leg lineup lifecycle on TournamentRound (giornata = round + leg).
-- Replaces round-level lineupsStatus with lineupsStatusLeg1 / lineupsStatusLeg2.

ALTER TABLE "TournamentRound"
ADD COLUMN "lineupsStatusLeg1" "TournamentRoundLineupsStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "lineupsStatusLeg2" "TournamentRoundLineupsStatus" NOT NULL DEFAULT 'DRAFT';

-- Copy legacy round status onto both legs.
UPDATE "TournamentRound"
SET
  "lineupsStatusLeg1" = "lineupsStatus",
  "lineupsStatusLeg2" = "lineupsStatus";

-- Finale: leg 2 unused → always DRAFT.
UPDATE "TournamentRound"
SET "lineupsStatusLeg2" = 'DRAFT'::"TournamentRoundLineupsStatus"
WHERE "isFinal" = true;

-- Never leave both legs OPEN after migration (OPEN was round-scoped).
UPDATE "TournamentRound"
SET "lineupsStatusLeg2" = 'DRAFT'::"TournamentRoundLineupsStatus"
WHERE "lineupsStatus" = 'OPEN'::"TournamentRoundLineupsStatus"
  AND "isFinal" = false;

-- Clean slate for tournaments not yet in progress: leg 2 back to DRAFT.
UPDATE "TournamentRound" AS tr
SET "lineupsStatusLeg2" = 'DRAFT'::"TournamentRoundLineupsStatus"
FROM "Tournament" AS t
WHERE t.id = tr."tournamentId"
  AND t.status IN ('DRAFT', 'ENTRIES_SET', 'BRACKET_GENERATED')
  AND tr."isFinal" = false;

-- Sync denormalized tournament flag from any OPEN leg.
UPDATE "Tournament" AS t
SET "lineupsOpen" = EXISTS (
  SELECT 1
  FROM "TournamentRound" AS tr
  WHERE tr."tournamentId" = t.id
    AND (
      tr."lineupsStatusLeg1" = 'OPEN'::"TournamentRoundLineupsStatus"
      OR tr."lineupsStatusLeg2" = 'OPEN'::"TournamentRoundLineupsStatus"
    )
);

DROP INDEX IF EXISTS "TournamentRound_lineupsStatus_idx";

ALTER TABLE "TournamentRound"
DROP COLUMN "lineupsStatus";

CREATE INDEX "TournamentRound_lineupsStatusLeg1_idx"
  ON "TournamentRound"("lineupsStatusLeg1");

CREATE INDEX "TournamentRound_lineupsStatusLeg2_idx"
  ON "TournamentRound"("lineupsStatusLeg2");
