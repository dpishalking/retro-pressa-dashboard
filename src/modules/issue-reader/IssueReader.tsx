"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "page-flip/src/Style/stPageFlip.css";

export type IssueReaderPage = {
  page: number;
  src: string;
};

export type IssueReaderProps = {
  title: string;
  subtitle?: string;
  pageWidth: number;
  pageHeight: number;
  pages: IssueReaderPage[];
};

type PageFlipInstance = {
  destroy: () => void;
  update: () => void;
  loadFromImages: (images: string[]) => void;
  flipNext: () => void;
  flipPrev: () => void;
  getPageCount: () => number;
  getCurrentPageIndex: () => number;
  getSettings: () => { minWidth: number; maxWidth: number; width: number; height: number };
  on: (event: string, callback: (event: { data: number | { page: number } }) => void) => void;
  __dprUpdate?: () => void;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 720px)").matches;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function withDisplayWidth(src: string, width: number) {
  try {
    const url = new URL(src, typeof window !== "undefined" ? window.location.origin : "https://rp-bi.site");
    url.searchParams.set("w", String(width));
    return `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    const join = src.includes("?") ? "&" : "?";
    return `${src}${join}w=${width}`;
  }
}

function preloadImage(src: string) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.decoding = "async";
    img.src = src;
  });
}

async function preloadAll(urls: string[], onProgress: (done: number, total: number) => void) {
  const total = urls.length;
  let done = 0;
  const concurrency = Math.min(4, total);
  let index = 0;

  async function worker() {
    while (index < total) {
      const current = index++;
      try {
        await preloadImage(urls[current]);
      } catch {
        // keep going
      }
      done += 1;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

/** Fit a single page (or half-spread page) into the available box. */
function fitSinglePage(availW: number, availH: number, ratio: number) {
  const widthByBox = availW;
  const widthByHeight = availH / Math.max(0.01, ratio);
  const pageW = Math.floor(Math.max(200, Math.min(widthByBox, widthByHeight)));
  return { pageW, pageH: Math.round(pageW * ratio) };
}

export function IssueReader({ title, subtitle, pageWidth, pageHeight, pages }: IssueReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlipInstance | null>(null);
  const pageIndexRef = useRef(0);
  const soloTimerRef = useRef<number | null>(null);
  const [pageLabel, setPageLabel] = useState("Обложка");
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [ready, setReady] = useState(false);
  const [soloCover, setSoloCover] = useState(true);
  const [loadHint, setLoadHint] = useState("Готовим страницы…");
  const [mobile, setMobile] = useState(false);

  const updateChrome = useCallback((index: number, count: number) => {
    const isSolo = index <= 0 || index >= count - 1;
    if (soloTimerRef.current) {
      window.clearTimeout(soloTimerRef.current);
      soloTimerRef.current = null;
    }

    if (isSolo) {
      setSoloCover(true);
    } else {
      soloTimerRef.current = window.setTimeout(() => {
        setSoloCover(false);
        soloTimerRef.current = null;
      }, 420);
    }

    if (index <= 0) {
      setPageLabel("Обложка");
    } else if (index >= count - 1) {
      setPageLabel("Задняя обложка");
    } else {
      const left = index + 1;
      const right = Math.min(index + 2, count);
      setPageLabel(left === right ? `Стр. ${left}` : `Стр. ${left}–${right}`);
    }
    setCanPrev(index > 0);
    setCanNext(index < count - 1);
  }, []);

  useEffect(() => {
    const syncMobile = () => setMobile(isMobileViewport());
    syncMobile();
    const mq = window.matchMedia("(max-width: 720px)");
    mq.addEventListener("change", syncMobile);
    return () => mq.removeEventListener("change", syncMobile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let flip: PageFlipInstance | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        const host = hostRef.current;
        const shell = shellRef.current;
        if (!host || !shell || cancelled || pages.length === 0) return;

        const narrow = isMobileViewport();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = narrow
          ? Math.min(1200, Math.max(800, Math.round(window.innerWidth * dpr * 1.25)))
          : Math.min(1800, Math.max(1200, Math.round(700 * dpr)));

        const displayUrls = pages.map((page) => withDisplayWidth(page.src, displayWidth));

        setLoadHint(`Загрузка 0/${displayUrls.length}`);
        await preloadAll(displayUrls, (done, total) => {
          if (!cancelled) setLoadHint(`Загрузка ${done}/${total}`);
        });
        if (cancelled || !hostRef.current || !shellRef.current) return;

        setLoadHint("Собираем выпуск…");

        const mod = await import("page-flip/dist/js/page-flip.module.js");
        const PageFlip = mod.PageFlip as unknown as new (
          element: HTMLElement,
          settings: Record<string, unknown>
        ) => PageFlipInstance;

        if (cancelled || !hostRef.current || !shellRef.current) return;

        host.innerHTML = "";
        const book = document.createElement("div");
        book.className = "magazine-flipbook-book";
        host.appendChild(book);

        const reduced = prefersReducedMotion();
        const ratio = pageHeight / Math.max(1, pageWidth);

        const measure = () => {
          const shellBox = shellRef.current?.getBoundingClientRect();
          const availW = Math.max(240, shellBox?.width || host.clientWidth || window.innerWidth);
          const availH = Math.max(280, shellBox?.height || host.clientHeight || window.innerHeight * 0.75);
          // Cover / mobile: one page fills the box.
          const cover = fitSinglePage(availW * 0.96, availH * 0.96, ratio);
          // Open book: two pages side by side.
          const spread = fitSinglePage(availW * 0.96 * 0.5, availH * 0.96, ratio);
          return { availW, availH, cover, spread };
        };

        const initial = measure();

        // Cover starts as one page: host must stay narrower than 2× page width for portrait.
        host.style.width = `${initial.cover.pageW}px`;
        host.style.maxWidth = `${initial.cover.pageW}px`;
        host.style.height = `${initial.cover.pageH}px`;

        flip = new PageFlip(book, {
          width: initial.cover.pageW,
          height: initial.cover.pageH,
          size: "fixed",
          usePortrait: true,
          autoSize: false,
          drawShadow: !reduced,
          flippingTime: reduced ? 1 : narrow ? 600 : 820,
          maxShadowOpacity: 0.35,
          showCover: true,
          mobileScrollSupport: true,
          showPageCorners: !reduced && !narrow,
          useMouseEvents: true,
          startZIndex: 10
        });

        const syncHostForMode = (solo: boolean) => {
          const m = measure();
          const settings = flip?.getSettings();
          const page = solo || narrow ? m.cover : m.spread;
          const hostW = solo || narrow ? page.pageW : Math.min(m.availW, page.pageW * 2);
          const hostH = page.pageH;

          host.style.width = `${hostW}px`;
          host.style.maxWidth = `${hostW}px`;
          host.style.height = `${hostH}px`;

          if (settings) {
            settings.width = page.pageW;
            settings.height = page.pageH;
          }

          // Keep page-flip from expanding past our fitted host.
          book.style.width = "100%";
          book.style.height = "100%";
          book.style.minWidth = "0px";
          book.style.minHeight = "0px";
          book.style.maxWidth = "none";
        };

        const dprAwareUpdate = () => {
          const canvas = book.querySelector("canvas.stf__canvas") as HTMLCanvasElement | null;
          const solo =
            pageIndexRef.current <= 0 ||
            (flip ? pageIndexRef.current >= flip.getPageCount() - 1 : true);
          syncHostForMode(solo);

          // Never freeze canvas CSS size — layout size comes from the host.
          if (canvas) {
            canvas.style.removeProperty("width");
            canvas.style.removeProperty("height");
          }

          flip?.update();

          if (!canvas) return;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.25);
          if (pixelRatio <= 1) return;
          const cssW = canvas.clientWidth;
          const cssH = canvas.clientHeight;
          if (!cssW || !cssH) return;
          const tw = Math.round(cssW * pixelRatio);
          const th = Math.round(cssH * pixelRatio);
          if (canvas.width === tw && canvas.height === th) return;
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext("2d");
          ctx?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          try {
            (flip as unknown as { render?: { update?: () => void } }).render?.update?.();
          } catch {
            // ignore
          }
        };

        flip.loadFromImages(displayUrls);

        flip.on("init", (e) => {
          if (cancelled || !flip) return;
          const data = e.data as { page: number };
          pageIndexRef.current = data.page;
          updateChrome(data.page, flip.getPageCount());
          setReady(true);
          requestAnimationFrame(dprAwareUpdate);
        });

        flip.on("flip", (e) => {
          if (cancelled || !flip) return;
          const next = e.data as number;
          pageIndexRef.current = next;
          updateChrome(next, flip.getPageCount());
          requestAnimationFrame(dprAwareUpdate);
        });

        flip.on("changeOrientation", () => {
          dprAwareUpdate();
        });

        flipRef.current = flip;
        (flip as PageFlipInstance).__dprUpdate = dprAwareUpdate;

        resizeObserver = new ResizeObserver(() => {
          dprAwareUpdate();
        });
        resizeObserver.observe(shell);
      })();
    }, 20);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (soloTimerRef.current) {
        window.clearTimeout(soloTimerRef.current);
        soloTimerRef.current = null;
      }
      resizeObserver?.disconnect();
      try {
        flip?.destroy();
      } catch {
        // ignore
      }
      flipRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [pages, pageWidth, pageHeight, updateChrome]);

  useEffect(() => {
    if (!ready) return;
    const id = window.requestAnimationFrame(() => {
      flipRef.current?.__dprUpdate?.() ?? flipRef.current?.update();
    });
    return () => window.cancelAnimationFrame(id);
  }, [ready, soloCover]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        flipRef.current?.flipNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        flipRef.current?.flipPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="magazine-flipbook-dialog flex h-[100svh] w-full flex-col overflow-hidden text-[#f7f2ea]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2 md:px-6 md:py-2.5">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[16px] italic font-normal md:text-[20px]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/50 md:text-[11px]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,248,235,0.08),transparent_58%)]"
        />

        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#1a1714]/92 px-6 text-center">
            <div>
              <p className="text-[12px] tracking-[0.16em] uppercase text-white/60 md:text-[13px]">{loadHint}</p>
              <p className="mt-2 text-[12px] text-white/35">Сначала подгружаем страницы, потом открываем</p>
            </div>
          </div>
        )}

        <div
          className={cx(
            "magazine-flipbook-stage relative flex h-full w-full flex-col",
            soloCover && "is-solo",
            ready && "is-ready",
            mobile && "is-mobile"
          )}
        >
          <div
            ref={shellRef}
            className="magazine-flipbook-shell relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center px-2 py-2 md:px-4 md:py-3"
          >
            <div
              ref={hostRef}
              className={cx(
                "magazine-flipbook-host relative",
                soloCover && "is-solo",
                ready && "is-ready",
                mobile && "is-mobile"
              )}
            />
          </div>
          {soloCover && ready && canNext ? (
            <p className="magazine-flipbook-solo-hint pointer-events-none shrink-0 pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 md:pb-3 md:text-[11px]">
              {mobile ? "Листайте вправо" : "Листайте вправо — открыть выпуск"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5 md:gap-3 md:px-6">
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={!canPrev || !ready}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 md:gap-2 md:px-4 md:text-[12px]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </button>

        <p className="text-center text-[11px] uppercase tracking-[0.14em] text-white/55 md:text-[12px]">
          {pageLabel}
        </p>

        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={!canNext || !ready}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 md:gap-2 md:px-4 md:text-[12px]"
        >
          <span className="hidden sm:inline">Дальше</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
