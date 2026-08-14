"use client";

import { useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/api-response";
import type { ManagerSchedulePayload } from "@/lib/sales/manager-schedule";
import { rigaTodayIso } from "@/lib/sales/manager-schedule";

type ApiResponse = ({ ok: true } & ManagerSchedulePayload) | { ok: false; error: string };

export function ManagerScheduleBoard() {
  const [month, setMonth] = useState<string | null>(null);
  const [payload, setPayload] = useState<ManagerSchedulePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const query = month ? `?month=${encodeURIComponent(month)}` : "";
        const response = await fetch(`/api/sales/manager-schedule${query}`, { cache: "no-store" });
        const data = await readJsonResponse<ApiResponse>(response);
        if (!response.ok || !("ok" in data) || data.ok !== true) {
          throw new Error("error" in data ? data.error : "Не удалось загрузить график");
        }
        if (cancelled) return;
        setPayload(data);
        setError(null);
        if (!month) setMonth(data.selected.isoMonth);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки графика");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const todayIso = useMemo(() => rigaTodayIso(), []);
  const selected = payload?.selected;
  const todayIndex = selected?.days.findIndex((day) => day.date === todayIso) ?? -1;
  const onShiftToday =
    todayIndex >= 0 && selected
      ? selected.managers.filter((row) => row.shifts[todayIndex])
      : [];

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">График работы менеджеров</h2>
          <p className="mt-1 text-sm text-slate-600">
            Смены 8:00–20:00 из таблицы «График». Новые месяцы и менеджеры подхватываются с листов.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {payload?.months.length ? (
            <label className="text-sm font-bold text-slate-700">
              Месяц
              <select
                className="ml-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                value={selected?.isoMonth ?? month ?? ""}
                onChange={(event) => setMonth(event.target.value)}
                disabled={loading}
              >
                {payload.months.map((option) => (
                  <option key={option.isoMonth} value={option.isoMonth}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {payload?.spreadsheetUrl ? (
            <a
              href={payload.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-blue-600"
            >
              Открыть таблицу →
            </a>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {loading && !payload ? <p className="text-sm text-slate-600">Загрузка графика…</p> : null}

      {selected ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-sm text-slate-600">
            {selected.shiftHours ? (
              <span className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5">
                Смена {selected.shiftHours}
              </span>
            ) : (
              <span className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5">Смена 8:00–20:00</span>
            )}
            {selected.normShifts != null ? (
              <span className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5">
                Норма {selected.normShifts} смен
              </span>
            ) : null}
            {onShiftToday.length ? (
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                Сегодня в смене: {onShiftToday.map((row) => row.name).join(", ")}
              </span>
            ) : todayIndex >= 0 ? (
              <span className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5">Сегодня никого в смене</span>
            ) : null}
          </div>

          {!selected.days.length ? (
            <p className="text-sm text-slate-600">Лист месяца пока пустой — добавьте смены в таблице.</p>
          ) : (
            <div className="table-scroll rounded-xl border border-[var(--line)] bg-white">
              <table className="min-w-max text-center text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white text-left font-bold text-slate-700">Менеджер</th>
                    {selected.days.map((day, index) => {
                      const weekend = day.weekday === "сб" || day.weekday === "вс";
                      const isToday = index === todayIndex;
                      return (
                        <th
                          key={day.date}
                          className={`min-w-10 px-1.5 py-2 ${weekend ? "bg-slate-50" : ""} ${
                            isToday ? "bg-blue-50 text-blue-700" : "text-slate-500"
                          }`}
                        >
                          <div className="font-black text-slate-950">{day.day}</div>
                          <div className="font-semibold uppercase">{day.weekday}</div>
                        </th>
                      );
                    })}
                    <th className="text-slate-500">Смен</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.managers.map((row) => (
                    <tr key={row.name}>
                      <td className="sticky left-0 z-10 bg-white text-left font-bold text-slate-950">{row.name}</td>
                      {row.shifts.map((onShift, index) => {
                        const day = selected.days[index];
                        const weekend = day?.weekday === "сб" || day?.weekday === "вс";
                        const isToday = index === todayIndex;
                        return (
                          <td
                            key={`${row.name}-${day?.date ?? index}`}
                            className={`px-1 py-2 ${weekend ? "bg-slate-50" : ""} ${isToday ? "bg-blue-50" : ""}`}
                          >
                            {onShift ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 font-black text-emerald-800">
                                1
                              </span>
                            ) : (
                              <span className="text-slate-300">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="font-bold text-slate-950">{row.shiftCount}</td>
                    </tr>
                  ))}
                  {selected.managers.length ? (
                    <tr>
                      <td className="sticky left-0 z-10 bg-slate-50 text-left font-bold text-slate-700">
                        Людей в смене
                      </td>
                      {selected.coverage.map((count, index) => {
                        const day = selected.days[index];
                        const weekend = day?.weekday === "сб" || day?.weekday === "вс";
                        const isToday = index === todayIndex;
                        return (
                          <td
                            key={`cov-${day?.date ?? index}`}
                            className={`px-1 py-2 font-bold text-slate-700 ${weekend ? "bg-slate-50" : "bg-slate-50/60"} ${
                              isToday ? "bg-blue-50" : ""
                            }`}
                          >
                            {count ?? "—"}
                          </td>
                        );
                      })}
                      <td className="bg-slate-50" />
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={selected.days.length + 2} className="text-left text-sm text-slate-600">
                        В этом месяце ещё нет строк менеджеров.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
