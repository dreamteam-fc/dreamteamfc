-- Separate tournament vote lists / XLS imports per leg (andata=1, ritorno=2).
-- Existing rows backfill to leg = 1 (andata / finale).

ALTER TABLE "TournamentRequiredVotePlayer"
ADD COLUMN "leg" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TournamentPlayerVote"
ADD COLUMN "leg" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "TournamentRequiredVotePlayer_roundId_playerId_key";
DROP INDEX "TournamentPlayerVote_roundId_playerId_key";

CREATE UNIQUE INDEX "TournamentRequiredVotePlayer_roundId_leg_playerId_key"
ON "TournamentRequiredVotePlayer"("roundId", "leg", "playerId");

CREATE UNIQUE INDEX "TournamentPlayerVote_roundId_leg_playerId_key"
ON "TournamentPlayerVote"("roundId", "leg", "playerId");

CREATE INDEX "TournamentRequiredVotePlayer_roundId_leg_idx"
ON "TournamentRequiredVotePlayer"("roundId", "leg");

CREATE INDEX "TournamentPlayerVote_roundId_leg_idx"
ON "TournamentPlayerVote"("roundId", "leg");
