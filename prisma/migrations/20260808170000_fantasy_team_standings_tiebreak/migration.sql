-- Admin tie-break for league standings when points, fantapunti and GD are equal.
ALTER TABLE "FantasyTeam" ADD COLUMN "standingsTieBreakRank" INTEGER;
