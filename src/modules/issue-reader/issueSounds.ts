/**
 * Magazine page sounds via Web Audio (no asset files).
 * Layered filtered noise ≈ paper rustle — no beeps / musical tones on flips.
 */

export type IssueSoundId =
  | "pageTurn"
  | "paperRustle"
  | "coverOpen"
  | "pageSettle"
  | "uiTap";

const MUTE_KEY = "retropressa:issue-reader-muted";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

export function isIssueSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setIssueSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

async function unlock(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Soft pink-ish noise (1/f-ish via simple filter of white). */
function pinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.5703 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
  }
  return buffer;
}

type BurstOpts = {
  when: number;
  duration: number;
  gain: number;
  freq: number;
  q?: number;
  type?: BiquadFilterType;
  pan?: number;
  attack?: number;
  /** Optional second sweep of filter frequency for whoosh. */
  freqEnd?: number;
};

function playNoiseBurst(ctx: AudioContext, opts: BurstOpts) {
  const src = ctx.createBufferSource();
  src.buffer = pinkNoiseBuffer(ctx, Math.max(opts.duration + 0.05, 0.08));

  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.Q.value = opts.q ?? 0.9;
  filter.frequency.setValueAtTime(opts.freq, opts.when);
  if (opts.freqEnd) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, opts.freqEnd),
      opts.when + opts.duration,
    );
  }

  const gain = ctx.createGain();
  const attack = opts.attack ?? 0.012;
  const peakAt = opts.when + attack;
  const endAt = opts.when + opts.duration;

  gain.gain.setValueAtTime(0.0001, opts.when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), peakAt);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, opts.gain * 0.45),
    opts.when + opts.duration * 0.45,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  src.connect(filter);
  filter.connect(gain);

  const panNode = ctx.createStereoPanner?.();
  if (panNode) {
    panNode.pan.setValueAtTime(opts.pan ?? 0, opts.when);
    gain.connect(panNode);
    panNode.connect(ctx.destination);
  } else {
    gain.connect(ctx.destination);
  }

  src.start(opts.when);
  src.stop(endAt + 0.03);
}

/** Several overlapping bursts = one page rustle. */
function playPaperRustle(
  ctx: AudioContext,
  kind: "light" | "medium" | "heavy" | "crinkle" | "cover",
) {
  const now = ctx.currentTime;
  const direction = Math.random() > 0.5 ? 1 : -1;

  if (kind === "light") {
    playNoiseBurst(ctx, {
      when: now,
      duration: rand(0.14, 0.2),
      gain: rand(0.028, 0.038),
      freq: rand(2400, 3800),
      freqEnd: rand(1400, 2200),
      q: 0.7,
      type: "bandpass",
      pan: direction * 0.35,
      attack: 0.008,
    });
    playNoiseBurst(ctx, {
      when: now + 0.03,
      duration: rand(0.1, 0.16),
      gain: rand(0.014, 0.022),
      freq: rand(900, 1400),
      q: 1.1,
      type: "bandpass",
      pan: direction * -0.15,
    });
    return;
  }

  if (kind === "medium") {
    playNoiseBurst(ctx, {
      when: now,
      duration: rand(0.2, 0.28),
      gain: rand(0.032, 0.045),
      freq: rand(1600, 2600),
      freqEnd: rand(700, 1200),
      q: 0.65,
      type: "bandpass",
      pan: direction * 0.4,
      attack: 0.015,
    });
    playNoiseBurst(ctx, {
      when: now + 0.04,
      duration: rand(0.16, 0.22),
      gain: rand(0.018, 0.028),
      freq: rand(3200, 5200),
      freqEnd: rand(1800, 2800),
      q: 0.8,
      type: "highpass",
      pan: direction * -0.25,
    });
    playNoiseBurst(ctx, {
      when: now + 0.08,
      duration: rand(0.08, 0.12),
      gain: rand(0.01, 0.016),
      freq: rand(500, 800),
      q: 1.2,
      type: "lowpass",
      pan: direction * 0.1,
    });
    return;
  }

  if (kind === "heavy") {
    playNoiseBurst(ctx, {
      when: now,
      duration: rand(0.28, 0.38),
      gain: rand(0.04, 0.055),
      freq: rand(900, 1500),
      freqEnd: rand(400, 700),
      q: 0.55,
      type: "bandpass",
      pan: direction * 0.45,
      attack: 0.02,
    });
    playNoiseBurst(ctx, {
      when: now + 0.05,
      duration: rand(0.2, 0.28),
      gain: rand(0.02, 0.03),
      freq: rand(2200, 3600),
      freqEnd: rand(1000, 1800),
      q: 0.7,
      type: "bandpass",
      pan: direction * -0.3,
    });
    return;
  }

  if (kind === "crinkle") {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      playNoiseBurst(ctx, {
        when: now + i * rand(0.028, 0.045),
        duration: rand(0.04, 0.07),
        gain: rand(0.016, 0.028) * (1 - i * 0.1),
        freq: rand(2000, 5500),
        q: rand(0.9, 1.6),
        type: i % 2 === 0 ? "bandpass" : "highpass",
        pan: direction * rand(-0.4, 0.4),
        attack: 0.004,
      });
    }
    return;
  }

  // cover — thicker, longer whoosh
  playNoiseBurst(ctx, {
    when: now,
    duration: rand(0.38, 0.48),
    gain: rand(0.048, 0.062),
    freq: rand(700, 1100),
    freqEnd: rand(280, 480),
    q: 0.5,
    type: "lowpass",
    pan: direction * 0.5,
    attack: 0.03,
  });
  playNoiseBurst(ctx, {
    when: now + 0.06,
    duration: rand(0.28, 0.36),
    gain: rand(0.025, 0.035),
    freq: rand(1800, 2800),
    freqEnd: rand(900, 1400),
    q: 0.7,
    type: "bandpass",
    pan: direction * -0.35,
  });
  playNoiseBurst(ctx, {
    when: now + 0.12,
    duration: rand(0.14, 0.2),
    gain: rand(0.012, 0.02),
    freq: rand(3500, 5000),
    q: 0.9,
    type: "highpass",
    pan: direction * 0.2,
  });
}

