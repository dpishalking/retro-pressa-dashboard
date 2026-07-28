"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
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
        // Keep going; missing page will still be attempted by page-flip.
      }
      done += 1;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

export function IssueReader({ title, subtitle, pageWidth, pageHeight, pages }: IssueReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlipInstance | null>(null);
  const pageIndexRef = useRef(0);
  const soloTimerRef = useRef<number | null>(null);
  const [pageLabel, setPageLabel] = useState("Обложка");
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [zoom, setZoom] = useState(1);
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
      }, 560);
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
    const syncMobile = () => {
      const next = isMobileViewport();
      setMobile(next);
      if (next) setZoom(1);
    };
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
        if (!host || cancelled || pages.length === 0) return;

        const narrow = isMobileViewport();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = narrow
          ? Math.min(1100, Math.max(720, Math.round(window.innerWidth * dpr * 1.15)))
          : Math.min(1600, Math.max(1000, Math.round(520 * dpr * 1.35)));

        const displayUrls = pages.map((page) => withDisplayWidth(page.src, displayWidth));

        setLoadHint(`Загрузка 0/${displayUrls.length}`);
        await preloadAll(displayUrls, (done, total) => {
          if (!cancelled) setLoadHint(`Загрузка ${done}/${total}`);
        });
        if (cancelled || !hostRef.current) return;

        setLoadHint("Собираем выпуск…");

        const mod = await import("page-flip/dist/js/page-flip.module.js");
        const PageFlip = mod.PageFlip as unknown as new (
          element: HTMLElement,
          settings: Record<string, unknown>
        ) => PageFlipInstance;

        if (cancelled || !hostRef.current) return;

        host.innerHTML = "";
        const book = document.createElement("div");
        book.className = "magazine-flipbook-book";
        host.appendChild(book);

        const reduced = prefersReducedMotion();
        const ratio = pageHeight / Math.max(1, pageWidth);
        const isPortraitPage = ratio >= 1;
        const viewportW = Math.max(280, host.clientWidth || window.innerWidth);
        const baseWidth = narrow
          ? Math.min(isPortraitPage ? 360 : 420, Math.floor(viewportW - 24))
          : isPortraitPage
            ? 420
            : 640;
        const baseHeight = Math.round(baseWidth * ratio);

        flip = new PageFlip(book, {
          width: baseWidth,
          height: baseHeight,
          size: "stretch",
          minWidth: narrow ? 240 : isPortraitPage ? 260 : 320,
          maxWidth: narrow ? Math.min(400, viewportW - 16) : isPortraitPage ? 520 : 980,
          minHeight: Math.max(200, Math.round((narrow ? 240 : 260) * ratio)),
          maxHeight: narrow ? Math.floor(window.innerHeight * 0.72) : isPortraitPage ? 900 : 720,
          drawShadow: !reduced && !narrow,
          flippingTime: reduced ? 1 : narrow ? 650 : 900,
          usePortrait: true,
          autoSize: true,
          maxShadowOpacity: narrow ? 0.25 : 0.45,
          showCover: true,
          mobileScrollSupport: true,
          showPageCorners: !reduced && !narrow,
          useMouseEvents: true,
          startZIndex: 10
        });

        const dprAwareUpdate = () => {
          const canvas = book.querySelector("canvas.stf__canvas") as HTMLCanvasElement | null;
          if (!canvas) {
            flip?.update();
            return;
          }
          flip?.update();
          const pixelRatio = Math.min(window.devicePixelRatio || 1, narrow ? 2 : 2.5);
          if (pixelRatio <= 1) return;
          const cssW = canvas.clientWidth;
          const cssH = canvas.clientHeight;
          if (!cssW || !cssH) return;
          const tw = Math.round(cssW * pixelRatio);
          const th = Math.round(cssH * pixelRatio);
          if (canvas.width === tw && canvas.height === th) return;
          canvas.width = tw;
          canvas.height = th;
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
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
          dprAwareUpdate();
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
        resizeObserver.observe(host);
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
        // page-flip may already have detached the node
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
  }, [ready, soloCover, zoom]);

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
    <div className="magazine-flipbook-dialog flex h-[100svh] w-full flex-col gap-0 overflow-hidden text-[#f7f2ea]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2 md:px-6 md:py-2.5">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[16px] italic font-normal md:text-[20px]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/50 md:text-[11px]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {!mobile ? (
          <div className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 sm:flex">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              onClick={() => setZoom((z) => Math.max(0.9, Number((z - 0.1).toFixed(2))))}
              disabled={zoom <= 0.9}
              aria-label="Уменьшить"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-white/60">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
              disabled={zoom >= 2}
              aria-label="Увеличить"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-3 md:overflow-auto md:px-10 md:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,248,235,0.1),transparent_55%)]"
        />

        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#1a1714]/90 px-6 text-center">
            <div>
              <p className="text-[12px] tracking-[0.16em] uppercase text-white/60 md:text-[13px]">{loadHint}</p>
              <p className="mt-2 text-[12px] text-white/35">Сначала подгружаем страницы, потом открываем</p>
            </div>
          </div>
        )}

        <div
          className={cx(
            "magazine-flipbook-stage relative w-full max-w-[1120px] transition-[padding] duration-500 ease-out",
            soloCover && "is-solo",
            ready && "is-ready",
            mobile && "is-mobile"
          )}
          style={
            mobile
              ? undefined
              : {
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center"
                }
          }
        >
          <div className="magazine-flipbook-glow" aria-hidden />
          <div className="magazine-flipbook-floor" aria-hidden />
          <div className="magazine-flipbook-shell relative mx-auto h-[min(74svh,680px)] w-full sm:h-[min(72svh,820px)]">
            <div
              ref={hostRef}
              className={cx(
                "magazine-flipbook-host relative h-full w-full",
                soloCover && "is-solo",
                ready && "is-ready",
                mobile && "is-mobile"
              )}
            />
          </div>
          {soloCover && ready && canNext ? (
            <p className="magazine-flipbook-solo-hint pointer-events-none mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 md:mt-5 md:text-[11px] md:tracking-[0.18em]">
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 md:gap-2 md:px-4 md:text-[12px] md:tracking-[0.14em]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </button>

        <p className="text-center text-[11px] uppercase tracking-[0.14em] text-white/55 md:text-[12px] md:tracking-[0.16em]">
          {pageLabel}
        </p>

        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={!canNext || !ready}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 md:gap-2 md:px-4 md:text-[12px] md:tracking-[0.14em]"
        >
          <span className="hidden sm:inline">Дальше</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
