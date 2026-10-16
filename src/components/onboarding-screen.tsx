import Link from "next/link";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";
import { COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog } from "@/types/training";

const brand = "text-[#c44747]";
const brandButton =
  "mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#c44747] px-8 text-base font-bold text-white hover:bg-[#b33d3d] sm:w-auto";

export function OnboardingScreen({ reviews }: { reviews: TrainingClientReviewCatalog }) {
  const embedUrl = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <main className="mx-auto w-[min(960px,calc(100%-32px))] py-8 sm:py-14">
      <img src="/brand/retro-pressa-logo.png" alt="Retro Pressa" className="h-7 w-auto sm:h-8" />

      <p className={`mt-8 text-sm font-extrabold uppercase tracking-normal ${brand}`}>
        Международный сервис персональных подарков
      </p>
      <h1 className="mt-3 max-w-3xl text-[2rem] font-black leading-[1.08] tracking-normal text-slate-950 sm:text-5xl">
        Ищем менеджеров по продажам
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        Retro Pressa работает с клиентами в разных странах. Основная работа — переписка, звонки занимают меньшую часть.
      </p>
      <dl className="mt-6 flex gap-10 border-y border-[var(--line)] py-5">
        <div>
          <dt className="text-sm font-semibold text-slate-600">Переписка</dt>
          <dd className={`mt-1 text-4xl font-black ${brand}`}>80%</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-600">Звонки</dt>
          <dd className="mt-1 text-4xl font-black text-slate-950">20%</dd>
        </div>
      </dl>
      <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600">
        Чтобы начать, посмотрите видео о компании и реакцию людей на подарок. После этого можно перейти к изучению
        продукта.
      </p>

      <section className="mt-8">
        <p className={`text-sm font-bold ${brand}`}>О компании</p>
        <div className="mt-3 overflow-hidden rounded-[20px] border border-[var(--line)] bg-black shadow-[0_10px_24px_rgba(28,25,23,0.05)]">
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

      {reviews.videos.length ? (
        <section className="mt-12">
          <p className={`text-sm font-bold ${brand}`}>Реакция на подарок</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
            Вот что происходит, когда подарок открывают
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Так выглядит момент, ради которого этот подарок покупают.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {reviews.videos.map((video) => (
              <div key={video.id} className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-black">
                <div className="aspect-[9/16]">
                  <iframe
                    src={video.embedUrl}
                    title={video.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 border-t border-[var(--line)] pt-10">
        <h2 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl">Дальше — сам продукт</h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
          В обучении разобрано, что продавать, кому предлагать и как объяснять это клиенту.
        </p>
        <Link href={MANAGER_REGISTER_PATH} className={brandButton}>
          Приступить к обучению
        </Link>
      </section>
    </main>
  );
}
