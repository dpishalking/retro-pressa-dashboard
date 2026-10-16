import Image from "next/image";
import Link from "next/link";
import { OnboardingPlayer } from "@/components/onboarding-player";
import hero from "./onboarding-hero.module.css";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";
import { COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog } from "@/types/training";

const SCALE_STATS = [
  { value: "16 500+", label: "Подарков продано" },
  { value: "48", label: "Стран, в которые отправляем подарки" },
  { value: "400 000+", label: "Архивных изданий в онлайн- и офлайн-каталоге" }
] as const;

const WORK_REASONS = [
  "Необычный продукт, который приятно предлагать.",
  "Международная аудитория и разнообразные запросы клиентов.",
  "Обучение продукту и процессу продаж.",
  "Возможность профессионально развиваться внутри команды."
] as const;

const START_STEPS = [
  { index: "01", title: "Зарегистрируйтесь", text: "Создайте аккаунт на обучающей платформе." },
  { index: "02", title: "Пройдите обучение", text: "Изучите наши продукты и познакомьтесь с процессом продаж." },
  { index: "03", title: "Подготовьтесь к стажировке", text: "Закрепите знания и сделайте первый шаг к работе в команде." }
] as const;

const display = "[font-family:var(--font-onb-display),Georgia,serif]";
const frame = "mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-16";
const kicker = "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#911D22] sm:text-[12px]";

