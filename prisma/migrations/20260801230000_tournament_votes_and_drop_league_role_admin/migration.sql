-- LeagueRole: drop unused ADMIN value
UPDATE "LeagueMember" SET "role" = 'MEMBER' WHERE "role" = 'ADMIN';

CREATE TYPE "LeagueRole_new" AS ENUM ('OWNER', 'MEMBER');
ALTER TABLE "LeagueMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "LeagueMember"
  ALTER COLUMN "role" TYPE "LeagueRole_new"
  USING ("role"::text::"LeagueRole_new");
ALTER TYPE "LeagueRole" RENAME TO "LeagueRole_old";
ALTER TYPE "LeagueRole_new" RENAME TO "LeagueRole";
DROP TYPE "LeagueRole_old";
ALTER TABLE "LeagueMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- Tournament votes scoped to round
CREATE TABLE "TournamentRequiredVotePlayer" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "RequiredVoteStatus" NOT NULL DEFAULT 'PENDING',
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRequiredVotePlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TournamentPlayerVote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'PENDING',
    "isSv" BOOLEAN NOT NULL DEFAULT false,
    "baseVote" DECIMAL(4,2),
    "goals" INTEGER NOT NULL DEFAULT 0,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "penaltiesMissed" INTEGER NOT NULL DEFAULT 0,
    "penaltiesSaved" INTEGER NOT NULL DEFAULT 0,
    "penaltiesScored" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" INTEGER NOT NULL DEFAULT 0,
    "finalFantavote" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPlayerVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentRequiredVotePlayer_status_idx" ON "TournamentRequiredVotePlayer"("status");
CREATE UNIQUE INDEX "TournamentRequiredVotePlayer_roundId_playerId_key" ON "TournamentRequiredVotePlayer"("roundId", "playerId");
CREATE INDEX "TournamentPlayerVote_status_isSv_idx" ON "TournamentPlayerVote"("status", "isSv");
CREATE UNIQUE INDEX "TournamentPlayerVote_roundId_playerId_key" ON "TournamentPlayerVote"("roundId", "playerId");

ALTER TABLE "TournamentRequiredVotePlayer" ADD CONSTRAINT "TournamentRequiredVotePlayer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentRequiredVotePlayer" ADD CONSTRAINT "TournamentRequiredVotePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TournamentPlayerVote" ADD CONSTRAINT "TournamentPlayerVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentPlayerVote" ADD CONSTRAINT "TournamentPlayerVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
