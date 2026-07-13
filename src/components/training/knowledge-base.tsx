"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardList, CreditCard, ExternalLink, MapPin, MessageCircle, Pencil, Plus, Save, Search, Send, ShoppingBag, PenLine, Trash2, Truck, X } from "lucide-react";
import { generateId } from "@/lib/training/id";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import { useTrainingUser } from "@/components/training/training-context";
import type {
  KnowledgeBaseCatalog,
  KnowledgeBaseEntry,
  KnowledgeBaseMediaType
} from "@/types/training";

function emptyEntry(sortOrder: number): KnowledgeBaseEntry {
  return {
    id: generateId("kb"),
    question: "",
    answer: "",
    category: "",
    mediaType: "none",
    mediaUrl: "",
    embedUrl: "",
    sortOrder
  };
}

const LIVE_LINKS = [
  {
    label: "Интернет-магазин (Европа)",
    description: "retropressa.com",
    href: "https://retropressa.com/ru/",
    Icon: ShoppingBag
  },
  {
    label: "Интернет-магазин (Беларусь)",
    description: "retropressa.net",
    href: "https://retropressa.net/ru/",
    Icon: ShoppingBag
  },
  {
    label: "Сервис для написания статей",
    description: "retropressa.online",
    href: "https://retropressa.online/",
    Icon: PenLine
  },
  {
    label: "Бот для написания статей",
    description: "t.me/retro_writer_bot",
    href: "https://t.me/retro_writer_bot",
    Icon: Send
  },
  {
    label: "Номера заказов (Европа)",
    description: "admin5.profita.biz",
    href: "https://admin5.profita.biz/",
    Icon: ClipboardList
  },
  {
    label: "Заказы (Беларусь)",
    description: "crm5.profita.biz",
    href: "https://crm5.profita.biz/",
    Icon: ClipboardList
  }
] as const;

function LiveLinksSection() {
  return (
    <section className="card border-rose-200 bg-rose-50/60 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Боевые ссылки</h2>
          <p className="mt-1 text-sm text-slate-600">Сервисы, которыми менеджеры пользуются каждый день.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LIVE_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 transition hover:border-rose-300 hover:bg-rose-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <link.Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-950">{link.label}</span>
              <span className="block truncate text-xs text-slate-500">{link.description}</span>
            </span>
            <ExternalLink size={16} className="shrink-0 text-slate-400 group-hover:text-rose-600" />
          </a>
        ))}
      </div>
    </section>
  );
}

function PaymentField({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm leading-relaxed text-slate-700">
      <span className="font-bold text-slate-900">{label}: </span>
      <span className="break-all font-mono">{value}</span>
    </p>
  );
}

const CITY_ROUTING_ROWS = [
  {
    orderType: "Репродукции и поздравительные газеты",
    city: "Рига",
    watchers: "Галина Кулиш, Ольга Козлова",
    designer: "Татьяна"
  },
  {
    orderType: "Репродукции и поздравительные газеты",
    city: "Минск",
    watchers: "Екатерина, Ольга",
    designer: "Татьяна"
  },
  {
    orderType: "Оригиналы",
    city: "Рига",
    watchers: "Галина",
    designer: "—"
  },
  {
    orderType: "Оригиналы",
    city: "Минск",
    watchers: "Екатерина",
    designer: "—"
  }
] as const;

function CityRoutingSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <MapPin size={20} />
          </span>
          <span>
            <span className="block text-xl font-black text-slate-950">
              Инструкция по коммуникации: распределение по городам
            </span>
            <span className="block text-sm text-slate-600">Кого подключать к заказу в зависимости от типа и города.</span>
          </span>
        </span>
        <ChevronDown
          size={22}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="border-t border-[var(--line)] px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">
            При оформлении заказа определите тип изделия и город производства — от этого зависит, кого
            подключать к работе.
          </p>
          <div className="table-scroll mt-4">
            <table>
              <thead>
                <tr>
                  <th>Тип заказа</th>
                  <th>Город</th>
                  <th>Наблюдатели / ответственные</th>
                  <th>Дизайнер</th>
                </tr>
              </thead>
              <tbody>
                {CITY_ROUTING_ROWS.map((row, index) => (
                  <tr key={`${row.orderType}-${row.city}-${index}`}>
                    <td className="whitespace-normal font-semibold text-slate-900">{row.orderType}</td>
                    <td className="whitespace-normal">{row.city}</td>
                    <td className="whitespace-normal">{row.watchers}</td>
                    <td className="whitespace-normal">{row.designer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WhatsappArchiveSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <MessageCircle size={20} />
          </span>
          <span>
            <span className="block text-xl font-black text-slate-950">
              Запросы клиентов по оригиналам и репродукциям
            </span>
            <span className="block text-sm text-slate-600">Куда писать по фото оригиналов и репродукциям.</span>
          </span>
        </span>
        <ChevronDown
          size={22}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-6 py-5">
          <figure className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/training/knowledge-base/original-reproduction-flow.png"
              alt="Инфографика: запрос клиента — оригинал или репродукция"
              className="w-full"
            />
          </figure>

          <div>
            <p className="text-lg font-bold text-slate-900">Сначала определите, к какому офису относится заказ:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg leading-relaxed text-slate-700">
              <li>
                заказ с retropressa.com — рижский офис; запросы по оригиналам отправляем в WhatsApp-группу
                «Архив»;
              </li>
              <li>
                заказ с retropressa.net — минский офис; запросы по оригиналам отправляем в Telegram-группу
                «Минск».
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-lg font-black text-slate-900">Если клиент просит фото оригинала</h3>
            <p className="mt-2 text-lg leading-relaxed text-slate-700">
              Например, клиент хочет увидеть, как выглядела газета или что было напечатано в журнале в
              конкретную дату.
            </p>
            <p className="mt-2 text-lg leading-relaxed text-slate-700">
              Отправьте запрос в нужную группу и отметьте ответственного:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg leading-relaxed text-slate-700">
              <li>Рига — Женя;</li>
              <li>Минск — Екатерина.</li>
            </ul>
            <p className="mt-2 text-lg leading-relaxed text-slate-700">В сообщении обязательно укажите:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-lg leading-relaxed text-slate-700">
              <li>дату;</li>
              <li>название газеты или журнала;</li>
              <li>что именно клиент просит найти или сфотографировать.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-lg font-black text-slate-900">
              Если клиент просит репродукцию, которой нет в интернет-магазине
            </h3>
            <p className="mt-2 text-lg leading-relaxed text-slate-700">
              Напишите Саше и уточните, выходила ли такая газета за нужную дату.
            </p>
            <p className="mt-2 text-lg leading-relaxed text-slate-700">
              Не обещайте клиенту наличие репродукции, пока не получите подтверждение. После ответа Саши
              сообщите клиенту, возможна ли репродукция, и согласуйте дальнейшие шаги.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DeliverySection() {
  const [open, setOpen] = useState(false);

  const headingClass = "text-lg font-black text-slate-950";
  const subheadingClass = "text-sm font-black uppercase tracking-wide text-slate-600";
  const textClass = "text-base leading-relaxed text-slate-700";
  const listClass = "mt-2 list-disc space-y-1 pl-5 text-base leading-relaxed text-slate-700";
  const cardClass = "rounded-xl border border-[var(--line)] bg-slate-50 p-4";

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Truck size={20} />
          </span>
          <span>
            <span className="block text-xl font-black text-slate-950">Доставка</span>
            <span className="block text-sm text-slate-600">Способы, сроки и стоимость доставки по странам.</span>
          </span>
        </span>
        <ChevronDown
          size={22}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-6 py-5">
          <div className={cardClass}>
            <h3 className={subheadingClass}>Перед оформлением доставки уточните у клиента</h3>
            <ul className={listClass}>
              <li>страну и город;</li>
              <li>нужен ли адрес или пункт выдачи;</li>
              <li>насколько срочно нужен заказ;</li>
              <li>сможет ли получатель принять курьера, если выбирает доставку DPD на дом.</li>
            </ul>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>1. Европа: DPD</h3>
            <p className={`mt-2 ${textClass}`}>
              Ссылка для поиска пункта выдачи или пакомата DPD:{" "}
              <a
                href="https://www.dpdgroup.com/be/mydpd/parcel-shops"
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-bold text-blue-600 hover:text-blue-800"
              >
                dpdgroup.com/be/mydpd/parcel-shops
              </a>
            </p>

            <p className="mt-4 text-base font-bold text-slate-900">Германия и большинство стран ЕС</p>
            <ul className={listClass}>
              <li>DPD в пункт выдачи — 11 EUR, срок 3–6 дней.</li>
              <li>DPD на дом — 21 EUR, срок 3–6 дней.</li>
            </ul>

            <p className="mt-4 text-base font-bold text-slate-900">Италия, Болгария и Норвегия</p>
            <p className={`mt-1 ${textClass}`}>В эти страны DPD доступен только с доставкой на дом:</p>
            <ul className={listClass}>
              <li>DPD на дом — 21 EUR.</li>
              <li>Альтернатива: PUMITY — 13 EUR, срок 7–14 дней.</li>
            </ul>

            <p className="mt-4 text-base font-bold text-slate-900">Эстония и Литва</p>
            <ul className={listClass}>
              <li>DPD — 6 EUR, срок 1–3 дня.</li>
            </ul>

            <p className="mt-4 text-base font-bold text-slate-900">Латвия</p>
            <ul className={listClass}>
              <li>DPD в пункт выдачи — 4 EUR.</li>
              <li>DPD на дом — 6 EUR.</li>
              <li>Срок доставки — 1–2 дня.</li>
            </ul>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-base font-bold text-amber-900">Важно: доставка DPD на дом</p>
              <p className="mt-1 text-base leading-relaxed text-amber-900">
                Если клиент выбирает доставку DPD на дом, обязательно отправьте ему сообщение:
              </p>
              <p className="mt-2 border-l-4 border-amber-300 pl-3 text-base italic leading-relaxed text-amber-900">
                Спасибо за покупку! Обращаем ваше внимание, что доставка осуществляется курьером DPD до
                двери, при этом курьер совершает только одну попытку вручения. Если в момент доставки
                получателя не окажется дома, посылка будет возвращена отправителю. Просим отнестись к этому
                с пониманием и обеспечить возможность получения заказа в указанный день.
              </p>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>2. PUMITY</h3>
            <ul className={listClass}>
              <li>Стоимость — 13 EUR.</li>
              <li>Срок — 7–14 дней.</li>
            </ul>
            <p className={`mt-2 ${textClass}`}>
              Доступно для доставки в Казахстан, Азербайджан, Грузию, Турцию, Италию, Болгарию и другие
              дальние страны.
            </p>
            <p className="mt-4 text-base font-bold text-slate-900">Израиль, Англия и Норвегия</p>
            <ul className={listClass}>
              <li>PUMITY — 19 EUR.</li>
              <li>Срок — 7–14 дней.</li>
            </ul>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>3. Молдова</h3>
            <p className={`mt-2 ${textClass}`}>Предложите клиенту два варианта:</p>
            <div className="table-scroll mt-3">
              <table>
                <thead>
                  <tr>
                    <th>Способ доставки</th>
                    <th>Стоимость</th>
                    <th>Срок</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="whitespace-normal">Novapost</td>
                    <td>20 EUR</td>
                    <td className="whitespace-normal">6–7 дней</td>
                  </tr>
                  <tr>
                    <td className="whitespace-normal">PUMITY: курьером на адрес или в пункт выдачи</td>
                    <td>13 EUR</td>
                    <td className="whitespace-normal">около 10 рабочих дней</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={`mt-3 ${textClass}`}>
              В обоих случаях посылка отправляется с трек-номером для отслеживания.
            </p>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>4. Россия и Ашхабад: СДЭК через Минск</h3>
            <ul className={listClass}>
              <li>Стандартная стоимость — 13 EUR.</li>
              <li>
                Для удалённых городов на востоке России стоимость может быть 15 EUR — обязательно уточните
                перед тем, как назвать цену клиенту.
              </li>
              <li>Иногда возможна доставка в Ашхабад.</li>
            </ul>
            <p className={`mt-2 ${textClass}`}>
              Доставка в Минск отправляется раз в неделю, обычно в понедельник. К пятнице заказы должны быть
              в офисе. Ближайшую дату отправки уточняйте у Анны.
            </p>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>5. Экспресс-доставка DHL</h3>
            <ul className={listClass}>
              <li>Стоимость — от 50 EUR.</li>
              <li>Срок — 1–5 дней.</li>
            </ul>
            <p className={`mt-2 ${textClass}`}>Предлагайте DHL, если клиенту нужен заказ максимально быстро.</p>
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>Минский офис — доставка по Минску</h3>
            <ul className={listClass}>
              <li>Стоимость — 15 BYN.</li>
              <li>Срок — 1–4 дня.</li>
            </ul>
            <p className={`mt-2 ${textClass}`}>
              Также в базе может использоваться ориентир: 13 EUR / 45 BYN — при необходимости уточняйте
              актуальную стоимость у ответственного.
            </p>
            <p className="mt-4 text-base font-bold text-slate-900">Самовывоз</p>
            <p className={`mt-1 ${textClass}`}>Клиент может самостоятельно забрать заказ по адресу:</p>
            <p className="mt-1 text-base font-bold text-slate-900">
              г. Минск, ул. Якуба Коласа, 37, офис 52
            </p>
            <p className={`mt-1 ${textClass}`}>Будние дни: с 9:00 до 19:00</p>
            <p className={`mt-2 ${textClass}`}>
              Яндекс.Карты с фотографиями входа:{" "}
              <a
                href="https://yandex.by/maps/-/CLgVu8jq"
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-bold text-blue-600 hover:text-blue-800"
              >
                yandex.by/maps/-/CLgVu8jq
              </a>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PaymentMethodsSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <CreditCard size={20} />
          </span>
          <span>
            <span className="block text-xl font-black text-slate-950">Способы оплаты</span>
            <span className="block text-sm text-slate-600">Реквизиты и ссылки для приёма оплаты.</span>
          </span>
        </span>
        <ChevronDown
          size={22}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-6 py-5">
          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">Часы работы офиса</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">Пн – пт с 9:00 до 18:00</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Реквизиты — Рига (Европа и Молдова)
            </h3>
            <div className="mt-2 space-y-1">
              <PaymentField label="Получатель" value="BB-Wood SIA" />
              <PaymentField label="Адрес офиса" value="Riga, Braslas 24" />
              <PaymentField label="Банк" value="Citadele Banka" />
              <PaymentField label="SWIFT" value="PARXLV22" />
              <PaymentField label="Счёт" value="LV60PARX0020928050001" />
            </div>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
              Платить могут клиенты из Европы и Молдовы. Другие страны СНГ не должны платить на этот счёт —
              входящий платёж стоит для нас 100 евро.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Реквизиты — Минск (Беларусь)
            </h3>
            <div className="mt-2 space-y-1">
              <PaymentField label="Получатель" value="ООО «ДУШЕВНЫЕ ПОДАРКИ»" />
              <PaymentField label="Адрес офиса" value="г. Минск, ул. Якуба Коласа, д. 37, пом. 52" />
              <PaymentField label="УНП" value="193870866" />
              <PaymentField
                label="Расчётный счёт (BYN)"
                value="BY46ALFA30122G94740010270000, ЗАО «Альфа-Банк»"
              />
              <PaymentField label="БИК" value="ALFABY2X" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              <span className="font-bold text-slate-900">Оплата по ЕРИП — дерево ЕРИП: </span>
              Платежи → Платежи ЕРИП → Интернет-магазины/сервисы → A-Z Латинские домены → Retropressa.by.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Банковская сгенерированная ссылка (карта, Google Pay / Apple Pay)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Можно оплачивать из любой страны, банки которой не под санкциями. Revolut-ссылка:
            </p>
            <a
              href="https://checkout.revolut.com/pay/43575188-111a-44c0-be70-8b4cab8a6f5f"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              checkout.revolut.com/pay/43575188-111a-44c0-be70-8b4cab8a6f5f
            </a>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Клиент сам ставит сумму к оплате и вводит номер заказа.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Казахстан — Kaspi Bank (в тенге)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Перед переводом переводим валюту в тенге.
            </p>
            <div className="mt-2 space-y-1">
              <PaymentField label="Получатель" value="Lastovska Anna, АО Kaspi Bank" />
              <PaymentField label="SWIFT" value="CASPKZKA" />
              <PaymentField label="IBAN" value="KZ58722C000108179139" />
              <PaymentField label="Номер карты" value="4400430370483874 — ANNA LASTOVSKA" />
              <PaymentField label="Перевод по номеру телефона" value="+7 747 607 49 65" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Россия — Т-банк (в рублях)
            </h3>
            <div className="mt-2 space-y-1">
              <PaymentField label="Телефон" value="+7 993 897 50 60" />
              <PaymentField label="Получатель" value="Анна Ластовска" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Грузия / с карты на карту
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Если клиент из Грузии или хочет оплатить с карты на карту — предлагаем грузинскую карту или
              расчётный счёт в Грузии.
            </p>
            <div className="mt-2 space-y-1">
              <PaymentField label="Счёт (евро и лари)" value="GE18BG0000000544555285 — Anna Lastovska" />
              <PaymentField label="Номер карты" value="4116 3400 8840 3137 — Anna Lastovska" />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">Wise</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Если клиент хочет оплатить через Wise — посылаем ссылку:
            </p>
            <a
              href="https://wise.com/pay/me/annal5395"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-bold text-blue-600 hover:text-blue-800"
            >
              wise.com/pay/me/annal5395
            </a>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Клиент сам ставит сумму к оплате и вводит номер заказа.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">PayPal</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Ссылка запрашивается у РОПа или руководителя. Для запроса нужно знать email клиента (на
              который зарегистрирован PayPal) и сумму к оплате.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EntryMedia({ entry }: { entry: KnowledgeBaseEntry }) {
  if (entry.mediaType === "video") {
    const src = normalizeVideoEmbedUrl(entry.mediaUrl ?? entry.embedUrl);
    if (!src) return null;
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-black">
        <div className="aspect-video">
          <iframe
            src={src}
            title={entry.question}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (entry.mediaType === "image" && entry.mediaUrl) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.mediaUrl} alt={entry.question} className="w-full object-cover" />
      </div>
    );
  }

  return null;
}

function EntryCard({ entry }: { entry: KnowledgeBaseEntry }) {
  return (
    <section className="card p-6">
      {entry.category ? (
        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-slate-600">
          {entry.category}
        </span>
      ) : null}
      <h3 className="mt-3 text-2xl font-black text-slate-950">{entry.question}</h3>
      {entry.answer ? (
        <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-slate-700">{entry.answer}</p>
      ) : null}
      <EntryMedia entry={entry} />
    </section>
  );
}

function EntryEditor({
  entry,
  index,
  onChange,
  onRemove
}: {
  entry: KnowledgeBaseEntry;
  index: number;
  onChange: (patch: Partial<KnowledgeBaseEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-black text-slate-950">Вопрос {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Удалить
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm font-bold text-slate-800">Вопрос</span>
          <input
            type="text"
            value={entry.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Например: Как оформить возврат?"
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-800">Категория</span>
          <input
            type="text"
            value={entry.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value })}
            placeholder="CRM, Продажи, Продукт..."
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-800">Тип вложения</span>
          <select
            value={entry.mediaType}
            onChange={(event) => onChange({ mediaType: event.target.value as KnowledgeBaseMediaType })}
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          >
            <option value="none">Без вложения</option>
            <option value="video">Видео (YouTube)</option>
            <option value="image">Фото (ссылка)</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-bold text-slate-800">Ответ</span>
          <textarea
            value={entry.answer}
            onChange={(event) => onChange({ answer: event.target.value })}
            rows={4}
            placeholder="Текст ответа для менеджеров"
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          />
        </label>
        {entry.mediaType !== "none" ? (
          <label className="block md:col-span-2">
            <span className="text-sm font-bold text-slate-800">
              {entry.mediaType === "video" ? "Ссылка на YouTube" : "Ссылка на изображение"}
            </span>
            <input
              type="url"
              value={entry.mediaUrl ?? ""}
              onChange={(event) => onChange({ mediaUrl: event.target.value, embedUrl: "" })}
              placeholder={
                entry.mediaType === "video"
                  ? "https://www.youtube.com/watch?v=..."
                  : "https://.../photo.jpg"
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
            />
          </label>
        ) : null}
      </div>

      <EntryMedia entry={entry} />
    </section>
  );
}

export function KnowledgeBase() {
  const { isAdmin } = useTrainingUser();
  const [catalog, setCatalog] = useState<KnowledgeBaseCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/training/knowledge-base", { cache: "no-store" });
      const data = (await response.json()) as { catalog?: KnowledgeBaseCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось загрузить базу знаний");
      }
      setCatalog(data.catalog);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить базу знаний");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.entries;
    return catalog.entries.filter((entry) =>
      [entry.question, entry.answer, entry.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [catalog, query]);

  const updateEntry = (index: number, patch: Partial<KnowledgeBaseEntry>) => {
    setCatalog((current) => {
      if (!current) return current;
      const entries = current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      );
      return { ...current, entries };
    });
  };

  const addEntry = () => {
    setCatalog((current) => {
      if (!current) return current;
      return { ...current, entries: [...current.entries, emptyEntry(current.entries.length + 1)] };
    });
  };

  const removeEntry = (index: number) => {
    setCatalog((current) => {
      if (!current) return current;
      return {
        ...current,
        entries: current.entries
          .filter((_, entryIndex) => entryIndex !== index)
          .map((entry, entryIndex) => ({ ...entry, sortOrder: entryIndex + 1 }))
      };
    });
  };

  const save = async () => {
    if (!catalog) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/training/knowledge-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog)
      });
      const data = (await response.json()) as { catalog?: KnowledgeBaseCatalog; error?: string };
      if (!response.ok || !data.catalog) {
        throw new Error(data.error ?? "Не удалось сохранить базу знаний");
      }
      setCatalog(data.catalog);
      setMessage("База знаний сохранена.");
      setEditMode(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить базу знаний");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка базы знаний...</div>;
  }

  if (!catalog) {
    return <div className="card p-8 text-sm text-red-600">{error ?? "Не удалось загрузить базу знаний."}</div>;
  }

  if (isAdmin && editMode) {
    return (
      <div className="space-y-4">
        <section className="card flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Редактирование базы знаний</h2>
            <p className="mt-1 text-sm text-slate-600">Добавляйте вопросы, ответы и вложения (видео/фото).</p>
          </div>
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <X size={16} />
            Отмена
          </button>
        </section>

        {catalog.entries.map((entry, index) => (
          <EntryEditor
            key={entry.id}
            entry={entry}
            index={index}
            onChange={(patch) => updateEntry(index, patch)}
            onRemove={() => removeEntry(index)}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addEntry}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} />
            Добавить вопрос
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">База знаний</h2>
            <p className="mt-1 text-sm text-slate-600">Ответы на частые вопросы: текст, видео и фото.</p>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setEditMode(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100"
            >
              <Pencil size={16} />
              Редактировать
            </button>
          ) : null}
        </div>

        <div className="relative mt-5">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по вопросам и ответам..."
            className="w-full rounded-xl border border-[var(--line)] py-3 pl-11 pr-4 text-base"
          />
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </section>

      <LiveLinksSection />

      <CityRoutingSection />

      <WhatsappArchiveSection />

      <DeliverySection />

      <PaymentMethodsSection />

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-600">
          {query.trim() ? "Ничего не найдено. Попробуйте изменить запрос." : "База знаний пока пуста."}
        </div>
      ) : (
        filtered.map((entry) => <EntryCard key={entry.id} entry={entry} />)
      )}
    </div>
  );
}
