import { syncRopLast7DaysReport } from "@/lib/rop-weekly/last-7-days";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const endArg = process.argv.find((arg) => arg.startsWith("--end="));
  const result = await syncRopLast7DaysReport({
    dryRun,
    endDay: endArg?.slice("--end=".length)
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
