/**
 * Patch giftTypes/products/leadId on SPA paidDeals inside local Bitrix snapshots
 * without a full crm.deal.list rebuild (avoids Bitrix "Too many requests").
 *
 * Usage: npx tsx --env-file=.env.local scripts/patch-snapshot-gift-types.ts [july-2026] [august-2026]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listPaidSmartInvoicesForPeriod } from "@/lib/bitrix/smart-invoices";
import type { BitrixSnapshot } from "@/lib/bitrix/snapshot-store";

const ROOT = process.cwd();

async function patchPeriod(period: string) {
  const file = path.join(ROOT, "data", "bitrix-snapshots", `${period}.json`);
  const snap = JSON.parse(await readFile(file, "utf8")) as BitrixSnapshot;
  const start = snap.periodStart.slice(0, 10);
  const end = (snap.factualEnd || snap.periodEnd).slice(0, 10);
  console.log(`patch ${period} paid invoices ${start}..${end}`);
  const fresh = await listPaidSmartInvoicesForPeriod(start, end);
  const byId = new Map(fresh.map((deal) => [deal.id, deal]));
  let updated = 0;
  let withGift = 0;
  snap.paidDeals = (snap.paidDeals || []).map((deal) => {
    const next = byId.get(deal.id);
    if (!next) return deal;
    updated += 1;
    if (next.giftTypes?.length) withGift += 1;
    return {
      ...deal,
      leadId: next.leadId || deal.leadId,
      giftTypes: next.giftTypes || [],
      products: next.products?.length ? next.products : deal.products
    };
  });
  // Include any invoices missing from the older snapshot.
  const existing = new Set((snap.paidDeals || []).map((deal) => deal.id));
  for (const deal of fresh) {
    if (existing.has(deal.id)) continue;
    snap.paidDeals.push(deal);
    updated += 1;
    if (deal.giftTypes?.length) withGift += 1;
  }
  snap.createdAt = new Date().toISOString();
  await writeFile(file, JSON.stringify(snap));
  console.log({
    period,
    paidDeals: snap.paidDeals.length,
    updated,
    withGift,
    coverage: `${Math.round((withGift / Math.max(1, snap.paidDeals.length)) * 100)}%`
  });
}

async function main() {
  const periods = process.argv.slice(2);
  const list = periods.length ? periods : ["july-2026", "august-2026"];
  for (const period of list) {
    await patchPeriod(period);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
