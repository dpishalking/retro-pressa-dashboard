import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import { MotivationAccessError, requireMotivationManager } from "@/lib/motivation/access";
import {
  applyMetricAdjustment,
  confirmReviewWinner,
  createPeriodFromPrevious,
  forceRecalculate,
  getMotivationPagePayload,
  linkManagerAuthUser,
  setPeriodStatus,
  upsertResource,
  upsertRule,
  upsertUpdate
} from "@/lib/motivation/service";
import type { MonthlyUpdate, MotivationPeriod, MotivationRule, SalesResource } from "@/types/motivation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = requireMotivationManager(readSessionCookie(request.headers.get("cookie")));
    const body = (await request.json()) as {
      action?: string;
      periodId?: string;
      month?: number;
      year?: number;
      copyFromPeriodId?: string;
      status?: MotivationPeriod["status"];
      rule?: Partial<MotivationRule> & { periodId: string; title: string };
      update?: Partial<MonthlyUpdate> & {
        periodId: string;
        title: string;
        category: MonthlyUpdate["category"];
      };
      resource?: Partial<SalesResource> & { title: string; type: SalesResource["type"]; url: string };
      managerId?: string;
      metricName?: string;
      newValue?: number;
      reason?: string;
      ruleId?: string;
      authUserId?: string | null;
      viewAsManagerId?: string | null;
    };

    switch (body.action) {
      case "create_period": {
        if (!body.month || !body.year) {
          return NextResponse.json({ error: "Укажите месяц и год" }, { status: 400 });
        }
        const period = await createPeriodFromPrevious({
          session,
          month: body.month,
          year: body.year,
          copyFromPeriodId: body.copyFromPeriodId
        });
        return NextResponse.json({ period });
      }
      case "set_period_status": {
        if (!body.periodId || !body.status) {
          return NextResponse.json({ error: "Укажите период и статус" }, { status: 400 });
        }
        const period = await setPeriodStatus({
          session,
          periodId: body.periodId,
          status: body.status
        });
        return NextResponse.json({ period });
      }
      case "upsert_rule": {
        if (!body.rule) return NextResponse.json({ error: "Нет данных правила" }, { status: 400 });
        const rule = await upsertRule({ session, rule: body.rule });
        return NextResponse.json({ rule });
      }
      case "upsert_update": {
        if (!body.update) return NextResponse.json({ error: "Нет данных обновления" }, { status: 400 });
        const update = await upsertUpdate({ session, update: body.update });
        return NextResponse.json({ update });
      }
      case "upsert_resource": {
        if (!body.resource) return NextResponse.json({ error: "Нет данных инструмента" }, { status: 400 });
        const resource = await upsertResource({ session, resource: body.resource });
        return NextResponse.json({ resource });
      }
      case "adjust_metric": {
        if (!body.periodId || !body.managerId || !body.metricName || body.newValue == null || !body.reason) {
          return NextResponse.json({ error: "Заполните поля корректировки" }, { status: 400 });
        }
        const adjustment = await applyMetricAdjustment({
          session,
          periodId: body.periodId,
          managerId: body.managerId,
          metricName: body.metricName,
          newValue: body.newValue,
          reason: body.reason
        });
        return NextResponse.json({ adjustment });
      }
      case "confirm_winner": {
        if (!body.periodId || !body.ruleId || !body.managerId) {
          return NextResponse.json({ error: "Укажите победителя" }, { status: 400 });
        }
        await confirmReviewWinner({
          session,
          periodId: body.periodId,
          ruleId: body.ruleId,
          managerId: body.managerId
        });
        return NextResponse.json({ ok: true });
      }
      case "recalculate": {
        if (!body.periodId) return NextResponse.json({ error: "Укажите период" }, { status: 400 });
        await forceRecalculate(body.periodId, session.accessLevel);
        const payload = await getMotivationPagePayload({
          session,
          periodId: body.periodId,
          viewAsManagerId: body.viewAsManagerId
        });
        return NextResponse.json({ ok: true, payload });
      }
      case "link_manager": {
        if (!body.managerId) return NextResponse.json({ error: "Укажите менеджера" }, { status: 400 });
        const manager = await linkManagerAuthUser({
          session,
          managerId: body.managerId,
          authUserId: body.authUserId ?? null
        });
        return NextResponse.json({ manager });
      }
      default:
        return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof MotivationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Ошибка управления мотивацией";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
