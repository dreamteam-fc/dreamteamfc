-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'ENTRIES_SET', 'BRACKET_GENERATED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "passwordHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeamEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "sourceLeagueId" TEXT NOT NULL,
    "seedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTeamEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_createdById_idx" ON "Tournament"("createdById");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "TournamentTeamEntry_tournamentId_idx" ON "TournamentTeamEntry"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentTeamEntry_sourceLeagueId_idx" ON "TournamentTeamEntry"("sourceLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamEntry_tournamentId_fantasyTeamId_key" ON "TournamentTeamEntry"("tournamentId", "fantasyTeamId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamEntry" ADD CONSTRAINT "TournamentTeamEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamEntry" ADD CONSTRAINT "TournamentTeamEntry_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamEntry" ADD CONSTRAINT "TournamentTeamEntry_sourceLeagueId_fkey" FOREIGN KEY ("sourceLeagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
