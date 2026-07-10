import { NextResponse } from "next/server";
import { askGa4Analytics } from "@/lib/ga4-analytics-ask";
import { syncGa4Traffic } from "@/lib/google/ga4-connector";
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

    const question = String(body.question ?? "").trim();
    if (!question) {
      return NextResponse.json({ error: "Вопрос не может быть пустым." }, { status: 400 });
    }

    const period = periods.includes(body.period as PeriodKey) ? body.period as PeriodKey : "july-2026";
    const ga4 = await syncGa4Traffic({ period, refresh: body.refresh === true });
    const marketingSnapshot = await readGoogleTrafficSnapshot(period);
    const marketing = marketingSnapshot?.summary
      ? {
        paidLeads: marketingSnapshot.summary.paidLeads,
        organicLeads: marketingSnapshot.summary.organicLeads,
        adSpend: marketingSnapshot.summary.spend,
        ql: marketingSnapshot.summary.ql
      }
      : undefined;

    const result = await askGa4Analytics(question, ga4, marketing);

    return NextResponse.json({
      ...result,
      ga4Summary: ga4.summary,
      ga4ByChannel: ga4.byChannel,
      period
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось ответить на вопрос по GA4";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
