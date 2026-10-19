"use client";

import Link from "next/link";
import { useState } from "react";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";

type ChoiceId = "a" | "b" | "c";

type Scene = {
  id: string;
  client: string;
  choices: { id: ChoiceId; text: string }[];
  correct: ChoiceId;
  why: string;
  notes: Record<ChoiceId, string>;
};

const SCENES: Scene[] = [
  {
    id: "dad-60",
    client: "Здравствуйте! Ищу необычный подарок папе на 60-летие. Что можете предложить?",
    correct: "b",
    why: "Сначала нужна история человека, а не каталог и не бюджет. Вопрос про страну и личную связь помогает предложить подарок, который относится именно к этому папе.",
    notes: {
      a: "Каталог без вопроса оставляет клиента один на один с ассортиментом.",
      b: "Вопрос про историю папы открывает персональный повод, а не просто товар.",
      c: "Бюджет важен позже. В первом ответе он закрывает разговор о человеке."
    },
    choices: [
      { id: "a", text: "Здравствуйте! У нас есть газеты и журналы. Сейчас отправлю вам каталог." },
      {
        id: "b",
        text: "Добрый день! Отличный повод для особенного подарка. Подскажите, в какой стране родился ваш папа? Я попробую подобрать издание, связанное с его историей."
      },
      { id: "c", text: "Здравствуйте! У нас большой ассортимент подарков, подскажите ваш бюджет." }
    ]
  },
  {
    id: "mom-jubilee",
    client: "Хочу подарок маме на юбилей. Она говорит, что ей ничего не нужно.",
    correct: "b",
    why: "Отказ от «обычного» подарка — не конец разговора. История, которую семье важно вспомнить, даёт конкретный повод для издания.",
    notes: {
      a: "Скидка не отвечает на просьбу найти необычный подарок.",
      b: "Вопрос про важный момент из жизни переводит разговор к персональной истории.",
      c: "Каталог снова оставляет выбор на клиенте, хотя он как раз просит помощи."
    },
    choices: [
      { id: "a", text: "Тогда отправлю скидку — вдруг передумает." },
      {
        id: "b",
        text: "Понимаю. Расскажите, какой момент из её жизни семье важно вспомнить — подберу подарок вокруг этой истории."
      },
      { id: "c", text: "У нас много вариантов. Выберите в каталоге то, что понравится." }
    ]
  }
];

export function OnboardingTrainer() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [picked, setPicked] = useState<ChoiceId | null>(null);
  const scene = SCENES[sceneIndex]!;
  const correct = picked === scene.correct;

  const restart = () => setPicked(null);
  const nextScene = () => {
    setSceneIndex((value) => (value + 1) % SCENES.length);
    setPicked(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="rounded-2xl border border-[#191816]/10 bg-white p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#69635C]">Сообщение клиента</p>
        <p className="mt-4 text-[17px] leading-7 text-[#191816]">{scene.client}</p>
      </div>

      <div>
        <div role="radiogroup" aria-label="Варианты ответа клиенту" className="grid gap-3">
          {scene.choices.map((choice) => {
            const selected = picked === choice.id;
            const isCorrect = choice.id === scene.correct;
            const state = picked
              ? selected
                ? isCorrect
                  ? "border-[#911D22] bg-[#911D22]/5"
                  : "border-[#191816]/20 bg-[#F6F1E8]"
                : "border-[#191816]/10 opacity-70"
              : "border-[#191816]/10 hover:border-[#191816]/30";
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={picked !== null}
                onClick={() => setPicked(choice.id)}
                className={`min-h-12 rounded-2xl border bg-white px-4 py-3 text-left text-[15px] leading-6 transition motion-reduce:transition-none disabled:cursor-default ${state}`}
              >
                <span className="mr-2 font-semibold text-[#911D22]">{choice.id.toUpperCase()}.</span>
                {choice.text}
              </button>
            );
          })}
        </div>

        {picked ? (
          <div className="mt-4 rounded-2xl border border-[#191816]/10 bg-[#FCF9F3] p-5" aria-live="polite">
            <p className="text-sm font-semibold text-[#191816]">{correct ? "Этот ответ ближе к продаже Retro Pressa." : "Этот ответ слабее."}</p>
            <p className="mt-2 text-sm leading-6 text-[#69635C]">{scene.why}</p>
            <ul className="mt-3 space-y-1.5 text-sm leading-6 text-[#69635C]">
              {scene.choices.map((choice) => (
                <li key={choice.id}>
                  <span className="font-semibold text-[#191816]">{choice.id.toUpperCase()}.</span> {scene.notes[choice.id]}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={restart} className="min-h-11 rounded-full border border-[#191816]/15 px-5 text-sm font-semibold">
                Пройти ещё раз
              </button>
              <button type="button" onClick={nextScene} className="min-h-11 rounded-full border border-[#191816]/15 px-5 text-sm font-semibold">
                Следующий пример
              </button>
              <Link
                href={MANAGER_REGISTER_PATH}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#911D22] px-5 text-sm font-semibold text-[#FCF9F3]"
              >
                Начать обучение
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
