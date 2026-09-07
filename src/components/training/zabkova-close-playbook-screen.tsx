"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCopy, Download, GraduationCap, Target, Users } from "lucide-react";
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
    label: "Клиент сразу спрашивает цену",
    client: "Сколько стоит газета? Вы доставите к нам?",
    why: "В первом ответе уже должна быть цена. Нельзя отвечать длинным списком без цифр.",
    script: `Добрый день! Это [Имя], менеджер retro-pressa.
Стоимость изданий — от 15 до 64 евро. Доставляем по всему миру.
Напишите, пожалуйста, дату рождения именинника и город. Я сразу пришлю, что есть в архиве, уже с ценами.

Когда клиент назвал дату:
Отлично! Оригинальная газета «Правда» за [дата] стоит 45 евро. Вам подходит?
Тогда оформляю счёт. Напишите имя и телефон. Доставка — [сумма] евро.
Оплатить можно переводом, картой, PayPal или Wise. Как вам удобнее?`,
    live: "Так делала Анастасия: в первом сообщении назвала диапазон цен, потом сказала точную цену «Правда — 45 евро», и клиент оплатил."
  },
  {
    id: "what_available",
    label: "Клиент спрашивает, что есть на дату",
    client: "День рождения мужа — 3 июня 1976 года. Что у вас есть? «За рулём» или «Правда»?",
    why: "В одном сообщении: что есть, сколько стоит, и вопрос «какой вариант берём».",
    script: `За [месяц и год] в архиве есть: [три–пять вариантов].
Журнал «За рулём» — 142 рубля. Любая репродукция газеты — 145 рублей. Доставка — [сумма].
Оригинала газеты именно на этот день нет. Репродукция — точная копия.
Какой вариант берём? Могу сразу оформить заказ.`,
    live: "Так делала Елена: цены написала в одном сообщении, спросила «желаете оформить заказ?» — и получила оплату 407 рублей."
  },
  {
    id: "price_and_deadline",
    label: "Клиент спрашивает цену и торопится",
    client: "Сколько стоит такая газета? Нам нужно уже завтра!",
    why: "Сначала цена и срок. Потом два–три варианта. Потом вопрос: оформляем?",
    script: `Стоимость — от 15 до 64 евро. Если вы в Беларуси, скажу сумму в рублях после города.
Напишите дату и город — и я точно скажу срок.

На [дата] есть:
репродукция — [цена];
поздравительная газета с вашим текстом и фото — [цена].
Если берём «Правду» или «Советский спорт» — обычно до 2 дней. Региональная газета — до 5 дней.
Что вам ближе: обычная репродукция или поздравительная? Оформляем?`,
    live: "Так делала Анастасия в срочном заказе: быстро зафиксировала издание и сразу попросила данные для счёта."
  },
  {
    id: "almost_yes",
    label: "Клиент уже выбрал, но ещё не оплатил",
    client: "Супер, меня устраивает. Как забронировать?",
    why: "Не задавать новые лишние вопросы. Сразу сумма, данные и счёт.",
    script: `Отлично, фиксируем: [издание] за [дата], сумма [N] (доставка [сумма] или самовывоз).
Оформляем заказ?
Если да — пришлите имя, телефон и почту. Если нужна доставка — ещё и адрес.
Счёт отправлю сразу.`,
    live: "Так делали Елена и Анастасия: писали «оформляем», просили данные и сразу давали сумму к оплате."
  },
  {
    id: "think",
    label: "Клиент говорит «надо подумать»",
    client: "Мне надо подумать. А как происходит оплата?",
    why: "Не начинать новый длинный рассказ. Повторить цену и предложить понятный следующий шаг.",
    script: `Конечно. Напомню: [издание] стоит [цена], доставка — [сумма], срок — [срок].
Могу сегодня прислать счёт. Оплатить можно до вечера или до завтра — как вам удобно.
Как вам проще оплатить: картой, переводом или через ЕРИП? Пришлю один удобный вариант.`,
    live: "Забковы в этот момент сразу объясняли оплату. Не откладывали на потом."
  },
  {
    id: "region",
    label: "Клиент выбирает между местной газетой и «Правдой»",
    client: "Хотим местную газету из Могилёва. Или лучше «Правду»?",
    why: "Объяснить разницу простыми словами и сразу предложить оформить выбранный вариант.",
    script: `Если нужна газета на русском и быстрее — лучше «Правда», «Известия» или «Советский спорт». Обычно до 2 дней.
Местная газета готовится дольше, до 5 дней, и часто на местном языке.
Какой вариант берём?
Тогда оформляем [издание] за [дата]. Нужна доставка или заберёте в офисе? Доставка — [сумма]. Дальше сразу сделаю счёт.`,
    live: "Так делала Анастасия с «Магілёўскай праўдай»: согласовали вариант, написали «оформляем», получили оплату 222 рубля."
  }
];

