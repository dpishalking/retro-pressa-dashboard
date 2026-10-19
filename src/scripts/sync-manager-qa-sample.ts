import { syncManagerQaSample } from "@/lib/manager-qa-sample/sync";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const weekOfArg = process.argv.find((arg) => arg.startsWith("--week="));
  const weekOf = weekOfArg?.slice("--week=".length);
  const result = await syncManagerQaSample({ dryRun, weekOf });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
