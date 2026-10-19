import Link from "next/link";
import { OnboardingFaq } from "@/components/onboarding-faq";
import { OnboardingPlayer } from "@/components/onboarding-player";
import { OnboardingProductCarousel } from "@/components/onboarding-product-carousel";
import { OnboardingTrainer } from "@/components/onboarding-trainer";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";
import { COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog } from "@/types/training";

const display = "[font-family:var(--font-onb-display),Georgia,serif]";
const frame = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
const h2 = `${display} text-[2rem] font-semibold leading-[1.08] text-[#191816] sm:text-[2.6rem] lg:text-[3.25rem]`;

const ADVANTAGES = [
  { value: "80%", label: "переписка с клиентами" },
  { value: "20%", label: "телефонные звонки" },
  { value: "Обучение", label: "продукту и продажам" }
] as const;

const INCOME = [
  { title: "Первый месяц", value: "От 50 000 ₽" },
  { title: "Второй месяц", value: "От 75 000 ₽" },
  { title: "ТОП-менеджеры", value: "250 000 ₽+" }
] as const;

const DAY = [
  {
    title: "Получаете заявку",
    text: "Клиент обращается в Retro Pressa за подарком.",
    who: "Клиент",
    line: "Здравствуйте! Хочу подарок папе на юбилей."
  },
  {
    title: "Знакомитесь с его историей",
    text: "Выясняете, для кого и по какому поводу нужен подарок.",
    who: "Вы",
    line: "Расскажите, где он вырос и что для него важно."
  },
  {
    title: "Подбираете решение",
    text: "Предлагаете подходящий журнал, газету или другой персональный подарок.",
    who: "Вы",
    line: "Могу предложить издание из дня его рождения."
  },
  {
    title: "Помогаете оформить заказ",
    text: "Сопровождаете клиента до покупки.",
    who: "Вы",
    line: "Отправляю состав заказа и срок."
  }
] as const;

const FLOW = ["Маркетинг", "Заявка", "Менеджер", "Подбор подарка", "Покупка"] as const;

const LEARNING = [
  "Знакомство с компанией и продуктами.",
  "Изучение этапов продажи.",
  "Работа с клиентскими ситуациями.",
  "Проверка знаний и подготовка к стажировке."
] as const;

const GROWTH = ["Стажёр", "Новичок", "Менеджер"] as const;

const STATS = [
  { value: "16 500+", label: "подарков продано" },
  { value: "48", label: "стран, куда отправляем подарки" },
  { value: "400 000+", label: "архивных изданий в каталоге" }
] as const;

