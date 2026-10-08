"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Copy } from "lucide-react";

type KnowledgePhoto = {
  id: string;
  title: string;
  url: string;
};

type KnowledgeArticle = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  hrefLabel: string;
  paragraphs: string[];
  bullets?: string[];
  photos: KnowledgePhoto[];
};

const ARTICLES: KnowledgeArticle[] = [
  {
    id: "reproduction",
    title: "Оригинал и репродукция",
    subtitle: "Газета из дня рождения / издание из важной даты",
    href: "/training/products/personal-newspaper",
    hrefLabel: "Открыть карточку издания из даты",
    paragraphs: [
      "Газета бывает как оригинал, так и репродукция.",
      "Репродукция — это дигитальная версия из прошлого, распечатанная на специальной бумаге."
    ],
    bullets: [
      "Оригинал — настоящий архивный экземпляр, который вышел в тот день и лежит на складе.",
      "Репродукцию предлагают, когда оригинала на складе нет или клиенту достаточно печатной копии.",
      "Варианты репродукции: газета или журнал; региональные издания — через чат «Репродукция».",
      "Это не поздравительная газета: внутри нет фото и текста клиента.",
      "Это не «Дигитальная версия»: файл без печати — отдельный продукт.",
      "Не обещать архивный подлинник, если продаёте репродукцию."
    ],
    photos: [
      {
        id: "reproduction-izvestiya-1962",
        title: "Репродукция — «Известия», 21 июня 1962",
        url: "/training/reproduction/izvestiya-1962.jpg"
      },
      {
        id: "reproduction-sovetskaya-molodezh-1953",
        title: "Репродукция — «Советская молодёжь», 10 февраля 1953",
        url: "/training/reproduction/sovetskaya-molodezh-1953.jpg"
      },
      {
        id: "reproduction-ichkeria-1993",
        title: "Репродукция — «Ичкерия», 2 сентября 1993",
        url: "/training/reproduction/ichkeria-1993.jpg"
      }
    ]
  },
  {
    id: "life-book-headlines",
    title: "Книга жизни в заголовках газет",
    subtitle: "Газеты за каждый год жизни, не интервью-книга",
    href: "/training/products/personal-magazine",
    hrefLabel: "Открыть карточку книги в заголовках",
    paragraphs: [
      "Это книга из газет за каждый год жизни человека. Первая страница начинается с даты рождения, дальше — год за годом.",
      "Не путать с «Книгой жизни»: там интервьюер берёт интервью, и из рассказа делается книга о человеке."
    ],
    photos: [
      {
        id: "life-book-papa-pravda-cover",
        title: "«Папина правда, или 80 лет через прессу» — обложка",
        url: "/training/life-book/papa-pravda-cover.jpg"
      },
      {
        id: "life-book-papa-pravda-title",
        title: "«Папина правда» — титульный лист",
        url: "/training/life-book/papa-pravda-title-page.jpg"
      },
      {
        id: "life-book-papa-pravda-page",
        title: "«Папина правда» — газетный разворот",
        url: "/training/life-book/papa-pravda-newspaper-page.jpg"
      }
    ]
  },
  {
    id: "packaging",
    title: "Упаковка",
    subtitle: "Фото упаковки, которые можно отправить клиенту",
    href: "/training/products/personal-newspaper",
    hrefLabel: "Открыть карточку издания из даты",
    paragraphs: [
      "К изданию из даты можно подобрать упаковку: папка «почтовый ящик», почтовый конверт, упаковка «Dāvinām jaunības atmiņas»."
    ],
    photos: [
      {
        id: "packaging-mailbox-folder",
        title: "Папка «почтовый ящик» Retro Pressa",
        url: "/training/packaging/mailbox-folder.jpg"
      },
      {
        id: "packaging-airmail-envelope",
        title: "Почтовый конверт Retro Pressa",
        url: "/training/packaging/airmail-envelope.jpg"
      },
      {
        id: "packaging-davinam-jaunibas-atminas",
        title: "Упаковка «Dāvinām jaunības atmiņas»",
        url: "/training/packaging/davinam-jaunibas-atminas.jpg"
      }
    ]
  },
  {
    id: "first-letter",
    title: "Первое письмо",
    subtitle: "Открытка родственникам и друзьям ребёнка",
    href: "/training/products/pervoe-pismo",
    hrefLabel: "Открыть карточку «Первое письмо»",
    paragraphs: [
      "«Первое письмо» — это открытка, которую мы высылаем всем родственникам и друзьям ребёнка, когда он рождается или ему исполняются первые месяцы."
    ],
    photos: [
      {
        id: "pervoe-pismo-amira-pair",
        title: "Живой пример — две открытки на 5 месяцев",
        url: "/training/pervoe-pismo/amira-5-months-pair.jpg"
      },
      {
        id: "pervoe-pismo-amira-open",
        title: "Живой пример — разворот с фото и письмом папе",
        url: "/training/pervoe-pismo/amira-5-months-open.jpg"
      }
    ]
  }
];

function publicUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

function KnowledgePhotoCard({ photo }: { photo: KnowledgePhoto }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl(photo.url));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <a href={photo.url} target="_blank" rel="noreferrer" className="block bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.title} className="w-full object-contain" />
      </a>
      <figcaption className="flex items-start justify-between gap-3 p-3">
        <p className="text-sm font-semibold leading-5 text-slate-800">{photo.title}</p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Скопировано" : "Ссылка"}
        </button>
      </figcaption>
    </figure>
  );
}

function KnowledgeArticleCard({ article }: { article: KnowledgeArticle }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <span>
          <span className="block text-xl font-black text-slate-950">{article.title}</span>
          <span className="mt-1 block text-sm text-slate-600">{article.subtitle}</span>
        </span>
        <ChevronDown
          size={22}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--line)] px-6 py-5">
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-lg leading-relaxed text-slate-700">
              {paragraph}
            </p>
          ))}
          {article.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-lg leading-relaxed text-slate-700">
              {article.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {article.photos.map((photo) => (
              <KnowledgePhotoCard key={photo.id} photo={photo} />
            ))}
          </div>
          <Link href={article.href} className="inline-flex text-sm font-bold text-blue-700 hover:text-blue-800">
            {article.hrefLabel} →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function ProductKnowledgeArticles() {
  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="text-2xl font-black text-slate-950">База знаний по продуктам</h2>
        <p className="mt-1 text-sm text-slate-600">
          Репродукция, книга в заголовках газет, упаковка и «Первое письмо». Фото можно открыть и скопировать ссылку
          клиенту.
        </p>
      </section>
      {ARTICLES.map((article) => (
        <KnowledgeArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
