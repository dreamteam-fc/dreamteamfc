import { execSync } from "node:child_process";

const commands = [
  "npm run prisma:validate",
  "npm run prisma:generate",
  "npm run scoring:check",
  "npm run fixtures:check",
  "npm run schedule:check",
  "npm run roster-freeze:check",
  "npm run build",
];

console.log("🚀 Avvio controlli Fantacalcetto...");

for (const command of commands) {
  console.log("\n============================================================");
  console.log(`▶ ${command}`);
  console.log("============================================================\n");

  try {
    execSync(command, {
      stdio: "inherit",
      shell: true,
    });
  } catch {
    console.error("\n============================================================");
    console.error("❌ Check interrotti");
    console.error("============================================================");
    console.error(`Comando fallito: ${command}`);
    process.exit(1);
  }
}

console.log("\n============================================================");
console.log("✅ Tutti i controlli sono passati");
console.log("============================================================");