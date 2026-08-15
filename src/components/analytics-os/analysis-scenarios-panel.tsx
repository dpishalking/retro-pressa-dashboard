"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DecisionBrief } from "@/components/analytics-os/decision-brief";
import {
  ANALYSIS_SCENARIOS,
  runAnalysisScenario,
  type ScenarioReadiness,
  type ScenarioStatus
} from "@/lib/analytics-os/analysis-scenarios";
import type { CeoControlCenterSnapshot } from "@/types/analytics-os";

const STATUS_LABEL: Record<ScenarioStatus, string> = {
  healthy: "Здорово",
  attention: "Внимание",
  problem: "Проблема",
  opportunity: "Возможность",
  no_data: "Мало данных"
};

const READY_LABEL: Record<ScenarioReadiness, string> = {
  live: "Считается",
  guided: "Маршрут",
  blocked: "Нет данных"
};

function selectScenario(pathname: string, current: URLSearchParams, id: string): string {
  const params = new URLSearchParams(current.toString());
  if (id) params.set("scenario", id);
  else params.delete("scenario");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function AnalysisScenariosPanel({ snapshot }: { snapshot: CeoControlCenterSnapshot }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("scenario") || ANALYSIS_SCENARIOS[0]?.id || "revenue-plan";
  const selected = runAnalysisScenario(selectedId, snapshot);
  const liveCount = ANALYSIS_SCENARIOS.filter((item) => item.readiness === "live").length;

  return (
    <>
      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Сценарии анализа</h2>
            <p>
              Дашборды отвечают «что происходит». Сценарий — маршрут «почему» и «куда жать». Не вторая аналитика:
              те же сводка, факторы, воронка и план.
            </p>
          </div>
        </div>
        <p className="aos-muted" style={{ margin: 0 }}>
          {liveCount} сценариев считаются по CEO-снимку. Остальные ведут на существующие экраны или честно говорят,
          каких данных нет (Ads API, JTBD, день-к-дню).
        </p>
      </section>

      <section className="aos-card">
        <div className="aos-section-head">
          <div>
            <h2>Выберите вопрос</h2>
            <p>Нажмите сценарий — получите диагноз и следующие экраны.</p>
          </div>
        </div>
        <div className="aos-scenario-grid">
          {ANALYSIS_SCENARIOS.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                className={`aos-scenario-card aos-scenario-card--${item.readiness}${active ? " is-active" : ""}`}
                onClick={() => router.replace(selectScenario(pathname, searchParams, item.id), { scroll: false })}
              >
                <span className="aos-scenario-card__n">{item.number}</span>
                <strong>{item.title}</strong>
                <em>{READY_LABEL[item.readiness]}</em>
              </button>
            );
          })}
        </div>
      </section>

      {selected ? (
        <section className="aos-card">
          <div className="aos-section-head">
            <div>
              <h2>
                {selected.def.number}. {selected.def.title}
              </h2>
              <p>{selected.def.question}</p>
            </div>
            <div className="aos-scenario-pills">
              <span className={`aos-scenario-pill aos-scenario-pill--${selected.run.status}`}>
                {STATUS_LABEL[selected.run.status]}
              </span>
              <span className={`aos-contour-pill aos-contour-pill--${selected.def.readiness === "live" ? "live" : selected.def.readiness === "guided" ? "partial" : "stub"}`}>
                {READY_LABEL[selected.def.readiness]}
              </span>
            </div>
          </div>
          <p className="aos-factor-headline">{selected.run.headline}</p>
          <DecisionBrief title="Диагноз" body={selected.run.diagnosis} />
          <p className="aos-muted" style={{ marginTop: "0.75rem" }}>
            Триггер: {selected.def.trigger}
          </p>

          {selected.run.findings.length ? (
            <dl className="aos-scenario-findings">
              {selected.run.findings.map((row) => (
                <div key={`${row.label}-${row.value}`}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.value}
                    {row.note ? <span>{row.note}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {selected.def.steps.length ? (
            <ol className="aos-scenario-steps">
              {selected.def.steps.map((step, index) => (
                <li key={`${step.title}-${index}`}>
                  <strong>
                    Шаг {index + 1}. {step.title}
                  </strong>
                  <p>{step.check}</p>
                  {step.href ? <Link href={step.href}>Открыть экран →</Link> : null}
                </li>
              ))}
            </ol>
          ) : null}

          {selected.run.actions.length ? (
            <div className="aos-scenario-actions">
              {selected.run.actions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <strong>{action.title}</strong>
                  <span>{action.why}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <p className="aos-muted" style={{ marginTop: "1rem" }}>
            Переиспользуем: {selected.def.reuse}
            {selected.run.sampleNote ? ` ${selected.run.sampleNote}` : ""}
          </p>
        </section>
      ) : (
        <section className="aos-card aos-card--warn">
          <p>Сценарий не найден. Выберите вопрос из списка.</p>
        </section>
      )}
    </>
  );
}
