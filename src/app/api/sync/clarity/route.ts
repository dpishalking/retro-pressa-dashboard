import { NextResponse } from "next/server";
import { askClarityAnalytics } from "@/lib/clarity-analytics-ask";
import { readClaritySnapshot } from "@/lib/clarity/clarity-snapshot-store";
import { syncClarityInsights } from "@/lib/clarity/clarity-connector";
import { readGa4Snapshot } from "@/lib/google/ga4-snapshot-store";
import { readGoogleTrafficSnapshot } from "@/lib/google/snapshot-store";
import type { PeriodKey } from "@/types/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const periods: PeriodKey[] = ["may-2026", "june-2026", "july-2026"];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      question?: string;
      period?: string;
      refresh?: boolean;
    };

    const period = periods.includes(body.period as PeriodKey) ? body.period as PeriodKey : "july-2026";
    const question = body.question?.trim();

    if (question) {
      let clarity = await readClaritySnapshot();
      if (!clarity || body.refresh) {
        await syncClarityInsights({ refresh: true });
        clarity = await readClaritySnapshot();
      }
      if (!clarity) {
        return NextResponse.json({ error: "Clarity snapshot is empty. Configure CLARITY_API_TOKEN." }, { status: 400 });
      }

      const ga4 = await readGa4Snapshot(period);
      const marketing = await readGoogleTrafficSnapshot(period);
      const answer = await askClarityAnalytics(
        question,
        clarity,
        ga4,
        marketing ? {
          paidLeads: marketing.summary.paidLeads,
          organicLeads: marketing.summary.organicLeads,
          adSpend: marketing.summary.spend,
          ql: marketing.summary.ql
        } : undefined
      );

      return NextResponse.json(answer);
    }

    const payload = await syncClarityInsights({ refresh: body.refresh === true });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clarity sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
