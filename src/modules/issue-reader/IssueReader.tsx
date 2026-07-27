"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Volume2, VolumeX } from "lucide-react";
import {
  isIssueSoundMuted,
  playFlipSound,
  playIssueSound,
  setIssueSoundMuted
} from "@/modules/issue-reader/issueSounds";
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

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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
  const [soundMuted, setSoundMuted] = useState(false);

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
    setSoundMuted(isIssueSoundMuted());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let flip: PageFlipInstance | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        const host = hostRef.current;
        if (!host || cancelled || pages.length === 0) return;

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
        const baseWidth = isPortraitPage ? 520 : 640;
        const baseHeight = Math.round(baseWidth * ratio);
        flip = new PageFlip(book, {
          width: baseWidth,
          height: baseHeight,
          size: "stretch",
          minWidth: isPortraitPage ? 280 : 320,
          // Keep single-page (cover) mode from flipping into a wide empty+cover landscape frame.
          maxWidth: isPortraitPage ? 640 : 980,
          minHeight: Math.max(220, Math.round((isPortraitPage ? 280 : 320) * ratio)),
          maxHeight: isPortraitPage ? 980 : 720,
          drawShadow: !reduced,
          flippingTime: reduced ? 1 : 900,
          usePortrait: true,
          autoSize: true,
          maxShadowOpacity: 0.45,
          showCover: true,
          mobileScrollSupport: true,
          showPageCorners: !reduced,
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
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
          if (dpr <= 1) return;
          const cssW = canvas.clientWidth;
          const cssH = canvas.clientHeight;
          if (!cssW || !cssH) return;
          const tw = Math.round(cssW * dpr);
          const th = Math.round(cssH * dpr);
          if (canvas.width === tw && canvas.height === th) return;
          canvas.width = tw;
          canvas.height = th;
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
          const ctx = canvas.getContext("2d");
          ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
          // Redraw into the hi-dpi buffer without another layout resize.
          try {
            (flip as unknown as { render?: { start?: () => void; update?: () => void } }).render?.update?.();
          } catch {
            // ignore
          }
        };

        flip.loadFromImages(pages.map((p) => p.src));

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
          const prev = pageIndexRef.current;
          pageIndexRef.current = next;
          const count = flip.getPageCount();
          updateChrome(next, count);
          playFlipSound(prev, next, count);
          requestAnimationFrame(dprAwareUpdate);
        });

        flip.on("changeOrientation", () => {
          dprAwareUpdate();
        });

        flipRef.current = flip;

        resizeObserver = new ResizeObserver(() => {
          dprAwareUpdate();
        });
        resizeObserver.observe(host);

        // Expose for zoom/solo updates
        (flip as unknown as { __dprUpdate?: () => void }).__dprUpdate = dprAwareUpdate;
      })();
    }, 40);

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

  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setIssueSoundMuted(next);
    if (!next) void playIssueSound("uiTap", { force: true });
  };

  return (
    <div className="magazine-flipbook-dialog flex h-[100svh] w-full flex-col gap-0 overflow-hidden text-[#f7f2ea]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 md:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[18px] italic font-normal md:text-[20px]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-white/50">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={toggleMute}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-pressed={soundMuted}
            aria-label={soundMuted ? "Включить звук" : "Выключить звук"}
          >
            {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-3 py-5 md:px-10 md:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,248,235,0.1),transparent_55%)]"
        />

        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#1a1714]/80 text-[13px] tracking-[0.18em] uppercase text-white/60">
            Открываем выпуск…
          </div>
        )}

        <div
          className={cx(
            "magazine-flipbook-stage relative w-full max-w-[1120px] transition-[padding] duration-500 ease-out",
            soloCover && "is-solo"
          )}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center"
          }}
        >
          <div className="magazine-flipbook-glow" aria-hidden />
          <div className="magazine-flipbook-floor" aria-hidden />
          <div className="magazine-flipbook-shell relative mx-auto h-[min(68svh,780px)] w-full sm:h-[min(72svh,820px)]">
            <div
              ref={hostRef}
              className={cx("magazine-flipbook-host relative h-full w-full", soloCover && "is-solo")}
            />
          </div>
          {soloCover && ready && canNext ? (
            <p className="magazine-flipbook-solo-hint pointer-events-none mt-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Листайте вправо — открыть выпуск
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 md:px-6">
        <button
          type="button"
          onClick={() => flipRef.current?.flipPrev()}
          disabled={!canPrev}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </button>

        <p className="text-center text-[12px] uppercase tracking-[0.16em] text-white/55">{pageLabel}</p>

        <button
          type="button"
          onClick={() => flipRef.current?.flipNext()}
          disabled={!canNext}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <span className="hidden sm:inline">Дальше</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
