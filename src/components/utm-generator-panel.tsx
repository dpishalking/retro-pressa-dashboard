"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Sparkles } from "lucide-react";
import {
  utmBaseUrlPresets,
  utmMarketPresets,
  utmMediumPresets,
  utmQuickTemplates,
  utmSourcePresets,
  utmTopicPresets,
  utmNamingContract,
  type UtmTemplate
} from "@/config/utm-taxonomy";
import {
  buildUtmUrl,
  campaignNameSuggestion,
  predictGa4Channel,
  slugifyUtmValue,
  validateUtmParams,
  type UtmParams
} from "@/lib/utm-generator";

const historyStorageKey = "retro-pressa-utm-history-v1";

type HistoryItem = {
  createdAt: string;
  url: string;
  label: string;
};

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStorageKey) ?? "[]") as HistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(historyStorageKey, JSON.stringify(items.slice(0, 12)));
}

const emptyParams: UtmParams = {
  utm_source: "facebook",
  utm_medium: "paid_social",
  utm_campaign: "",
  utm_content: "",
  utm_term: ""
};

export function UtmGeneratorPanel({ variant = "internal" }: { variant?: "internal" | "public" }) {
  const [baseUrl, setBaseUrl] = useState<string>(utmBaseUrlPresets[1].value);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [params, setParams] = useState<UtmParams>({
    ...emptyParams,
    utm_campaign: campaignNameSuggestion("lv")
  });
  const [contentLabel, setContentLabel] = useState("ad_01");
  const [market, setMarket] = useState("lv");
  const [topic, setTopic] = useState("gift");
  const [copyState, setCopyState] = useState<"idle" | "ok">("idle");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const resolvedBaseUrl = baseUrl === "custom" ? customBaseUrl : baseUrl;

  const updateParam = useCallback((key: keyof UtmParams, value: string) => {
    setParams((current) => ({ ...current, [key]: value }));
  }, []);

  const generatedUrl = useMemo(
    () => buildUtmUrl(resolvedBaseUrl, { ...params, utm_content: params.utm_content || contentLabel, utm_term: params.utm_term || market }),
    [contentLabel, market, params, resolvedBaseUrl]
  );

  const issues = useMemo(
    () => validateUtmParams(resolvedBaseUrl, { ...params, utm_content: params.utm_content || contentLabel, utm_term: params.utm_term || market }),
    [contentLabel, market, params, resolvedBaseUrl]
  );

  const ga4Channel = predictGa4Channel(params.utm_source, params.utm_medium);
  const hasErrors = issues.some((issue) => issue.level === "error");

  const applyTemplate = useCallback((template: UtmTemplate) => {
    setBaseUrl(template.baseUrl);
    setCustomBaseUrl("");
    setParams({
      utm_source: template.utm_source,
      utm_medium: template.utm_medium,
      utm_campaign: template.utm_campaign,
      utm_content: template.utm_content ?? "",
      utm_term: template.utm_term ?? ""
    });
    setContentLabel(template.utm_content ?? "ad_01");
    setMarket(template.utm_term ?? "lv");
  }, []);

  const suggestCampaign = useCallback(() => {
    updateParam("utm_campaign", campaignNameSuggestion(market, topic));
  }, [market, topic, updateParam]);

  const copyUrl = useCallback(async () => {
    if (!generatedUrl || hasErrors) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopyState("ok");
    const label = `${params.utm_source}/${params.utm_campaign}`;
    const nextHistory = [{ createdAt: new Date().toISOString(), url: generatedUrl, label }, ...loadHistory().filter((item) => item.url !== generatedUrl)].slice(0, 12);
    setHistory(nextHistory);
    saveHistory(nextHistory);
    window.setTimeout(() => setCopyState("idle"), 1800);
  }, [generatedUrl, hasErrors, params.utm_campaign, params.utm_source]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  return (
    <section className="card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">UTM-генератор ссылок</h2>
          <p className="mt-1 text-sm text-slate-500">
            {variant === "public"
              ? "Соберите финальный URL и вставьте его в рекламный кабинет."
              : "Соберите правильную ссылку для рекламы. Метки попадут в GA4 и помогут убрать Unassigned."}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-800">Канал в GA4:</span>{" "}
          <span className="text-emerald-900">{ga4Channel}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {utmQuickTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
            onClick={() => applyTemplate(template)}
          >
            {template.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">Куда ведём (лендинг)</span>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)}>
              {utmBaseUrlPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
              <option value="custom">Свой URL</option>
            </select>
          </label>

          {baseUrl === "custom" ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-slate-700">Свой URL</span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2"
                placeholder="https://retro-pressa.com/your-page"
                value={customBaseUrl}
                onChange={(event) => setCustomBaseUrl(event.target.value)}
              />
            </label>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">Тема кампании</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                updateParam("utm_campaign", campaignNameSuggestion(market, event.target.value));
              }}
            >
              {utmTopicPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">utm_source *</span>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2" value={params.utm_source} onChange={(event) => updateParam("utm_source", event.target.value)}>
              {utmSourcePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label} ({preset.value})</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">utm_medium *</span>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2" value={params.utm_medium} onChange={(event) => updateParam("utm_medium", event.target.value)}>
              {utmMediumPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label} ({preset.value})</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">utm_campaign *</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                placeholder="2026_07_gift_lv"
                value={params.utm_campaign}
                onChange={(event) => updateParam("utm_campaign", event.target.value)}
              />
              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={suggestCampaign}>
                <Sparkles size={14} />
                Авто
              </button>
            </div>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">utm_content (объявление)</span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              placeholder="ad_01 / video_02 / carousel_01"
              value={params.utm_content || contentLabel}
              onChange={(event) => {
                setContentLabel(event.target.value);
                updateParam("utm_content", event.target.value);
              }}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">utm_term (рынок)</span>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={params.utm_term || market}
              onChange={(event) => {
                setMarket(event.target.value);
                updateParam("utm_term", event.target.value);
              }}
            >
              {utmMarketPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label} ({preset.value})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <Link2 size={16} />
              Готовая ссылка
            </div>
            <textarea
              className="min-h-32 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800"
              readOnly
              value={generatedUrl || "Заполните обязательные поля"}
            />
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              disabled={!generatedUrl || hasErrors}
              onClick={() => void copyUrl()}
            >
              {copyState === "ok" ? <Check size={16} /> : <Copy size={16} />}
              {copyState === "ok" ? "Скопировано" : "Скопировать ссылку"}
            </button>
          </div>

          {issues.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              {issues.map((issue) => (
                <p key={`${issue.level}-${issue.message}`} className={issue.level === "error" ? "text-red-700" : "text-amber-800"}>
                  {issue.level === "error" ? "Ошибка" : "Подсказка"}: {issue.message}
                </p>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Ссылка готова. Вставьте её в рекламный кабинет как финальный URL.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
            <p className="font-bold text-slate-800">Правила</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Всегда заполняйте source, medium, campaign.</li>
              <li>Только латиница и нижнее подчёркивание: `{slugifyUtmValue("July Gift LV")}`.</li>
              <li>Формат кампании: {utmNamingContract.campaign}</li>
              <li>Google Sheets `campaign` = `utm_campaign` в ссылке.</li>
              {variant === "internal" ? (
                <li>На сайт добавьте: <code className="rounded bg-slate-100 px-1">/retro-pressa-utm.js</code> — UTM попадут в формы и Bitrix.</li>
              ) : (
                <li>Не меняйте параметры вручную после генерации — только копируйте готовую ссылку.</li>
              )}
            </ul>
          </div>

          {history.length ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-bold text-slate-800">Недавние ссылки</p>
              <div className="grid gap-2">
                {history.map((item) => (
                  <button
                    key={`${item.createdAt}-${item.url}`}
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => void navigator.clipboard.writeText(item.url)}
                  >
                    <span className="font-bold">{item.label}</span>
                    <span className="mt-1 block break-all text-slate-500">{item.url}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
