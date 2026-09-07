"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCopy, GraduationCap, Target, Users } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";

type Audience = "manager" | "rop";

type Situation = {
  id: string;
  label: string;
  client: string;
  why: string;
  script: string;
  live: string;
};

const SITUATIONS: Situation[] = [
  {
    id: "ask_price",
    label: "Сразу «Сколько стоит?»",
    client: "Сколько стоит газета? Доставите в Латвию / к нам?",
    why: "Цена в первом ответе. Не каталог без цифр.",
    script: `Добрый день! Это [Имя], менеджер retro-pressa.
Стоимость изданий — от 15 до 64 €, доставка по всему миру.
Напишите дату рождения именинника и город — сразу пришлю, что есть в архиве, с ценами.

[после даты]
Отлично! Оригинальная «Правда» за [дата] — 45 €. Подходит?
Тогда оформляю счёт. Напишите: имя, телефон. Доставка — X €.
Оплата: перевод / карта / PayPal / Wise — как удобнее?`,
    live: "Анастасия: вилка в 1-м сообщении → «Правда — 45 €» → клиент: «Оплатила»."
  },
  {
    id: "what_available",
    label: "«Что есть на дату?»",
    client: "День рождения мужа 03.06.1976. Что есть? За рулём или Правда?",
    why: "Список + цена SKU в одном блоке + микро-закрытие.",
    script: `За [месяц год] в архиве: [3–5 позиций].
«За рулём» — 142 р, любая репродукция газеты — 145 р. Доставка — X.
Оригинала газеты на точный день нет; репродукция — точная копия.
Какой вариант берём? Могу сразу оформить.`,
    live: "Елена: цены в одном сообщении → «Желаете оформить заказ?» → оплата 407 р."
  },
  {
    id: "price_and_deadline",
    label: "Цена + срок / срочность",
    client: "Сколько такая газета? Нам бы завтра уже!",
    why: "Вилка → дата → 2–3 опции с ценой и сроком → выбор → оформление.",
    script: `Стоимость — от 15 до 64 € (в BYN сориентирую после города).
Напишите дату и город — срок скажу точно.

На [дата]: репродукция — Y; поздравительная с текстом и фото — Z.
На базе «Правды»/«Спорта» — до 2 дней; региональная — до 5.
Что ближе — репро или поздравительная? Оформляем?`,
    live: "Анастасия: срочный кейс → фиксирует издание → данные на счёт."
  },
  {
    id: "almost_yes",
    label: "Выбрали, но ещё не «да»",
    client: "Супер, меня устраивает. Как забронировать?",
    why: "Не новые вопросы «в никуда» — сразу сумма, данные, оплата.",
    script: `Фиксируем: [издание] за [дата], сумма N (+ доставка X / самовывоз).
Желаете оформить заказ?
Если да — пришлите имя, телефон, почту [и адрес].
Счёт отправлю сразу.`,
    live: "Елена/Анастасия: «Оформляем…» → блок данных → сумма к оплате / ЕРИП."
  },
  {
    id: "think",
    label: "«Надо подумать»",
    client: "Мне надо подумать. Оплата как происходит?",
    why: "Не уходить в новый консультационный круг. Закрепить цифру + next step.",
    script: `Конечно. Чтобы не потерять позицию: [издание] — N, доставка — X, срок — …
Могу прислать счёт сегодня без жёсткого дедлайна оплаты до [вечер/завтра].
Как удобнее оплатить — карта / перевод / ЕРИП? Пришлю один вариант под вас.`,
    live: "Паттерн Забковых: способы оплаты в том же шаге, не «потом расскажу»."
  },
  {
    id: "region",
    label: "Регион vs всесоюзная",
    client: "Хотим Могилёв / местную. Или Правду?",
    why: "Дать выбор с последствиями (язык, срок) и сразу «берём → оформляем».",
    script: `На русском быстрее: «Правда»/«Известия»/«Спорт» — до 2 дней.
Региональная — до 5 дней, часто на местном языке.
Берём [выбор]? Тогда оформляем на [издание] за [дата].
Доставка или офис? Доставка — X. Дальше сразу счёт.`,
    live: "Анастасия: «Магілёўская праўда» → «оформляем» → 222 р."
  }
];

const PROOF_BARS = [
  { label: "Цена + закрытие", value: 100, tone: "good" as const },
  { label: "Только цена", value: 19, tone: "bad" as const },
  { label: "Без цены в чате*", value: 50, tone: "neutral" as const }
];

