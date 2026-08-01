import {
  TournamentFixtureStatus,
  TournamentStatus
} from "@prisma/client";

import { prisma } from "@/lib/prisma.ts";
import {
  buildRoundPlans,
  pairFirstRoundAvoidingSameLeague,
  rankSeedCandidates
} from "@/lib/tournaments/pair-seeds.ts";
import { isPowerOfTwo } from "@/lib/tournaments/bracket-size.ts";

export async function generateTournamentBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      entries: {
        select: {
          id: true,
          fantasyTeamId: true,
          seedPoints: true,
          sourceLeagueId: true,
          fantasyTeam: {
            select: {
              name: true
            }
          }
        }
      },
      _count: {
        select: {
          rounds: true
        }
      }
    }
  });

  if (!tournament) {
    throw new Error("Torneo non trovato.");
  }

  if (tournament.status !== TournamentStatus.ENTRIES_SET) {
    throw new Error(
      "Genera il tabellone solo dopo aver salvato il roster (stato: squadre selezionate)."
    );
  }

  if (tournament._count.rounds > 0) {
    throw new Error("Il tabellone e gia stato generato.");
  }

  if (!isPowerOfTwo(tournament.entries.length)) {
    throw new Error("Il roster deve avere 4, 8 o 16 squadre.");
  }

  const seeded = rankSeedCandidates(
    tournament.entries.map((entry) => ({
      entryId: entry.id,
      fantasyTeamId: entry.fantasyTeamId,
      leagueId: entry.sourceLeagueId,
      name: entry.fantasyTeam.name,
      seedPoints: entry.seedPoints
    }))
  );

  const firstRoundPairs = pairFirstRoundAvoidingSameLeague(seeded);
  const roundPlans = buildRoundPlans(seeded.length);

  await prisma.$transaction(async (tx) => {
    for (const seededTeam of seeded) {
      await tx.tournamentTeamEntry.update({
        where: { id: seededTeam.entryId },
        data: { seedRank: seededTeam.seedRank }
      });
    }

    for (const plan of roundPlans) {
      const round = await tx.tournamentRound.create({
        data: {
          isFinal: plan.isFinal,
          name: plan.name,
          roundIndex: plan.roundIndex,
          tournamentId: tournament.id
        },
        select: { id: true }
      });

      for (let slot = 0; slot < plan.bracketSlots; slot += 1) {
        const seriesKey = `${plan.roundIndex}-${slot}`;
        const legs = plan.twoLegs ? [1, 2] : [1];

        for (const leg of legs) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;
          let status: TournamentFixtureStatus = TournamentFixtureStatus.SCHEDULED;

          if (plan.roundIndex === 0) {
            const pair = firstRoundPairs[slot];
            // Leg 1: home = seed alto; leg 2: campi invertiti
            if (leg === 1) {
              homeTeamId = pair.home.fantasyTeamId;
              awayTeamId = pair.away.fantasyTeamId;
            } else {
              homeTeamId = pair.away.fantasyTeamId;
              awayTeamId = pair.home.fantasyTeamId;
            }
            status = TournamentFixtureStatus.READY;
          }

          await tx.tournamentFixture.create({
            data: {
              awayTeamId,
              bracketSlot: slot,
              homeTeamId,
              leg,
              roundId: round.id,
              seriesKey,
              status
            }
          });
        }
      }
    }

    await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        status: TournamentStatus.BRACKET_GENERATED
      }
    });
  });

  return {
    name: tournament.name,
    pairs: firstRoundPairs.length,
    rounds: roundPlans.length,
    tournamentId: tournament.id
  };
}

export async function getTournamentBracketPageData(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      lineupsOpen: true,
      entries: {
        orderBy: [{ seedRank: "asc" }, { seedPoints: "desc" }],
        select: {
          activatedAt: true,
          fantasyTeamId: true,
          seedPoints: true,
          seedRank: true,
          sourceLeague: {
            select: {
              name: true
            }
          },
          fantasyTeam: {
            select: {
              name: true
            }
          }
        }
      },
      rounds: {
        orderBy: { roundIndex: "asc" },
        select: {
          id: true,
          isFinal: true,
          name: true,
          roundIndex: true,
          requiredVotes: {
            select: {
              status: true
            }
          },
          _count: {
            select: {
              playerVotes: true
            }
          },
          fixtures: {
            orderBy: [{ bracketSlot: "asc" }, { leg: "asc" }],
            select: {
              id: true,
              awayGoals: true,
              awayTeamId: true,
              bracketSlot: true,
              homeGoals: true,
              homeTeamId: true,
              leg: true,
              seriesKey: true,
              status: true,
              awayTeam: {
                select: {
                  id: true,
                  name: true
                }
              },
              homeTeam: {
                select: {
                  id: true,
                  name: true
                }
              },
              lineups: {
                select: {
                  fantasyTeamId: true,
                  status: true,
                  fantasyTeam: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return tournament;
}