function Cta({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const tone = light
    ? "bg-[#FCF9F3] text-[#191816] hover:bg-white"
    : "bg-[#911D22] text-[#FCF9F3] hover:bg-[#7c181c]";
  return (
    <Link
      href={MANAGER_REGISTER_PATH}
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition motion-reduce:transition-none ${tone} ${className}`}
    >
      Начать обучение
    </Link>
  );
}

export function OnboardingNextScreen({ reviews }: { reviews: TrainingClientReviewCatalog }) {
  const companyVideo = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F4EF] text-[#191816]">
      <header className="sticky top-0 z-30 border-b border-[#191816]/10 bg-[#F7F4EF]/90 backdrop-blur-md">
        <div className={`${frame} flex items-center gap-4 py-3`}>
          <a href="#top" className="shrink-0">
            <img src="/brand/retro-pressa-logo.png" alt="Retro Pressa" className="h-5 w-auto max-w-[108px] object-contain object-left sm:h-6 sm:max-w-none" />
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-[13px] text-[#69635C] lg:flex">
            <a href="#income" className="hover:text-[#191816]">Доход</a>
            <a href="#work" className="hover:text-[#191816]">Работа</a>
            <a href="#try" className="hover:text-[#191816]">Пример</a>
            <a href="#company" className="hover:text-[#191816]">Компания</a>
            <a href="#faq" className="hover:text-[#191816]">Вопросы</a>
          </nav>
          <Cta className="ml-auto shrink-0 whitespace-nowrap px-4 text-[13px] lg:ml-0 lg:px-6 lg:text-sm" />
        </div>
      </header>

      <main id="top">
        <section className={`${frame} grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-20`}>
          <div className="min-w-0">
            <p className="text-sm text-[#911D22]">Менеджер по продажам</p>
            <h1 className={`${display} mt-4 text-[2.35rem] font-semibold leading-[1.02] sm:text-5xl lg:text-[4.15rem]`}>
              Работайте из любой точки мира. Помогайте создавать незабываемые подарки.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#69635C] sm:text-[17px]">
              Retro Pressa — международный сервис персонализированных подарков. Мы ищем менеджеров по продажам, которым нравится общаться с людьми, находить нестандартные решения и помогать создавать настоящие эмоции.
            </p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-3">
              {ADVANTAGES.map((item) => (
                <li key={item.label} className="border-t border-[#191816]/15 pt-3">
                  <p className={`${display} text-[1.7rem] font-semibold leading-none text-[#911D22] sm:text-3xl`}>{item.value}</p>
                  <p className="mt-2 text-sm leading-5 text-[#69635C]">{item.label}</p>
                </li>
              ))}
            </ul>
            <Cta className="mt-8 w-full sm:w-auto" />
          </div>
          <figure className="mx-auto w-full min-w-0 max-w-[560px] lg:max-w-none">
            <img
              src="/onboarding/hero-photo.webp"
              alt="Дочь и папа читают персональную газету"
              className="aspect-[4/5] w-full object-cover object-[center_40%] sm:aspect-[5/4] lg:aspect-[4/5] lg:max-h-[640px]"
            />
          </figure>
        </section>

        <section id="income" className="scroll-mt-20 border-t border-[#191816]/10 bg-white py-14 sm:py-20">
          <div className={frame}>
            <h2 className={h2}>Ваш доход растёт вместе с вашими результатами.</h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#69635C]">
              Прозрачная система оплаты, понятные показатели и возможность увеличивать заработок по мере развития навыков продаж.
            </p>
            <ol className="mt-10 grid gap-4 lg:grid-cols-3">
              {INCOME.map((item) => (
                <li key={item.title} className="border border-[#191816]/10 bg-[#F7F4EF] px-5 py-6">
                  <p className="text-sm text-[#69635C]">{item.title}</p>
                  <p className={`${display} mt-3 text-[2.5rem] font-semibold leading-none sm:text-[3rem]`}>{item.value}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#69635C]">
              Доход зависит от количества смен, результатов продаж и выполнения установленных показателей.
            </p>
          </div>
        </section>

        <section id="work" className={`${frame} scroll-mt-20 py-14 sm:py-20`}>
          <h2 className={`${h2} max-w-[14em]`}>Что вы будете делать каждый день?</h2>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#69635C]">
            Помогать людям выбирать необычные подарки для тех, кто им дорог.
          </p>
          <ol className="mt-10 grid gap-8 lg:grid-cols-4">
            {DAY.map((step, index) => (
              <li key={step.title} className="border-t border-[#191816]/15 pt-4">
                <p className={`${display} text-3xl font-semibold leading-none text-[#B99A72]`}>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 text-lg font-semibold leading-6">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#69635C]">{step.text}</p>
                <p className="mt-4 bg-[#FCF9F3] px-3 py-3 text-sm leading-5 text-[#191816]">
                  <span className="mb-1 block text-[11px] font-semibold text-[#911D22]">{step.who}</span>
                  {step.line}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="clients" className="scroll-mt-20 bg-[#191816] py-14 text-[#FCF9F3] sm:py-20">
          <div className={frame}>
            <h2 className={`${display} max-w-[16em] text-[2rem] font-semibold leading-[1.08] sm:text-[2.6rem] lg:text-[3.25rem]`}>
              Мы привлекаем клиентов. Вы помогаете им выбрать.
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#FCF9F3]/75">
              Retro Pressa развивает сайты, рекламные каналы и собственную систему привлечения покупателей.
            </p>
            <ol className="mt-12 grid gap-6 sm:grid-cols-5">
              {FLOW.map((item, index) => (
                <li key={item} className="border-t border-white/20 pt-4">
                  <span className="text-sm text-[#B99A72]">0{index + 1}</span>
                  <p className="mt-2 text-lg leading-6">{item}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl text-sm leading-6 text-[#FCF9F3]/60">
              Компания приводит входящие обращения. Все заявки не обещаем одному менеджеру.
            </p>
          </div>
        </section>

        <section id="try" className={`${frame} scroll-mt-20 py-14 sm:py-20`}>
          <h2 className={`${h2} max-w-[14em]`}>А вы бы смогли продать такой подарок?</h2>
          <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#69635C]">
            Попробуйте ответить на сообщение клиента. Это займёт меньше минуты.
          </p>
          <div className="mt-10">
            <OnboardingTrainer />
          </div>
        </section>

        <section id="company" className="scroll-mt-20 border-t border-[#191816]/10 bg-white py-14 sm:py-20">
          <div className={frame}>
            <h2 className={`${h2} max-w-[16em]`}>
              Мы продаём не просто подарки. Мы создаём истории, которые остаются с людьми.
            </h2>
            <p className="mt-4 text-sm font-semibold text-[#911D22]">Посмотрите видео о компании</p>
            <div className="mx-auto mt-6 w-full max-w-[960px] overflow-hidden bg-[#1C211E]">
              {companyVideo ? <OnboardingPlayer embedUrl={companyVideo} title={COMPANY_INTRO_TITLE} /> : null}
            </div>

            <dl className="mt-12 grid gap-8 border-t border-[#191816]/10 pt-8 md:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className={`${display} whitespace-nowrap text-[2.75rem] font-semibold leading-none text-[#911D22] md:text-[2.35rem] lg:text-5xl`}>{stat.value}</dt>
                  <dd className="mt-2 max-w-[16rem] text-sm leading-5 text-[#69635C]">{stat.label}</dd>
                </div>
              ))}
            </dl>

            {reviews.videos.length ? (
              <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                {reviews.videos.map((video) => (
                  <div key={video.id} className="overflow-hidden bg-[#191816]">
                    <OnboardingPlayer embedUrl={video.embedUrl} title={video.title} portrait />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-14">
              <OnboardingProductCarousel />
            </div>
          </div>
        </section>

        <section id="learn" className={`${frame} scroll-mt-20 py-14 sm:py-20`}>
          <h2 className={`${h2} max-w-[14em]`}>Мы дадим вам знания и инструменты, чтобы уверенно начать.</h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#69635C]">
            Вы познакомитесь с продуктами, освоите процесс продаж и подготовитесь к работе с первыми клиентами.
          </p>
          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-[#191816]">Обучение</h3>
              <ol className="mt-4 space-y-3">
                {LEARNING.map((item, index) => (
                  <li key={item} className="flex gap-3 border-t border-[#191816]/10 pt-3 text-[15px] leading-6">
                    <span className="text-[#911D22]">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#191816]">Рост внутри Retro Pressa</h3>
              <ol className="mt-6">
                {GROWTH.map((stage, index) => (
                  <li key={stage} className="flex gap-4">
                    <span className="flex flex-col items-center">
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#911D22]" />
                      {index < GROWTH.length - 1 ? <span className="mt-2 w-px flex-1 bg-[#191816]/15" /> : null}
                    </span>
                    <p className={`${display} pb-8 text-3xl font-semibold leading-none`}>{stage}</p>
                  </li>
                ))}
              </ol>
              <p className="text-sm leading-6 text-[#69635C]">
                Схема пути, не обещание перехода через фиксированное число дней.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-[#191816]/10 bg-white py-14 sm:py-20">
          <div className={frame}>
            <h2 className={h2}>Ответы на вопросы до начала работы.</h2>
            <div className="mt-8">
              <OnboardingFaq />
            </div>
          </div>
        </section>

        <section id="start" className="scroll-mt-20 bg-[#191816] py-16 text-[#FCF9F3] sm:py-24">
          <div className={`${frame} max-w-3xl`}>
            <h2 className={`${display} text-[2.2rem] font-semibold leading-[1.05] sm:text-5xl lg:text-[3.5rem]`}>
              Ваш первый шаг в Retro Pressa начинается здесь.
            </h2>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#FCF9F3]/75">
              Зарегистрируйтесь на нашей обучающей платформе, познакомьтесь с продуктами и узнайте, как начать работать с нами.
            </p>
            <Cta light className="mt-8 w-full sm:w-auto" />
            <p className="mt-4 max-w-md text-sm leading-6 text-[#FCF9F3]/60">
              Регистрация занимает несколько минут. После неё вы получите доступ к обучающей платформе.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
