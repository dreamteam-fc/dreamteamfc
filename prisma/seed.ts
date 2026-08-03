import {
  LeagueRole,
  LeagueStatus,
  LineupStatus,
  MatchdayStatus,
  PlayerRole,
  PrismaClient,
  SlotType,
  UserRole
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_LEAGUE_NAME = "Lega Fantacalcetto Demo";

const demoUsers = [
  {
    email: "admin.demo@fantacalcetto.test",
    displayName: "Admin Demo",
    role: UserRole.ADMIN
  },
  {
    email: "mario.rossi.demo@fantacalcetto.test",
    displayName: "Mario Rossi",
    role: UserRole.USER
  },
  {
    email: "luca.bianchi.demo@fantacalcetto.test",
    displayName: "Luca Bianchi",
    role: UserRole.USER
  },
  {
    email: "giulia.verdi.demo@fantacalcetto.test",
    displayName: "Giulia Verdi",
    role: UserRole.USER
  },
  {
    email: "anna.neri.demo@fantacalcetto.test",
    displayName: "Anna Neri",
    role: UserRole.USER
  }
] as const;

const demoTeams = [
  {
    ownerEmail: "mario.rossi.demo@fantacalcetto.test",
    name: "FC Orion",
    playerNames: [
      "Alessio Ventura",
      "Marco Rinaldi",
      "Simone Greco",
      "Davide Ferri",
      "Nicolo Serra",
      "Tommaso Galli",
      "Lorenzo Piras",
      "Gabriele Sala"
    ]
  },
  {
    ownerEmail: "luca.bianchi.demo@fantacalcetto.test",
    name: "Real Balon",
    playerNames: [
      "Federico Conti",
      "Matteo Villa",
      "Andrea Guidi",
      "Riccardo Testa",
      "Edoardo Fabbri",
      "Pietro Longo",
      "Samuele Caruso",
      "Filippo Donati"
    ]
  },
  {
    ownerEmail: "giulia.verdi.demo@fantacalcetto.test",
    name: "Atletico Riviera",
    playerNames: [
      "Christian Moretti",
      "Leonardo D'Amico",
      "Mattia De Luca",
      "Jacopo Ferrara",
      "Daniele Bellini",
      "Elia Fontana",
      "Francesco Vitali",
      "Michele Rossetti"
    ]
  },
  {
    ownerEmail: "anna.neri.demo@fantacalcetto.test",
    name: "Sporting Navigli",
    playerNames: [
      "Giorgio Marini",
      "Fabio Esposito",
      "Stefano Parisi",
      "Alberto Colombo",
      "Valerio Messina",
      "Antonio Riva",
      "Roberto Fiore",
      "Diego Monti"
    ]
  }
] as const;

const playerTeamNames = [
  "Virtus Milano",
  "Borgo United",
  "Tevere Calcio",
  "Aurora Torino",
  "Maremma FC",
  "Stella Azzurra",
  "Citta del Faro",
  "Polisportiva Etna"
] as const;

const defaultRosterRoles = [
  PlayerRole.GOALKEEPER,
  PlayerRole.DEFENDER,
  PlayerRole.DEFENDER,
  PlayerRole.MIDFIELDER,
  PlayerRole.MIDFIELDER,
  PlayerRole.MIDFIELDER,
  PlayerRole.ATTACKER,
  PlayerRole.ATTACKER
] as const;

function uniquePlayerNames(): string[] {
  return demoTeams.flatMap((team) => team.playerNames);
}

async function seedUsers() {
  const result = new Map<string, { id: string; email: string; displayName: string | null }>();

  for (const user of demoUsers) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role
      },
      select: {
        id: true,
        email: true,
        displayName: true
      }
    });

    result.set(record.email, record);
  }

  return result;
}

async function seedPlayers() {
  const records = new Map<string, { id: string; name: string }>();
  const players = demoTeams.flatMap((team) =>
    team.playerNames.map((name, index) => ({
      name,
      role: defaultRosterRoles[index] ?? PlayerRole.MIDFIELDER
    }))
  );

  for (const [index, playerSeed] of players.entries()) {
    const teamName = playerTeamNames[index % playerTeamNames.length];
    const existingPlayer = await prisma.player.findFirst({
      where: { name: playerSeed.name },
      select: {
        id: true,
        name: true
      }
    });

    const record = existingPlayer
      ? await prisma.player.update({
          where: { id: existingPlayer.id },
          data: {
            role: playerSeed.role,
            teamName,
            isActive: true
          },
          select: {
            id: true,
            name: true
          }
        })
      : await prisma.player.create({
          data: {
            name: playerSeed.name,
            role: playerSeed.role,
            teamName,
            isActive: true
          },
          select: {
            id: true,
            name: true
          }
        });

    records.set(record.name, record);
  }

  return records;
}