const PROOF_BARS = [
  { label: "Назвали цену и сразу предложили оформить заказ", value: 100, tone: "good" as const },
  { label: "Назвали цену, но не предложили оформить", value: 19, tone: "bad" as const },
  { label: "В чате цену не нашли*", value: 50, tone: "neutral" as const }
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
      title="Как продавали Забковы"
      description="Простая памятка для новых менеджеров и для разбора с руководителем. На реальных диалогах Анастасии и Елены Забковых."
      backHref="/training/knowledge-base"
      backLabel="К базе знаний"
      actions={
        <a
          href="/training/zabkova-kak-prodavali.pdf"
          download="Как продавали Забковы.pdf"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
        >
          <Download size={16} />
          Скачать PDF
        </a>
      }
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
          Я новый менеджер
        </button>
        <button
          type="button"
          onClick={() => setAudience("rop")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            audience === "rop" ? "bg-rose-600 text-white" : "border border-[var(--line)] bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Users size={16} />
          Я руководитель, провожу разбор
        </button>
      </div>

      <section className="card mb-6 border-amber-200 bg-amber-50/70 p-6">
        <p className="text-sm font-extrabold uppercase tracking-wide text-amber-800">Главное одной фразой</p>
        <p className="mt-2 text-lg font-black leading-8 text-slate-950">
          Не надо просто «отвечать быстрее». Нужно сделать три простых шага: назвать цену, помочь выбрать один вариант и сразу предложить оформить заказ.
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Цена и оформление вместе</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">100%</p>
          <p className="mt-1 text-sm text-slate-600">таких диалогов закончились оплатой</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Только цена, без оформления</p>
          <p className="mt-2 text-3xl font-black text-rose-700">19%</p>
          <p className="mt-1 text-sm text-slate-600">таких диалогов закончились оплатой</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">У тех, кто оплатил</p>
          <p className="mt-2 text-3xl font-black text-slate-950">около 2,5 часов</p>
          <p className="mt-1 text-sm text-slate-600">обычно до первой цены в чате</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">У тех, кто не оплатил</p>
          <p className="mt-2 text-3xl font-black text-slate-950">около 5 часов</p>
          <p className="mt-1 text-sm text-slate-600">обычно до первой цены в чате</p>
        </article>
      </section>

      <section className="card mb-6 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Что показали цифры</h2>
            <p className="mt-1 text-sm text-slate-600">
              Смотрели диалоги Анастасии и Елены с мая по август 2026 года. Сравнивали оплаченные и неоплаченные заявки.
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
          * Иногда цену в чате не видно, потому что счёт ушёл другим способом. Главное сравнение другое: если цену назвали и сразу предложили оформить — почти всегда была оплата. Если цену назвали и остановились — оплат почти не было.
        </p>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {[
          {
            step: "1",
            title: "Назвать цену",
            text: "Напишите диапазон или точную сумму. Особенно если клиент спросил «сколько стоит»."
          },
          {
            step: "2",
            title: "Помочь выбрать",
            text: "Предложите один–два понятных варианта и спросите: какой берём?"
          },
          {
            step: "3",
            title: "Предложить оформить",
            text: "Напишите «оформляем», попросите имя и телефон, скажите сумму и как оплатить."
          }
        ].map((item) => (
          <article key={item.step} className="card p-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-rose-600">Шаг {item.step}</p>
            <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="card mb-6 p-6">
        <h2 className="text-xl font-black text-slate-950">Живые ситуации. Выберите и потренируйтесь</h2>
        <p className="mt-1 text-sm text-slate-600">Тексты собраны из реальных оплаченных диалогов Анастасии и Елены.</p>
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
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Что пишет клиент</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{situation.client}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{situation.why}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Что можно ответить</p>
            <button
              type="button"
              onClick={copyScript}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
            >
              <ClipboardCopy size={14} />
              {copied ? "Скопировано" : "Скопировать текст"}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-slate-900">{situation.script}</pre>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Как было в живом диалоге</p>
          <p className="mt-2 text-sm leading-6 text-slate-800">{situation.live}</p>
        </div>
      </section>

      {audience === "rop" ? (
        <section className="card mb-6 border-rose-200 p-6">
          <h2 className="text-xl font-black text-slate-950">Как провести разбор за 15 минут</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <li>
              <span className="font-black text-slate-950">1.</span> Покажите цифры: 100 процентов против 19 процентов. Пусть менеджер своими словами скажет: одной цены мало, нужно ещё предложить оформить заказ.
            </li>
            <li>
              <span className="font-black text-slate-950">2.</span> Выберите одну ситуацию выше. Пусть менеджер напишет свой ответ.
            </li>
            <li>
              <span className="font-black text-slate-950">3.</span> Проверьте три вещи: есть ли цена, есть ли выбор, есть ли предложение оформить.
            </li>
            <li>
              <span className="font-black text-slate-950">4.</span> Возьмите один вчерашний чат менеджера и найдите, на каком шаге он остановился.
            </li>
            <li>
              <span className="font-black text-slate-950">5.</span> Дайте задание на сегодня: в трёх диалогах назвать точную цену и сразу предложить оформить заказ.
            </li>
          </ol>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-bold">На что смотреть</th>
                  <th className="py-2 pr-4 font-bold">Хорошо</th>
                  <th className="py-2 font-bold">Плохо</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {[
                  ["Цена", "Есть сумма уже в первых ответах", "Долгий разговор без суммы"],
                  ["Выбор", "Один–два варианта и вопрос «какой берём»", "Бесконечный подбор без решения"],
                  ["Оформление", "Просят данные и дают способ оплаты", "Пишут «напишите, если решите»"],
                  ["Если клиент думает", "Повторяют цену и предлагают прислать счёт", "Снова долго рассказывают про архив"]
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
          <h2 className="text-xl font-black text-slate-950">Проверьте себя перед отправкой</h2>
          <p className="mt-1 text-sm text-slate-600">Отметьте галочки перед сообщением, которым хотите продвинуть продажу.</p>
          <ul className="mt-4 space-y-3">
            {[
              { id: "c1", text: "В сообщении есть цена: диапазон или точная сумма?" },
              { id: "c2", text: "Клиенту предложено выбрать один понятный вариант?" },
              { id: "c3", text: "Есть фраза про оформление или просьба прислать данные?" },
              { id: "c4", text: "Назван способ оплаты или спросили, как удобнее оплатить?" }
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
