import { prisma } from "../lib/prisma.ts";
import { resetLeagueData } from "../lib/server/admin/reset-league-data.ts";

function hasConfirmationFlag() {
  return process.argv.slice(2).includes("--confirm");
}

async function main() {
  if (!hasConfirmationFlag()) {
    console.warn("Reset non eseguito.");
    console.warn(
      "Questo script elimina tutti i dati di leghe e campionati ma mantiene User e Player."
    );
    console.warn("Per procedere esegui: npm run db:reset-leagues -- --confirm");
    return;
  }

  const summary = await resetLeagueData();

  console.log("Reset dati leghe completato.");
  console.log(`Tournament eliminati: ${summary.tournamentCount}`);
  console.log(`League eliminate: ${summary.leagueCount}`);
  console.log(`Fantasy team eliminate: ${summary.fantasyTeamCount}`);
  console.log(`Matchday eliminate: ${summary.matchdayCount}`);
  console.log(`Lineup eliminate: ${summary.lineupCount}`);
  console.log(`Fantasy fixture eliminate: ${summary.fantasyFixtureCount}`);
  console.log(`Fantasy roster eliminate: ${summary.rosterCount}`);
  console.log(`Player vote eliminati: ${summary.voteCount}`);
  console.log(`Team score eliminati: ${summary.scoreCount}`);
  console.log("User mantenuti.");
  console.log("Player mantenuti.");
  console.log("Supabase Auth users non toccati.");
}

main()
  .catch((error) => {
    console.error("Reset dati leghe fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
