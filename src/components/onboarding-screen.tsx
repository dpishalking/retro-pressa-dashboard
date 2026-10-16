import Link from "next/link";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";
import { COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog } from "@/types/training";

/** Languages in the public catalog filter on retropressa.com, excluding the empty option. */
const CATALOG_LANGUAGE_COUNT = "34";

const SCALE_STATS = [
  { value: "16 500+", label: "Подарков продано" },
  { value: "48", label: "Стран, в которые отправляем подарки" },
  { value: "400 000+", label: "Архивных изданий в онлайн и оффлайн каталоге" },
  { value: CATALOG_LANGUAGE_COUNT, label: "Языков изданий в каталоге" }
] as const;

const WORK_REASONS = [
  "Необычный продукт, который приятно предлагать.",
  "Международная аудитория и разнообразные запросы клиентов.",
  "Обучение продукту и процессу продаж.",
  "Возможность профессионально развиваться внутри команды."
] as const;

const START_STEPS = [
  {
    index: "01",
    title: "Зарегистрируйтесь",
    text: "Создайте аккаунт на обучающей платформе."
  },
  {
    index: "02",
    title: "Пройдите обучение",
    text: "Изучите наши продукты и познакомьтесь с процессом продаж."
  },
  {
    index: "03",
    title: "Подготовьтесь к стажировке",
    text: "Закрепите полученные знания и сделайте первый шаг к работе в команде."
  }
] as const;

const brand = "text-[#c44747]";

export function OnboardingScreen({ reviews }: { reviews: TrainingClientReviewCatalog }) {
  const embedUrl = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <main className="overflow-x-clip">
      <div className="mx-auto w-[min(1040px,calc(100%-32px))] py-8 sm:py-14">
        <section>
          <img src="/brand/retro-pressa-logo.png" alt="Retro Pressa" className="h-7 w-auto sm:h-8" />
          <p className={`mt-8 text-xs font-extrabold uppercase tracking-normal sm:text-sm ${brand}`}>
            Retro Pressa · Международная компания
          </p>
          <h1 className="mt-3 max-w-4xl text-[1.7rem] font-black leading-[1.12] tracking-normal text-slate-950 min-[390px]:text-4xl sm:text-5xl lg:text-[3.25rem]">
            Мы создаём персональные подарки, которые становятся частью истории семьи
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Не просто вещи, а подарки, созданные вокруг жизни человека: его даты рождения, воспоминаний, увлечений
            и самых важных событий.
          </p>
          <p className={`mt-4 max-w-2xl text-lg font-semibold leading-7 ${brand}`}>
            Подарки, которые удивляют, трогают до слёз и остаются на долгие годы.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="max-w-3xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
            Ищем менеджеров по продажам из любой точки мира 🌍
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Присоединяйтесь к Retro Pressa и помогайте людям находить особенные подарки для своих близких.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Работа полностью удалённая. Общение с клиентами — преимущественно в переписке, иногда по телефону.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <article className="rounded-2xl border border-[var(--line)] bg-white px-3 py-4 sm:px-5">
              <p className={`whitespace-nowrap text-3xl font-black sm:text-4xl ${brand}`}>80%</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">Переписка с клиентами</p>
            </article>
            <article className="rounded-2xl border border-[var(--line)] bg-white px-3 py-4 sm:px-5">
              <p className="whitespace-nowrap text-3xl font-black text-slate-950 sm:text-4xl">20%</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">Телефонные звонки</p>
            </article>
          </div>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Вы будете не просто предлагать товары по каталогу, а помогать клиентам выбирать подарки с личным смыслом.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="max-w-3xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
            Мы уже помогли тысячам людей подарить незабываемые эмоции
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SCALE_STATS.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-[var(--line)] bg-white px-3 py-4 sm:px-4">
                <p className="whitespace-nowrap text-[1.35rem] font-black leading-none text-slate-950 min-[390px]:text-2xl sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm leading-5 text-slate-600">{stat.label}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            За этими цифрами — тысячи личных историй, благодарностей и счастливых получателей. И мы продолжаем расти.
          </p>
          <h3 className="mt-8 text-xl font-black text-slate-950">Почему с нами интересно работать?</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {WORK_REASONS.map((reason) => (
              <li key={reason} className="flex gap-3 text-sm leading-6 text-slate-700">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c44747]" />
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
            Познакомьтесь с Retro Pressa поближе
          </h2>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-800">
            Лучше один раз увидеть, чем долго рассказывать.
          </p>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Посмотрите видео и узнайте, какие подарки мы создаём, для кого они предназначены и почему люди выбирают
            именно нас.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
            {embedUrl ? (
              <div className="aspect-video">
                <iframe
                  src={embedUrl}
                  title={COMPANY_INTRO_TITLE}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-50 px-6 text-center text-base font-bold text-slate-700">
                Видео скоро появится
              </div>
            )}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="max-w-3xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
            А теперь посмотрите, ради чего мы всё это делаем ❤️
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Самое интересное происходит в тот момент, когда человек открывает подарок.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-800">
            Удивление. Улыбки. Воспоминания. Иногда даже слёзы счастья.
          </p>
          <p className={`mt-4 max-w-2xl text-lg font-semibold leading-7 ${brand}`}>
            Посмотрите настоящие реакции и отзывы наших клиентов.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Именно такие эмоции вы будете помогать создавать, работая с нами.
          </p>
          {reviews.videos.length ? (
            <div className="mt-6 overflow-x-auto pb-1">
              <div className="flex w-max snap-x snap-mandatory gap-3 sm:w-auto sm:grid sm:grid-cols-2 lg:grid-cols-4">
                {reviews.videos.map((video) => (
                  <div
                    key={video.id}
                    className="w-[68vw] max-w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl bg-black sm:w-auto sm:max-w-none"
                  >
                    <div className="aspect-[9/16]">
                      <iframe
                        src={video.embedUrl}
                        title={video.title}
                        className="h-full w-full"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="bg-[#f6eeed] py-12 sm:py-16">
        <div className="mx-auto w-[min(1040px,calc(100%-32px))]">
          <h2 className="max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Хотите стать частью Retro Pressa?
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            Нам нужны люди, которым интересно общаться, помогать клиентам и развиваться в продажах.
          </p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
            <strong className="font-bold text-slate-950">Начните с обучения.</strong> Мы познакомим вас с нашими
            продуктами, покажем, как устроена работа с клиентами и как проходит процесс продажи.
          </p>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {START_STEPS.map((step) => (
              <li key={step.index}>
                <p className={`text-sm font-bold ${brand}`}>{step.index}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <Link
            href={MANAGER_REGISTER_PATH}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#c44747] px-8 text-base font-bold text-white hover:bg-[#b33d3d] sm:w-auto"
          >
            Начать обучение →
          </Link>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            После регистрации доступ к обучению подтверждает руководитель отдела продаж.
          </p>
        </div>
      </section>
    </main>
  );
}
