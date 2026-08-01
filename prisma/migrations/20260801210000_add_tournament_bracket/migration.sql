-- AlterTable
ALTER TABLE "TournamentTeamEntry" ADD COLUMN "seedRank" INTEGER;

-- CreateEnum
CREATE TYPE "TournamentFixtureStatus" AS ENUM ('SCHEDULED', 'READY', 'COMPLETED');

-- CreateTable
CREATE TABLE "TournamentRound" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentFixture" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "bracketSlot" INTEGER NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "leg" INTEGER NOT NULL DEFAULT 1,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "status" "TournamentFixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentFixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRound_tournamentId_roundIndex_key" ON "TournamentRound"("tournamentId", "roundIndex");

-- CreateIndex
CREATE INDEX "TournamentRound_tournamentId_idx" ON "TournamentRound"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentFixture_roundId_seriesKey_leg_key" ON "TournamentFixture"("roundId", "seriesKey", "leg");

-- CreateIndex
CREATE INDEX "TournamentFixture_roundId_bracketSlot_idx" ON "TournamentFixture"("roundId", "bracketSlot");

-- CreateIndex
CREATE INDEX "TournamentFixture_homeTeamId_idx" ON "TournamentFixture"("homeTeamId");

-- CreateIndex
CREATE INDEX "TournamentFixture_awayTeamId_idx" ON "TournamentFixture"("awayTeamId");

-- AddForeignKey
ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentFixture" ADD CONSTRAINT "TournamentFixture_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentFixture" ADD CONSTRAINT "TournamentFixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentFixture" ADD CONSTRAINT "TournamentFixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
