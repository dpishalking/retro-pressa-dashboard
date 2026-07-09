"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Brain,
  ChevronRight,
  GitBranch,
  Layers,
  Minus,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import { HUB_PATH } from "@/lib/auth/routes";
import { FinancialPnLView } from "@/components/financial-report/pnl-view";
import { FinancialReportInspector } from "@/components/financial-report/inspector";
import { ScenarioFinancialCard } from "@/components/financial-report/scenario-card";
import { PlanningDeltaView } from "@/components/planning/planning-delta-view";
import { PlanningModeSwitcher } from "@/components/planning/planning-mode-switcher";
import { useFinancialReport } from "@/hooks/use-financial-report";
import { mergeTwinWithFinancialReport } from "@/lib/financial-report/twin-bridge";
import { computeTwin, suggestConstraintRelief } from "@/lib/digital-twin/compute";
import { DEFAULT_SCENARIOS, getDriverBounds, clampDriverValue, driverValueToInput, normalizeDriverInput } from "@/lib/digital-twin/drivers";
import { getSeedScenarioLibrary, type PlanningMode, type SavedScenario } from "@/lib/planning-layer";
import type { ComputedMetric, DriverCategory, DriverState, DriverTreeNode, ScenarioId } from "@/lib/digital-twin/types";
import { eur, number, pct } from "@/lib/format";

const tabs = ["CEO Dashboard", "Driver Tree", "Сценарии", "Ограничения", "Рекомендации", "Inspector"] as const;
type Tab = (typeof tabs)[number];

const driverCategoryOrder: DriverCategory[] = ["marketing", "sales", "production", "hr", "finance"];

const categoryLabels: Record<DriverCategory, string> = {
  marketing: "Маркетинг",
  sales: "Продажи",
  production: "Производство",
  hr: "Команда",
  finance: "Финансы"
};

const categoryColors: Record<DriverCategory, string> = {
  marketing: "text-blue-600 bg-blue-50",
  sales: "text-amber-600 bg-amber-50",
  production: "text-emerald-600 bg-emerald-50",
  hr: "text-violet-600 bg-violet-50",
  finance: "text-rose-600 bg-rose-50"
};

function formatMetricValue(metric: ComputedMetric | DriverState): string {
  const value = "forecast" in metric && "actual" in metric ? metric.actual : metric.value;
  switch (metric.unit) {
    case "currency":
      return eur(value);
    case "percent":
      return pct(value);
    case "ratio":
      return pct(value);
    case "hours":
      return `${number(value, 0)} ч`;
    default:
      return number(value, metric.unit === "count" ? 0 : 1);
  }
}

