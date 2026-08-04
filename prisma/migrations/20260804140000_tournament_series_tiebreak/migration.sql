-- Snapshot fantapunti di lega a entry + score/vincitore serie per spareggi.

ALTER TABLE "TournamentTeamEntry"
ADD COLUMN "seedFantapunti" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "TournamentFixture"
ADD COLUMN "homeFantapunti" DECIMAL(8,2),
ADD COLUMN "awayFantapunti" DECIMAL(8,2),
ADD COLUMN "seriesWinnerTeamId" TEXT;

CREATE INDEX "TournamentFixture_seriesWinnerTeamId_idx"
  ON "TournamentFixture"("seriesWinnerTeamId");

ALTER TABLE "TournamentFixture"
ADD CONSTRAINT "TournamentFixture_seriesWinnerTeamId_fkey"
FOREIGN KEY ("seriesWinnerTeamId") REFERENCES "FantasyTeam"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