export function OnboardingScreen({ reviews }: { reviews: TrainingClientReviewCatalog }) {
  const companyVideo = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <div className="onb min-h-screen overflow-x-clip bg-[#F6F1E8] text-[#191816]">
      <header className="sticky top-0 z-30 border-b border-[#191816]/10 bg-[#F6F1E8]/92 backdrop-blur-md">
        <div className={`${frame} flex items-center gap-4 py-3.5 lg:gap-8`}>
          <a href="#top" className="shrink-0">
            <img src="/brand/retro-pressa-logo.png" alt="Retro Pressa" className="h-5 w-auto sm:h-7" />
          </a>
          <p className="hidden max-w-[9.5rem] text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-[#69635C] xl:block">
            Международный сервис персональных подарков
          </p>
          <nav className="ml-auto hidden items-center gap-7 text-[12px] font-semibold uppercase tracking-[0.16em] lg:flex">
            <a href="#company" className="hover:text-[#911D22]">О компании</a>
            <a href="#stories" className="hover:text-[#911D22]">Отзывы</a>
            <a href="#start" className="hover:text-[#911D22]">Как начать</a>
          </nav>
          <Link
            href={MANAGER_REGISTER_PATH}
            className="ml-auto inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#911D22] px-3.5 text-[13px] font-semibold text-[#FCF9F3] hover:bg-[#7c181c] lg:ml-0 lg:px-5 lg:text-sm"
          >
            <span className="sm:hidden">Начать →</span>
            <span className="hidden sm:inline">Начать обучение →</span>
          </Link>
        </div>
      </header>

      <main id="top">
        <section className={hero.shell} aria-labelledby="rp-hero-heading">
          <div className={hero.stage}>
            <div className={hero.photo} aria-hidden="true">
              <img
                src="/onboarding/hero-photo.webp"
                alt=""
                width={962}
                height={856}
                fetchPriority="high"
              />
            </div>
            <div className={hero.content}>
              <div className={hero.text}>
                <p className={hero.eyebrow}>Retro Pressa · Международная компания</p>
                <h1 className={hero.title} id="rp-hero-heading">
                  <span className={hero.line}>Работа,</span>
                  <span className={hero.line}>в которой</span>
                  <span className={hero.line}>
                    вы <span className={hero.accent}>дарите</span>
                  </span>
                  <span className={`${hero.line} ${hero.accent}`}>эмоции.</span>
                </h1>
                <h2 className={hero.position}>
                  Ищем менеджеров по продажам
                  <br />
                  из любой точки мира
                </h2>
                <div className={hero.description}>
                  <p>Retro Pressa — международный сервис персонализированных подарков. Мы создаём подарки вокруг жизни человека, его воспоминаний и самых важных событий.</p>
                  <p>Присоединяйтесь к нам и помогайте людям находить особенные подарки для своих близких.</p>
                </div>
                <div className={hero.metrics} aria-label="Формат работы">
                  <div className={hero.metric}>
                    <span className={hero.value}>80%</span>
                    <span className={hero.label}>
                      Переписка с
                      <br />
                      клиентами
                    </span>
                  </div>
                  <div className={hero.metric}>
                    <span className={hero.value}>20%</span>
                    <span className={hero.label}>
                      Телефонные
                      <br />
                      звонки
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="company" className="relative scroll-mt-20 overflow-hidden bg-[#1C211E] text-[#FCF9F3]">
          <Image
            src="/training/newspaper-from-date/pravda-izvestiya-stack.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-[#1C211E]/78" />
          <div className={`${frame} relative grid items-center gap-8 py-16 sm:py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] lg:gap-16`}>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#B99A72]">О компании</p>
              <h2 className={`${display} mt-4 text-[2rem] font-semibold leading-[1.08] min-[390px]:text-[2.4rem] lg:text-[2.75rem]`}>
                Посмотрите короткую презентацию о компании, чтобы принять решение о дальнейших действиях
              </h2>
            </div>
            <div className="overflow-hidden rounded-md shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/20">
              {companyVideo ? <OnboardingPlayer embedUrl={companyVideo} title={COMPANY_INTRO_TITLE} /> : null}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-[#191816]/10 py-16 sm:py-24">
          <Image
            src="/training/newspaper-from-date/lithuanian-newspapers-stack.png"
            alt=""
            width={420}
            height={320}
            className="pointer-events-none absolute left-8 top-20 hidden w-36 -rotate-3 opacity-90 xl:block"
          />
          <Image
            src="/training/newspaper-from-date/pravda-izvestiya-stack.png"
            alt=""
            width={480}
            height={360}
            className="pointer-events-none absolute right-4 top-20 hidden w-44 rotate-3 opacity-80 xl:block"
          />
          <div className={`${frame} relative`}>
            <p className={`${kicker} text-center`}>Retro Pressa в цифрах</p>
            <h2 className={`${display} mx-auto mt-4 max-w-[16em] text-center text-[2.15rem] font-semibold leading-[1.05] min-[390px]:text-4xl sm:text-5xl lg:text-[3.5rem]`}>
              Мы уже помогли тысячам людей подарить незабываемые эмоции
            </h2>
            <dl className="mx-auto mt-12 flex max-w-5xl flex-col gap-8 md:mt-16 md:grid md:grid-cols-3 md:gap-0">
              {SCALE_STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`md:px-8 ${index === 0 ? "md:pl-0" : "border-t border-[#B99A72]/70 pt-8 md:border-l md:border-t-0 md:pt-0"}`}
                >
                  <dt className={`${display} text-[3.25rem] font-semibold leading-none text-[#911D22] sm:text-6xl lg:text-[4.6rem]`}>
                    {stat.value}
                  </dt>
                  <dd className="mt-3 max-w-[16rem] text-[15px] leading-6 text-[#69635C]">{stat.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mx-auto mt-12 max-w-2xl text-center text-[15px] leading-7 text-[#69635C] sm:text-[17px]">
              За этими цифрами — тысячи личных историй, благодарностей и счастливых получателей. И мы продолжаем расти.
            </p>
          </div>
        </section>

        <section id="stories" className="scroll-mt-20 py-16 sm:py-24">
          <div className={frame}>
            <p className={kicker}>Реальные истории</p>
            <h2 className={`${display} mt-4 max-w-[14em] text-[2.4rem] font-semibold leading-[1.02] min-[390px]:text-5xl lg:text-[3.6rem]`}>
              Ради таких моментов мы работаем
            </h2>
            <div className="mt-6 max-w-2xl space-y-3 text-[15px] leading-7 sm:text-[17px] sm:leading-8">
              <p className="text-[#69635C]">Самое интересное происходит в тот момент, когда человек открывает подарок.</p>
              <p className="text-[#191816]">Удивление. Улыбки. Воспоминания. Иногда даже слёзы счастья.</p>
              <p className="text-[#69635C]">Именно такие эмоции вы будете помогать создавать, работая с нами.</p>
            </div>
          </div>
          {reviews.videos.length ? (
            <div className="mt-10 overflow-x-auto pb-2 lg:overflow-visible">
              <div className="flex w-max snap-x snap-mandatory gap-4 px-5 sm:px-10 lg:mx-auto lg:grid lg:w-full lg:max-w-[1440px] lg:grid-cols-4 lg:gap-5 lg:px-16">
                {reviews.videos.map((video) => (
                  <div key={video.id} className="w-[78vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-md lg:w-auto lg:max-w-none">
                    <OnboardingPlayer embedUrl={video.embedUrl} title={video.title} portrait />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="border-t border-[#191816]/10 py-16 sm:py-20">
          <div className={frame}>
            <h2 className={`${display} max-w-[12em] text-[2.4rem] font-semibold leading-[1.05] min-[390px]:text-5xl lg:text-[3.4rem]`}>
              Больше, чем просто продажи
            </h2>
            <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
              {WORK_REASONS.map((reason, index) => (
                <li key={reason} className="border-t border-[#B99A72]/70 pt-4">
                  <span className={`${display} text-3xl font-semibold leading-none text-[#B99A72]`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-3 text-[16px] leading-7 text-[#191816]">{reason}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="start" className="relative scroll-mt-20 overflow-hidden bg-[#911D22] text-[#FCF9F3]">
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[280px] lg:block">
            <Image
              src="/training/newspaper-from-date/lithuanian-newspapers-stack.png"
              alt=""
              fill
              sizes="280px"
              className="object-cover object-left opacity-50"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(145,29,34,0.35)_0%,#911D22_42%,#911D22_100%)]" />
          </div>
          <div className={`${frame} relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-20 lg:pl-24`}>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#F6F1E8]/70">Как начать</p>
              <h2 className={`${display} mt-4 text-[2.6rem] font-semibold leading-[1.02] min-[390px]:text-5xl lg:text-[4rem]`}>
                Станьте частью Retro Pressa
              </h2>
              <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#FCF9F3]/90 sm:text-[17px] sm:leading-8">
                Нам нужны люди, которым интересно общаться, помогать клиентам и развиваться в продажах.
              </p>
              <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#FCF9F3]/90 sm:text-[17px] sm:leading-8">
                <strong className="font-semibold text-white">Начните с обучения.</strong> Мы познакомим вас с нашими продуктами, покажем, как устроена работа с клиентами и как проходит процесс продажи.
              </p>
              <Link
                href={MANAGER_REGISTER_PATH}
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#FCF9F3] px-8 text-base font-semibold text-[#191816] hover:bg-white sm:w-auto"
              >
                Начать обучение →
              </Link>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#FCF9F3]/75">
                После регистрации доступ к обучению подтверждает руководитель отдела продаж.
              </p>
            </div>
            <ol>
              {START_STEPS.map((step) => (
                <li key={step.index} className="grid grid-cols-[auto_1fr] items-baseline gap-5 border-t border-white/25 py-5">
                  <span className={`${display} text-5xl font-semibold leading-none text-white/40 sm:text-6xl lg:text-7xl`}>{step.index}</span>
                  <div>
                    <p className="text-lg font-semibold sm:text-xl">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#FCF9F3]/80 sm:text-[15px]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