function formatImpact(value: number) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${eur(Math.abs(value))}`;
}

function TrendBadge({ trend, delta }: { trend: "up" | "down" | "flat"; delta: number }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const color = trend === "up" ? "text-emerald-600 bg-emerald-50" : trend === "down" ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>
      <Icon size={12} />
      {pct(Math.abs(delta))}
    </span>
  );
}

function CeoMetricCard({ metric }: { metric: ComputedMetric }) {
  const isBottleneck = metric.id === "bottleneck";
  return (
    <article className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p>
        {!isBottleneck ? <TrendBadge trend={metric.trend} delta={metric.delta} /> : null}
      </div>
      <p className="text-2xl font-black text-slate-950">{formatMetricValue(metric)}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>План: {formatMetricValue({ ...metric, value: metric.plan })}</span>
        <span>{metric.owner}</span>
      </div>
    </article>
  );
}

function DriverSlider({
  driver,
  onChange,
  disabled = false,
  compact = false
}: {
  driver: DriverState;
  onChange: (id: string, value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { min, max, step } = getDriverBounds(driver);
  const value = clampDriverValue(driver, driver.actual);
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const formatInput = useCallback((raw: number) => driverValueToInput(driver, raw, number), [driver]);

  useEffect(() => {
    if (!focused) {
      setDraft(null);
    }
  }, [value, focused]);

  const commitDraft = useCallback(
    (raw: string) => {
      const normalized = normalizeDriverInput(driver, raw);
      if (normalized !== null) {
        onChange(driver.id, normalized);
      }
      setDraft(null);
      setFocused(false);
    },
    [driver, onChange]
  );

  const inputValue = focused && draft !== null ? draft : formatInput(value);
  const rangeHint = `${formatInput(min)} – ${formatInput(max)}`;

  return (
    <div className={`rounded-xl border border-[var(--line)] bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
      <div className={`mb-3 flex items-start justify-between gap-3 ${compact ? "mb-2" : ""}`}>
        <div>
          <p className={`font-bold text-slate-900 ${compact ? "text-sm" : ""}`}>{driver.label}</p>
          <p className="text-xs text-slate-500">План: {formatMetricValue({ ...driver, actual: driver.plan })}</p>
        </div>
        {!compact ? (
          <span className={`rounded-lg px-2 py-1 text-xs font-bold ${categoryColors[driver.category]}`}>
            {categoryLabels[driver.category]}
          </span>
        ) : null}
      </div>
      {disabled ? (
        <p className="text-xs font-semibold text-slate-500">Доступно только в режиме SCENARIO</p>
      ) : null}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(driver.id, clampDriverValue(driver, Number(e.target.value)))}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
        />
        <div className="flex shrink-0 items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            disabled={disabled}
            onFocus={() => {
              setFocused(true);
              setDraft(formatInput(value));
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitDraft(draft ?? formatInput(value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft(draft ?? formatInput(value));
              }
              if (e.key === "Escape") {
                setDraft(null);
                setFocused(false);
                e.currentTarget.blur();
              }
            }}
            aria-label={`${driver.label}, введите значение`}
            className="w-[5.5rem] rounded-lg border border-[var(--line)] bg-slate-50 px-2 py-1 text-right text-sm font-black text-slate-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed"
          />
          <span className="w-4 text-xs font-semibold text-slate-500">
            {driver.unit === "percent" || driver.unit === "ratio" ? "%" : driver.unit === "currency" ? "€" : driver.unit === "hours" ? "ч" : ""}
          </span>
        </div>
      </div>
      {!disabled ? <p className="mt-2 text-xs text-slate-400">Диапазон: {rangeHint}</p> : null}
    </div>
  );
}