function ProofBar({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-rose-500" : "bg-slate-400";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-sm font-black text-slate-950">{value}%</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ZabkovaClosePlaybookScreen() {
  const [audience, setAudience] = useState<Audience>("manager");
  const [situationId, setSituationId] = useState(SITUATIONS[0].id);
  const [copied, setCopied] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const situation = useMemo(
    () => SITUATIONS.find((item) => item.id === situationId) ?? SITUATIONS[0],
    [situationId]
  );

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(situation.script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function toggleCheck(id: string) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <TrainingLayout
      title="Плейбук Забковых: цена → закрытие"
      description="Интерактивная инфографика для новичков и для разбора с РОП. На живых диалогах Анастасии и Елены Забковых."
      backHref="/training/knowledge-base"
      backLabel="К базе знаний"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAudience("manager")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            audience === "manager" ? "bg-blue-600 text-white" : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <GraduationCap size={16} />
          Новый менеджер
        </button>
        <button
          type="button"
          onClick={() => setAudience("rop")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            audience === "rop" ? "bg-rose-600 text-white" : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Users size={16} />
          РОП / разбор
        </button>
      </div>

      <section className="card mb-6 border-amber-200 bg-amber-50/70 p-6">
        <p className="text-sm font-extrabold uppercase tracking-wide text-amber-800">Главный вывод</p>
        <p className="mt-2 text-lg font-black leading-8 text-slate-950">
          Не «ответьте быстрее по минутам». Работает цепочка в 3 хода: вилка или SKU-цена → выбор одной позиции → «оформляем + данные + оплата».
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Цена + закрытие</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">100%</p>
          <p className="mt-1 text-sm text-slate-600">оплат в выборке (11/11)</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Цена без закрытия</p>
          <p className="mt-2 text-3xl font-black text-rose-700">19%</p>
          <p className="mt-1 text-sm text-slate-600">оплат (3/16)</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">До цены у оплативших</p>
          <p className="mt-2 text-3xl font-black text-slate-950">155 мин</p>
          <p className="mt-1 text-sm text-slate-600">медиана</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">До цены у неоплаченных</p>
          <p className="mt-2 text-3xl font-black text-slate-950">288 мин</p>
          <p className="mt-1 text-sm text-slate-600">медиана</p>
        </article>
      </section>

      <section className="card mb-6 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Доказательство на данных</h2>
            <p className="mt-1 text-sm text-slate-600">
              Май–август 2026 · ~172 диалога Open Lines по лидам Забковых (оплаченные vs неоплаченные).
            </p>
          </div>
          <Target className="shrink-0 text-rose-600" size={22} />
        </div>
        <div className="space-y-4">
          {PROOF_BARS.map((bar) => (
            <ProofBar key={bar.label} {...bar} />
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          * «Без цены в чате» ~50% — артефакт выборки и каналов (счёт/телефон/другие сессии). Ключевой контраст: цена+закрытие vs цена без дожима.
        </p>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {[
          { step: "1", title: "Цена", text: "Вилка или конкретный SKU. В первом ответе на «сколько» или сразу после даты." },
          { step: "2", title: "Выбор", text: "Одна позиция. «Какой вариант подходит?» — не десять открытых вопросов." },
          { step: "3", title: "Закрытие", text: "«Оформляем» → имя/телефон/почта → сумма → способ оплаты." }
        ].map((item) => (
          <article key={item.step} className="card p-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-rose-600">Ход {item.step}</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="card mb-6 p-6">
        <h2 className="text-xl font-black text-slate-950">Живые ситуации — выбери и отработай</h2>
        <p className="mt-1 text-sm text-slate-600">Скрипты собраны с оплаченных диалогов Анастасии и Елены.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SITUATIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSituationId(item.id)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                situationId === item.id
                  ? "bg-slate-900 text-white"
                  : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {index + 1}. {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--line)] bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Клиент</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{situation.client}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{situation.why}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Скрипт</p>
            <button
              type="button"
              onClick={copyScript}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
            >
              <ClipboardCopy size={14} />
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-slate-900">{situation.script}</pre>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Из живого диалога</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{situation.live}</p>
        </div>
      </section>

      {audience === "rop" ? (
        <section className="card mb-6 border-rose-200 p-6">
          <h2 className="text-xl font-black text-slate-950">Как провести разбор за 15 минут</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>
              <span className="font-black text-slate-950">1.</span> Покажи бар 100% vs 19% — менеджер повторяет: цена без закрытия не считается.
            </li>
            <li>
              <span className="font-black text-slate-950">2.</span> Выберите одну ситуацию выше. Менеджер пишет ответ своими словами.
            </li>
            <li>
              <span className="font-black text-slate-950">3.</span> Сверь с формулой 3 хода: есть цифра? есть выбор? есть оформление?
            </li>
            <li>
              <span className="font-black text-slate-950">4.</span> Разберите один вчерашний чат менеджера: где оборвалась цепочка.
            </li>
            <li>
              <span className="font-black text-slate-950">5.</span> Домашка: 3 диалога сегодня с явной SKU-ценой и закрытием.
            </li>
          </ol>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-bold">Сигнал</th>
                  <th className="py-2 pr-4 font-bold">Хорошо</th>
                  <th className="py-2 font-bold">Плохо</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {[
                  ["Цена", "Вилка или SKU за 1–2 реплики", "Консультация без суммы"],
                  ["Выбор", "Один оффер + вопрос выбора", "Бесконечный подбор"],
                  ["Закрытие", "Счёт / данные / ЕРИП", "«Напишите, если решите»"],
                  ["После «подумаю»", "Цифра + способ оплаты + срок", "Новая лекция про архив"]
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4 font-bold text-slate-950">{row[0]}</td>
                    <td className="py-3 pr-4">{row[1]}</td>
                    <td className="py-3">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card mb-6 p-6">
          <h2 className="text-xl font-black text-slate-950">Чеклист перед отправкой</h2>
          <p className="mt-1 text-sm text-slate-600">Отметь перед каждым «продающим» сообщением.</p>
          <ul className="mt-4 space-y-3">
            {[
              { id: "c1", text: "В сообщении есть число (вилка или SKU)?" },
              { id: "c2", text: "Клиенту предложено выбрать один вариант?" },
              { id: "c3", text: "Есть фраза оформления или запрос данных?" },
              { id: "c4", text: "Способ оплаты назван или спросили «как удобнее»?" }
            ].map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    checks[item.id]
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[var(--line)] bg-white hover:bg-slate-50"
                  }`}
                >
                  <CheckCircle2
                    size={18}
                    className={`mt-0.5 shrink-0 ${checks[item.id] ? "text-emerald-600" : "text-slate-300"}`}
                  />
                  <span className="text-sm font-semibold text-slate-800">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-sm text-slate-500">
        Вернуться в{" "}
        <Link href="/training/knowledge-base" className="font-bold text-blue-600 hover:underline">
          базу знаний
        </Link>
      </p>
    </TrainingLayout>
  );
}
