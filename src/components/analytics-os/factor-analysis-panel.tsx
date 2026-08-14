"use client";

import Link from "next/link";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import { buildFactorAnalysisFromSnapshot, type FactorRow } from "@/lib/analytics-os/factor-analysis";
import { eur, number } from "@/lib/format";

function toneClass(tone: FactorRow["tone"]): string {
  if (tone === "hurt") return "aos-factor-card--hurt";
  if (tone === "help") return "aos-factor-card--help";
  return "aos-factor-card--neutral";
}

function euroLabel(value: number | null): string {
  if (value == null) return "это не евро, а объяснение";
  if (value > 0) return `+${eur(value)} к темпу`;
  if (value < 0) return `${eur(value)} к темпу`;
  return "почти ноль";
}

export function FactorAnalysisPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const report = buildFactorAnalysisFromSnapshot(snapshot);
  const moneyFactors = report.factors.filter((row) => row.euroEffect != null);
  const storyFactors = report.factors.filter((row) => row.euroEffect == null);

  return (
    <>
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Что случилось с выручкой</h2>
            <p>
              Простыми словами: лиды, конверсия и чек. Сравнение с планом за {report.daysElapsed} из{" "}
              {report.calendarDays} дней.
            </p>
          </div>
        </div>
        <p className="aos-factor-headline">{report.headline}</p>
        <div className="aos-plan__grid">
          <div>
            <span>ПЛАН MTD</span>
            <strong>{report.planMtd == null ? "—" : eur(report.planMtd)}</strong>
          </div>
          <div>
            <span>ФАКТ</span>
            <strong>{report.fact == null ? "—" : eur(report.fact)}</strong>
          </div>
          <div>
            <span>РАЗРЫВ</span>
            <strong>{report.gapMtd == null ? "—" : eur(report.gapMtd)}</strong>
          </div>
          <div>
            <span>ОСТАЛОСЬ ДНЕЙ</span>
            <strong>{number(report.daysRemaining)}</strong>
          </div>
        </div>
        {report.planMonth != null ? (
          <p className="aos-muted" style={{ marginTop: "0.75rem" }}>
            План всего месяца {eur(report.planMonth)} — его не сравниваем с фактом середины месяца.
          </p>
        ) : null}
        <DecisionBrief title="Куда жать" body={report.pressNow} />
        <p style={{ margin: "0.75rem 0 0" }}>
          <Link href={report.pressHref} className="font-bold text-blue-700 hover:underline">
            Открыть этот рычаг →
          </Link>
        </p>
      </section>

      {moneyFactors.length ? (
        <section className="aos-card">
          <div className="aos-section-head">
            <div>
              <h2>Три рычага выручки</h2>
              <p>Выручка ≈ лиды × конверсия × чек. Сумма вкладов сходится с разрывом.</p>
            </div>
          </div>
          <div className="aos-factor-grid">
            {moneyFactors.map((row) => (
              <article key={row.id} className={`aos-factor-card ${toneClass(row.tone)}`}>
                <header>
                  <h3>{row.title}</h3>
                  <strong>{euroLabel(row.euroEffect)}</strong>
                </header>
                <p>{row.whatHappened}</p>
                <p className="aos-factor-card__press">{row.press}</p>
                <Link href={row.href}>Перейти →</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {storyFactors.length ? (
        <section className="aos-card">
          <div className="aos-section-head">
            <div>
              <h2>Где ещё жать</h2>
              <p>Это не вторые евро в сумме, а подсказка, какой экран открыть.</p>
            </div>
          </div>
          <div className="aos-factor-grid">
            {storyFactors.map((row) => (
              <article key={row.id} className={`aos-factor-card ${toneClass(row.tone)}`}>
                <header>
                  <h3>{row.title}</h3>
                </header>
                <p>{row.whatHappened}</p>
                <p className="aos-factor-card__press">{row.press}</p>
                <Link href={row.href}>Перейти →</Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Честно про данные</h2>
            <p>Учитываем только то, что есть в кассе, СВОД и Bitrix.</p>
          </div>
        </div>
        <ul className="aos-factor-notes">
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
