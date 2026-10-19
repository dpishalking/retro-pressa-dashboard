"use client";

import { useState } from "react";

const QUESTIONS = [
  {
    q: "Можно ли работать из другой страны?",
    a: "Да. Мы ищем менеджеров из любой точки мира. Основной формат — переписка с клиентами и короткие телефонные звонки."
  },
  {
    q: "Нужен ли опыт продаж?",
    a: "Обязательный стаж в материалах компании не зафиксирован. На старте есть обучение продукту и процессу продаж."
  },
  {
    q: "Какой график и сколько смен?",
    a: "Смены идут по графику. Точное число смен и часы в публичных материалах онбординга не зафиксированы и зависят от расписания."
  },
  {
    q: "Как рассчитывается заработок?",
    a: "Суммы на странице — ориентир, не гарантия. Доход зависит от количества смен, результатов продаж и выполнения показателей. В первые дни стажировки оклада нет: оплата идёт с оплаченных сделок. Общие условия с окладом включаются отдельно."
  },
  {
    q: "Нужно ли самостоятельно искать клиентов?",
    a: "Компания развивает сайты, рекламные каналы и систему входящих обращений. Менеджер помогает человеку выбрать подарок. Все заявки компании не обещаем одному менеджеру."
  },
  {
    q: "Что потребуется для работы?",
    a: "Точный список техники и доступов в материалах онбординга не зафиксирован. Для обучения и переписки нужен интернет."
  },
  {
    q: "Как проходит обучение?",
    a: "После регистрации открывается обучающая платформа: компания и продукты, этапы продажи, клиентские ситуации и проверка знаний перед стажировкой."
  },
  {
    q: "Что произойдёт после стажировки?",
    a: "Стажировка готовит к работе с клиентами. Она не означает автоматическое трудоустройство или переход на общие условия. Дальнейший формат определяет руководитель."
  }
] as const;

export function OnboardingFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-[#191816]/10 border-y border-[#191816]/10">
      {QUESTIONS.map((item, index) => {
        const expanded = open === index;
        const panelId = `onb-faq-${index}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left text-[16px] font-semibold leading-6 sm:text-[17px]"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : index)}
              >
                {item.q}
                <span aria-hidden className="text-xl font-normal text-[#911D22]">
                  {expanded ? "–" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="max-w-3xl pb-5 text-[15px] leading-7 text-[#69635C]">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