function DriverCategorySection({
  category,
  drivers,
  open,
  onToggle,
  onChange,
  disabled
}: {
  category: DriverCategory;
  drivers: DriverState[];
  open: boolean;
  onToggle: () => void;
  onChange: (id: string, value: number) => void;
  disabled: boolean;
}) {
  if (drivers.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <ChevronRight size={18} className={`shrink-0 text-slate-500 transition ${open ? "rotate-90" : ""}`} />
          <h3 className="text-base font-black text-slate-950">{categoryLabels[category]}</h3>
          <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${categoryColors[category]}`}>
            {drivers.length}
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-500">{open ? "Свернуть" : "Развернуть"}</span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-[var(--line)] bg-slate-50/60 p-4 md:grid-cols-2">
          {drivers.map((driver) => (
            <DriverSlider
              key={driver.id}
              driver={driver}
              onChange={onChange}
              disabled={disabled}
              compact
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DriversPanel({
  drivers,
  planningMode,
  onChange
}: {
  drivers: DriverState[];
  planningMode: PlanningMode;
  onChange: (id: string, value: number) => void;
}) {
  const [openCategories, setOpenCategories] = useState<Partial<Record<DriverCategory, boolean>>>({
    marketing: true,
    sales: true,
    production: false,
    hr: false,
    finance: false
  });
  const disabled = planningMode !== "SCENARIO";

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={20} className="text-blue-600" />
          <h2 className="text-xl font-black text-slate-950">Драйверы</h2>
        </div>
        <p className="text-sm text-slate-600">
          {disabled
            ? "Переключитесь в SCENARIO, чтобы менять значения и сразу видеть эффект выше."
            : "Меняйте ползунки или вводите точные значения — метрики обновляются мгновенно."}
        </p>
      </div>
      <div className="space-y-3">
        {driverCategoryOrder.map((category) => (
          <DriverCategorySection
            key={category}
            category={category}
            drivers={drivers.filter((driver) => driver.category === category && driver.editable)}
            open={openCategories[category] ?? false}
            onToggle={() =>
              setOpenCategories((prev) => ({
                ...prev,
                [category]: !prev[category]
              }))
            }
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

function TreeNode({ node, depth = 0 }: { node: DriverTreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-slate-200 pl-4" : ""}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${node.limitsGrowth ? "bg-amber-50" : "hover:bg-slate-50"} ${hasChildren ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasChildren ? <ChevronRight size={14} className={`transition ${open ? "rotate-90" : ""}`} /> : <span className="w-3.5" />}
        <span className={`text-sm font-semibold ${node.isDriver ? "text-blue-700" : "text-slate-800"}`}>{node.label}</span>
        <span className="ml-auto text-sm font-black text-slate-950">
          {node.unit === "currency" ? eur(node.value) : node.unit === "percent" ? pct(node.value) : number(node.value, 0)}
        </span>
        {node.limitsGrowth ? <AlertTriangle size={14} className="text-amber-600" /> : null}
      </button>
      {open && hasChildren ? (
        <div className="mb-2">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DigitalTwinApp() {
  const searchParams = useSearchParams();
  const showInspector = searchParams.get("dev") === "1";
  const [activeTab, setActiveTab] = useState<Tab>("CEO Dashboard");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("FACT");
  const [overrides, setOverrides] = useState<Partial<Record<string, number>>>({});
  const [activeScenario, setActiveScenario] = useState<ScenarioId>("baseline");
  const [libraryScenarios, setLibraryScenarios] = useState<SavedScenario[]>(getSeedScenarioLibrary().scenarios);
  const [activeLibraryScenarioId, setActiveLibraryScenarioId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/planning/scenarios", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { scenarios?: SavedScenario[] }) => {
        if (Array.isArray(payload.scenarios) && payload.scenarios.length > 0) {
          setLibraryScenarios(payload.scenarios);
        }
      })
      .catch(() => undefined);
  }, []);

  const scenarioOverrides = useMemo(() => {
    if (planningMode !== "SCENARIO") return {};
    const preset = DEFAULT_SCENARIOS.find((s) => s.id === activeScenario);
    return { ...preset?.overrides, ...overrides };
  }, [activeScenario, overrides, planningMode]);

  const twinBase = useMemo(
    () => computeTwin({ overrides: planningMode === "SCENARIO" ? scenarioOverrides : {} }),
    [planningMode, scenarioOverrides]
  );
  const {
    report: financialReport,
    loading: financialLoading,
    error: financialError,
    refresh: refreshFinancialReport,
    isFallback
  } = useFinancialReport({
    mode: planningMode,
    driverOverrides: planningMode === "SCENARIO" ? scenarioOverrides : undefined,
    scenarioId: planningMode === "SCENARIO" ? activeLibraryScenarioId ?? undefined : undefined,
    includeDelta: planningMode !== "FACT"
  });
  const snapshot = useMemo(
    () => mergeTwinWithFinancialReport(twinBase, financialReport),
    [twinBase, financialReport]
  );

  const visibleTabs = useMemo(
    () => (showInspector ? tabs : tabs.filter((tab) => tab !== "Inspector")),
    [showInspector]
  );

  const handleDriverChange = useCallback((id: string, value: number) => {
    if (planningMode !== "SCENARIO") return;
    setActiveScenario("custom");
    setActiveLibraryScenarioId(null);
    const driver = twinBase.drivers.find((d) => d.id === id);
    const nextValue = driver ? clampDriverValue(driver, value) : value;
    setOverrides((prev) => ({ ...prev, [id]: nextValue }));
  }, [planningMode, twinBase.drivers]);

  const handleScenarioSelect = useCallback((id: ScenarioId) => {
    if (planningMode !== "SCENARIO") {
      setPlanningMode("SCENARIO");
    }
    setActiveScenario(id);
    setActiveLibraryScenarioId(null);
    if (id !== "custom") setOverrides({});
  }, [planningMode]);

  const handleLibraryScenarioSelect = useCallback((scenario: SavedScenario) => {
    setPlanningMode("SCENARIO");
    setActiveLibraryScenarioId(scenario.id);
    setActiveScenario("custom");
    setOverrides({});
  }, []);

  const handlePlanningModeChange = useCallback((mode: PlanningMode) => {
    setPlanningMode(mode);
    if (mode !== "SCENARIO") {
      setOverrides({});
      setActiveLibraryScenarioId(null);
    }
  }, []);

  const bottleneck = snapshot.constraints.find((c) => c.isBottleneck);
  const editableDrivers = snapshot.drivers.filter((d) => d.editable);

  return (
    <main className="mx-auto w-[min(1400px,calc(100%-32px))] py-8">
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href={HUB_PATH} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} />
            В кабинет
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Activity size={14} />
            {financialLoading
              ? "Загрузка Financial Report…"
              : `${financialReport?.planning.mode ?? planningMode} · ${snapshot.computeMs.toFixed(1)} мс`}
            {isFallback ? " · fallback" : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-violet-600">Цифровой двойник</p>
            <h1 className="text-4xl font-black tracking-normal text-slate-950 lg:text-5xl">Decision Engine</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              FACT — реальность. PLAN — цели. SCENARIO — лаборатория решений без изменения факта.
            </p>
          </div>
          <PlanningModeSwitcher mode={planningMode} onChange={handlePlanningModeChange} />
          <div className={`card p-4 ${snapshot.strategicGoal.achievable ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-xs font-bold uppercase text-slate-500">Стратегическая цель</p>
            <p className="mt-1 text-lg font-black text-slate-950">
              {eur(snapshot.strategicGoal.targetRevenue)} · {pct(snapshot.strategicGoal.targetNetMargin)} рентабельность
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {snapshot.strategicGoal.achievable
                ? "Цель достижима при текущих драйверах"
                : `Разрыв: ${eur(snapshot.strategicGoal.gap)} · Ограничение: ${snapshot.strategicGoal.limitingFactor}`}
            </p>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === tab ? "bg-slate-950 text-white" : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "CEO Dashboard" ? (
        <div className="space-y-6">
          {financialError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {financialError}
              <button type="button" onClick={refreshFinancialReport} className="ml-3 font-bold underline">
                Повторить
              </button>
            </div>
          ) : null}
          {financialReport?.delta && planningMode !== "FACT" ? (
            <PlanningDeltaView rows={financialReport.delta} />
          ) : null}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {snapshot.ceoMetrics.map((m) => (
              <CeoMetricCard key={m.id} metric={m} />
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Layers size={20} className="text-violet-600" />
                <h2 className="text-xl font-black">P&L (автоматический)</h2>
              </div>
              <div className="space-y-2 text-sm">
                {financialReport ? <FinancialPnLView report={financialReport} /> : <p className="text-slate-500">Загрузка P&L…</p>}
              </div>
            </section>

            <section className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Zap size={20} className="text-amber-600" />
                <h2 className="text-xl font-black">ТОП-3 действия</h2>
              </div>
              <div className="space-y-3">
                {snapshot.recommendations.slice(0, 3).map((rec) => (
                  <div key={rec.rank} className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">#{rec.rank} {rec.action}</p>
                      <span className={`whitespace-nowrap text-sm font-black ${rec.profitImpact >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatImpact(rec.profitImpact)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Выручка: {rec.revenueImpact >= 0 ? "+" : ""}{eur(rec.revenueImpact)}</p>
                  </div>
                ))}
              </div>
              {bottleneck ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase text-amber-700">Главное ограничение</p>
                  <p className="mt-1 font-bold text-slate-900">{bottleneck.department}: {bottleneck.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{suggestConstraintRelief(bottleneck, snapshot.drivers)}</p>
                </div>
              ) : null}
            </section>
          </div>

          <DriversPanel
            drivers={editableDrivers}
            planningMode={planningMode}
            onChange={handleDriverChange}
          />
        </div>
      ) : null}

      {activeTab === "Driver Tree" ? (
        <section className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            <h2 className="text-xl font-black">Дерево влияния</h2>
          </div>
          <p className="mb-4 text-sm text-slate-600">От стратегической цели к каждому драйверу. Жёлтым отмечены узлы, ограничивающие рост.</p>
          <TreeNode node={snapshot.driverTree} />
        </section>
      ) : null}

      {activeTab === "Сценарии" ? (
        <div className="space-y-6">
          <p className="text-sm text-slate-600">Scenario Library — временные изменения поверх FACT. Не влияют на реальные данные.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {libraryScenarios.map((scenario) => (
              <ScenarioFinancialCard
                key={scenario.id}
                scenario={scenario}
                isActive={activeLibraryScenarioId === scenario.id}
                onSelect={() => handleLibraryScenarioSelect(scenario)}
              />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {DEFAULT_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleScenarioSelect(scenario.id)}
                className={`card p-6 text-left transition ${activeScenario === scenario.id && !activeLibraryScenarioId ? "ring-2 ring-violet-500" : "hover:-translate-y-0.5 hover:shadow-lg"}`}
              >
                <h3 className="text-xl font-black text-slate-950">{scenario.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{scenario.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "Ограничения" ? (
        <section className="space-y-4">
          <p className="text-sm text-slate-600">Constraint Engine автоматически ищет бутылочные горлышки в цепочке: маркетинг → продажи → производство.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {snapshot.constraints.map((c) => (
              <article key={c.id} className={`card p-6 ${c.isBottleneck ? "border-amber-300 bg-amber-50" : ""}`}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">{c.department}</p>
                    <h3 className="text-lg font-black text-slate-950">{c.label}</h3>
                  </div>
                  {c.isBottleneck ? (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">Узкое место</span>
                  ) : null}
                </div>
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Загрузка</span>
                    <span>{pct(c.utilization)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${c.utilization > 0.85 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(100, c.utilization * 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Мощность: {number(c.capacity, 0)} · Спрос: {number(c.demand, 0)} · {c.owner}
                </p>
                {c.suggestion ? <p className="mt-2 text-sm font-semibold text-blue-700">{c.suggestion}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "Рекомендации" ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-violet-600" />
            <p className="text-sm text-slate-600">
              AI Recommendation Engine: ТОП-10 действий, отсортированных по влиянию на чистую прибыль.
            </p>
          </div>
          <div className="space-y-3">
            {snapshot.recommendations.map((rec) => (
              <article key={rec.rank} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-lg font-black text-violet-700">
                    {rec.rank}
                  </span>
                  <div>
                    <p className="font-bold text-slate-950">{rec.action}</p>
                    <p className="text-xs text-slate-500">
                      Драйвер: {rec.driverLabel} · Уверенность: {rec.confidence === "high" ? "Высокая" : rec.confidence === "medium" ? "Средняя" : "Низкая"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${rec.profitImpact >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatImpact(rec.profitImpact)}
                  </p>
                  <p className="text-xs text-slate-500">Выручка {rec.revenueImpact >= 0 ? "+" : ""}{eur(rec.revenueImpact)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "Inspector" && financialReport ? <FinancialReportInspector report={financialReport} /> : null}

      <footer className="mt-8 rounded-xl border border-[var(--line)] bg-white p-4 text-xs text-slate-500">
        <p className="font-bold text-slate-700">Архитектура расчёта</p>
        <p className="mt-1">
          Company Snapshot (FACT) → Planning Layer → Financial Engine → Financial Report API → UI
        </p>
        <p className="mt-1">
          Операционный слой: Drivers → Constraint Engine → Recommendations
          {financialReport ? ` · Обновлено: ${new Date(financialReport.computedAt).toLocaleString("ru-RU")}` : ""}
        </p>
      </footer>
    </main>
  );
}
