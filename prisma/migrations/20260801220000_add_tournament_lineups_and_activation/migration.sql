-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "lineupsOpen" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TournamentTeamEntry" ADD COLUMN "activatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TournamentLineup" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "tournamentFixtureId" TEXT NOT NULL,
    "status" "LineupStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentLineupPlayer" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotType" "SlotType" NOT NULL,
    "positionOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentLineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentLineup_tournamentFixtureId_status_idx" ON "TournamentLineup"("tournamentFixtureId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentLineup_fantasyTeamId_tournamentFixtureId_key" ON "TournamentLineup"("fantasyTeamId", "tournamentFixtureId");

-- CreateIndex
CREATE INDEX "TournamentLineupPlayer_playerId_idx" ON "TournamentLineupPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentLineupPlayer_lineupId_playerId_key" ON "TournamentLineupPlayer"("lineupId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentLineupPlayer_lineupId_slotType_positionOrder_key" ON "TournamentLineupPlayer"("lineupId", "slotType", "positionOrder");

-- AddForeignKey
ALTER TABLE "TournamentLineup" ADD CONSTRAINT "TournamentLineup_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLineup" ADD CONSTRAINT "TournamentLineup_tournamentFixtureId_fkey" FOREIGN KEY ("tournamentFixtureId") REFERENCES "TournamentFixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLineupPlayer" ADD CONSTRAINT "TournamentLineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "TournamentLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentLineupPlayer" ADD CONSTRAINT "TournamentLineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
