-- CreateEnum
CREATE TYPE "LineupSource" AS ENUM ('USER', 'AUTO_CARRIED', 'ADMIN_RANDOM');

-- AlterTable Lineup
ALTER TABLE "Lineup" ADD COLUMN "source" "LineupSource" NOT NULL DEFAULT 'USER';

-- AlterTable TournamentLineup
ALTER TABLE "TournamentLineup" ADD COLUMN "source" "LineupSource" NOT NULL DEFAULT 'USER';

-- AlterTable TeamScore
ALTER TABLE "TeamScore" ADD COLUMN "fantapuntiPenalty" DECIMAL(4,2) NOT NULL DEFAULT 0;
ALTER TABLE "TeamScore" ADD COLUMN "leaguePointsPenalty" INTEGER NOT NULL DEFAULT 0;

-- Indexes for auto-carry lookups
CREATE INDEX "Lineup_fantasyTeamId_source_idx" ON "Lineup"("fantasyTeamId", "source");
CREATE INDEX "TournamentLineup_fantasyTeamId_source_idx" ON "TournamentLineup"("fantasyTeamId", "source");
