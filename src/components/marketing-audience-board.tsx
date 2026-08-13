"use client";

import { useMemo, useState } from "react";
import {
  AUDIENCE_SEGMENTS,
  type AudiencePotential,
  type AudienceSegment,
  type AudienceSubsegment
} from "@/lib/marketing/audience-segments";

type JobTab = "jobs" | "pains" | "talk";

function potentialLabel(value: AudiencePotential | null | undefined) {
  if (!value) return null;
  return value === "A" ? "Ядро A" : value === "B" ? "Ядро B" : "Ядро C";
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-slate-500">Нет данных в этом срезе.</p>;
  return (
    <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function JobGroups({ segment }: { segment: AudienceSegment }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Функциональные</p>
        <div className="mt-2">
          <BulletList items={segment.functionalJobs} />
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Эмоциональные</p>
        <div className="mt-2">
          <BulletList items={segment.emotionalJobs} />
        </div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Социальные</p>
        <div className="mt-2">
          <BulletList items={segment.socialJobs} />
        </div>
      </div>
    </div>
  );
}

function SubsegmentPanel({ sub }: { sub: AudienceSubsegment }) {
  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-black text-slate-950">{sub.title}</h4>
        {potentialLabel(sub.potential) ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
            {potentialLabel(sub.potential)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{sub.role}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{sub.jobs.join(" ")}</p>
      {sub.trigger ? (
        <p className="mt-2 text-sm leading-6 text-slate-700">
          <span className="font-bold text-slate-500">Триггер. </span>
          {sub.trigger}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Боли</p>
          <div className="mt-2">
            <BulletList items={sub.pains} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Страхи</p>
          <div className="mt-2">
            <BulletList items={sub.fears} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Что двигает к заказу</p>
          <div className="mt-2">
            <BulletList items={sub.drivers} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Гипотезы пакета</p>
          <div className="mt-2">
            <BulletList items={sub.hypotheses} />
          </div>
        </div>
      </div>
      {sub.howToTalk ? (
        <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-900">
          {sub.howToTalk}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingAudienceBoard() {
  const [segmentId, setSegmentId] = useState(AUDIENCE_SEGMENTS[0]?.id ?? "");
  const [subId, setSubId] = useState<string | null>(null);
  const [tab, setTab] = useState<JobTab>("jobs");

  const segment = useMemo(
    () => AUDIENCE_SEGMENTS.find((item) => item.id === segmentId) ?? AUDIENCE_SEGMENTS[0],
    [segmentId]
  );
  const sub = segment?.subsegments.find((item) => item.id === subId) ?? null;

  if (!segment) return null;

  const tabs: Array<{ id: JobTab; label: string }> = [
    { id: "jobs", label: "Jobs" },
    { id: "pains", label: "Боли и страхи" },
    { id: "talk", label: "Как говорить" }
  ];

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">Целевая аудитория</h2>
        <p className="mt-1 text-sm text-slate-600">
          Четыре ядра и подсегменты. Выберите сегмент — внутри его работа, боли и формулировки.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AUDIENCE_SEGMENTS.map((item) => {
          const active = item.id === segment.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSegmentId(item.id);
                setSubId(null);
                setTab("jobs");
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                active ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-[var(--line)] hover:bg-slate-50"
              }`}
            >
              {item.shortTitle}
              <span className={`ml-2 text-[11px] font-bold uppercase tracking-wide ${active ? "text-blue-200" : "text-slate-400"}`}>
                {item.potential}
              </span>
            </button>
          );
        })}
      </div>

      <article className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {potentialLabel(segment.potential)} · {segment.subsegments.length} подсегмента
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{segment.shortTitle}</h3>
          </div>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{segment.description}</p>
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-base font-semibold leading-7 text-slate-950">
          {segment.mainJob}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {tab === "jobs" ? <JobGroups segment={segment} /> : null}
          {tab === "pains" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Боли</p>
                <div className="mt-2">
                  <BulletList items={segment.pains} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Страхи</p>
                <div className="mt-2">
                  <BulletList items={segment.fears} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Возражения</p>
                <div className="mt-2">
                  <BulletList items={segment.objections} />
                </div>
              </div>
            </div>
          ) : null}
          {tab === "talk" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Формулировки</p>
                <div className="mt-2">
                  <BulletList items={segment.formulations} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Конвертеры</p>
                <div className="mt-2">
                  <BulletList items={segment.converters} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Подсегменты</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {segment.subsegments.map((item) => {
              const active = item.id === subId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubId(active ? null : item.id)}
                  className={`max-w-full rounded-lg px-3 py-2 text-left text-sm font-semibold leading-5 ${
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
          {sub ? <SubsegmentPanel sub={sub} /> : (
            <p className="mt-3 text-sm text-slate-500">Нажмите подсегмент — откроются его jobs, триггер и как с ним говорить.</p>
          )}
        </div>
      </article>
    </section>
  );
}
