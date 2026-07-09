"use client";

import type { PlanningMode } from "@/lib/planning-layer";

const modes: Array<{ id: PlanningMode; label: string; hint: string }> = [
  { id: "FACT", label: "FACT", hint: "Реальные данные" },
  { id: "PLAN", label: "PLAN", hint: "Целевые показатели" },
  { id: "SCENARIO", label: "SCENARIO", hint: "Лаборатория решений" }
];

type Props = {
  mode: PlanningMode;
  onChange: (mode: PlanningMode) => void;
};

export function PlanningModeSwitcher({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--line)] bg-white p-1">
      {modes.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-lg px-4 py-2 text-left transition ${
            mode === item.id ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="block text-xs font-black uppercase tracking-wide">{item.label}</span>
          <span className={`block text-[10px] ${mode === item.id ? "text-slate-300" : "text-slate-500"}`}>
            {item.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