async function main() {
  const usersByEmail = await seedUsers();
  const playersByName = await seedPlayers();

  const adminUser = usersByEmail.get("admin.demo@fantacalcetto.test");
  if (!adminUser) {
    throw new Error("Admin demo user not found after seeding.");
  }

  const existingLeague = await prisma.league.findFirst({
    where: { name: DEMO_LEAGUE_NAME },
    select: { id: true }
  });

  const league = existingLeague
    ? await prisma.league.update({
        where: { id: existingLeague.id },
        data: {
          status: LeagueStatus.ACTIVE,
          startersCount: 5,
          maxAutoSubs: 1,
          maxTeams: 8,
          createdById: adminUser.id
        }
      })
    : await prisma.league.create({
        data: {
          name: DEMO_LEAGUE_NAME,
          status: LeagueStatus.ACTIVE,
          startersCount: 5,
          maxAutoSubs: 1,
          maxTeams: 8,
          createdById: adminUser.id
        }
      });

  const leagueMemberEmails = demoUsers.map((user) => user.email);
  for (const email of leagueMemberEmails) {
    const user = usersByEmail.get(email);
    if (!user) {
      throw new Error(`Missing seeded user for ${email}.`);
    }

    await prisma.leagueMember.upsert({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId: user.id
        }
      },
      update: {
        role: email === adminUser.email ? LeagueRole.OWNER : LeagueRole.MEMBER
      },
      create: {
        leagueId: league.id,
        userId: user.id,
        role: email === adminUser.email ? LeagueRole.OWNER : LeagueRole.MEMBER
      }
    });
  }

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const matchday = await prisma.matchday.upsert({
    where: {
      leagueId_number: {
        leagueId: league.id,
        number: 1
      }
    },
    update: {
      status: MatchdayStatus.LINEUPS_OPEN,
      lineupDeadlineAt: deadline
    },
    create: {
      leagueId: league.id,
      number: 1,
      status: MatchdayStatus.LINEUPS_OPEN,
      lineupDeadlineAt: deadline
    }
  });

  for (const teamSeed of demoTeams) {
    const owner = usersByEmail.get(teamSeed.ownerEmail);
    if (!owner) {
      throw new Error(`Missing team owner ${teamSeed.ownerEmail}.`);
    }

    const fantasyTeam = await prisma.fantasyTeam.upsert({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId: owner.id
        }
      },
      update: {
        name: teamSeed.name
      },
      create: {
        leagueId: league.id,
        userId: owner.id,
        name: teamSeed.name
      }
    });

    const rosterPlayerIds = teamSeed.playerNames.map((playerName) => {
      const player = playersByName.get(playerName);
      if (!player) {
        throw new Error(`Missing player ${playerName}.`);
      }

      return player.id;
    });

    await prisma.fantasyRoster.deleteMany({
      where: {
        fantasyTeamId: fantasyTeam.id
      }
    });

    await prisma.fantasyRoster.createMany({
      data: rosterPlayerIds.map((playerId) => ({
        fantasyTeamId: fantasyTeam.id,
        leagueId: fantasyTeam.leagueId,
        playerId
      })),
      skipDuplicates: true
    });

    const lineup = await prisma.lineup.upsert({
      where: {
        fantasyTeamId_matchdayId: {
          fantasyTeamId: fantasyTeam.id,
          matchdayId: matchday.id
        }
      },
      update: {
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date()
      },
      create: {
        fantasyTeamId: fantasyTeam.id,
        matchdayId: matchday.id,
        status: LineupStatus.SUBMITTED,
        submittedAt: new Date()
      }
    });

    await prisma.lineupPlayer.deleteMany({
      where: {
        lineupId: lineup.id
      }
    });

    const starters = rosterPlayerIds.slice(0, 5);
    const bench = rosterPlayerIds.slice(5, 8);

    await prisma.lineupPlayer.createMany({
      data: [
        ...starters.map((playerId, index) => ({
          lineupId: lineup.id,
          playerId,
          slotType: SlotType.STARTER,
          positionOrder: index + 1
        })),
        ...bench.map((playerId, index) => ({
          lineupId: lineup.id,
          playerId,
          slotType: SlotType.BENCH,
          positionOrder: index + 1
        }))
      ]
    });
  }

  console.log(`Seed completato per la lega demo "${league.name}".`);
}

main()
  .catch((error) => {
    console.error("Errore durante il seed demo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
