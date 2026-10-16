import Link from "next/link";
import { MANAGER_REGISTER_PATH } from "@/lib/auth/routes";
import { COMPANY_INTRO_LEAD, COMPANY_INTRO_TITLE, COMPANY_INTRO_VIDEO_URL } from "@/lib/training/company-intro";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog } from "@/types/training";

export function OnboardingScreen({ reviews }: { reviews: TrainingClientReviewCatalog }) {
  const embedUrl = normalizeVideoEmbedUrl(COMPANY_INTRO_VIDEO_URL);

  return (
    <main className="mx-auto w-[min(960px,calc(100%-32px))] py-10 sm:py-16">
      <p className="text-sm font-extrabold uppercase tracking-normal text-violet-700">Онбординг менеджера</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
        {COMPANY_INTRO_TITLE}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{COMPANY_INTRO_LEAD}</p>

      <section className="mt-8 overflow-hidden rounded-[20px] border border-[var(--line)] bg-black shadow-[0_10px_24px_rgba(28,25,23,0.05)]">
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
      </section>

      {reviews.videos.length ? (
        <section className="mt-12">
          <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">{reviews.sectionTitle}</h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
            Реакция людей, когда они получают подарок.
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
        <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">Дальше — обучение</h2>
        <p className="mt-2 max-w-xl text-base leading-7 text-slate-600">
          Зарегистрируйтесь в базу. После одобрения откроется обучение и база знаний.
        </p>
        <Link
          href={MANAGER_REGISTER_PATH}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-violet-600 px-8 text-base font-bold text-white hover:bg-violet-700 sm:w-auto"
        >
          Приступить к обучению
        </Link>
      </section>
    </main>
  );
}