function playPageSettle(ctx: AudioContext) {
  const now = ctx.currentTime;
  playNoiseBurst(ctx, {
    when: now,
    duration: rand(0.07, 0.1),
    gain: rand(0.022, 0.032),
    freq: rand(180, 320),
    q: 1.4,
    type: "lowpass",
    pan: rand(-0.15, 0.15),
    attack: 0.004,
  });
  playNoiseBurst(ctx, {
    when: now + 0.015,
    duration: rand(0.05, 0.08),
    gain: rand(0.008, 0.014),
    freq: rand(900, 1400),
    q: 1,
    type: "bandpass",
    pan: rand(-0.2, 0.2),
    attack: 0.003,
  });
}

function playUiTap(ctx: AudioContext) {
  const now = ctx.currentTime;
  playNoiseBurst(ctx, {
    when: now,
    duration: 0.045,
    gain: 0.018,
    freq: 2200,
    freqEnd: 900,
    q: 1.8,
    type: "bandpass",
    attack: 0.002,
  });
}

const RUSTLE_KINDS: Array<"light" | "medium" | "heavy" | "crinkle"> = [
  "light",
  "medium",
  "heavy",
  "crinkle",
  "medium",
  "light",
];

const SOUND_PLAYERS: Record<IssueSoundId, (ctx: AudioContext) => void> = {
  pageTurn: (ctx) => playPaperRustle(ctx, "medium"),
  paperRustle: (ctx) => playPaperRustle(ctx, "light"),
  coverOpen: (ctx) => playPaperRustle(ctx, "cover"),
  pageSettle: (ctx) => playPageSettle(ctx),
  uiTap: (ctx) => playUiTap(ctx),
};

export async function playIssueSound(id: IssueSoundId, opts?: { force?: boolean }) {
  if (!opts?.force && isIssueSoundMuted()) return;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    if (id !== "uiTap") return;
  }
  const ctx = await unlock();
  if (!ctx) return;
  try {
    SOUND_PLAYERS[id](ctx);
  } catch {
    // ignore autoplay / audio errors
  }
}

/** Pick a flip sound based on page index transition — varied paper rustles. */
export function playFlipSound(fromIndex: number, toIndex: number, pageCount = 28) {
  const lastPage = Math.max(0, pageCount - 1);

  if (fromIndex <= 0 && toIndex > 0) {
    void playIssueSound("coverOpen");
    window.setTimeout(() => void playIssueSound("pageSettle"), 420);
    return;
  }

  if (toIndex <= 0 || toIndex >= lastPage) {
    void (async () => {
      const ctx = await unlock();
      if (!ctx || isIssueSoundMuted()) return;
      playPaperRustle(ctx, "heavy");
    })();
    window.setTimeout(() => void playIssueSound("pageSettle"), 380);
    return;
  }

  const kind = RUSTLE_KINDS[Math.abs(toIndex) % RUSTLE_KINDS.length]!;
  void (async () => {
    const ctx = await unlock();
    if (!ctx || isIssueSoundMuted()) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const use = Math.random() < 0.18 ? "crinkle" : kind;
    playPaperRustle(ctx, use);
  })();
  window.setTimeout(() => void playIssueSound("pageSettle"), rand(300, 400));
}
