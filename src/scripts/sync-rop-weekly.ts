import { syncRopWeeklyReport } from "@/lib/rop-weekly/sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const weekOfArg = process.argv.find((arg) => arg.startsWith("--week="));
  const weekOf = weekOfArg?.slice("--week=".length);
  const result = await syncRopWeeklyReport({ dryRun, weekOf });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
