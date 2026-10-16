"use client";

import { useState } from "react";

function posterUrl(embedUrl: string) {
  const id = embedUrl.match(/\/embed\/([^/?]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : "";
}

function withAutoplay(embedUrl: string) {
  const url = new URL(embedUrl);
  url.searchParams.set("autoplay", "1");
  return url.toString();
}

export function OnboardingPlayer({
  embedUrl,
  title,
  portrait = false
}: {
  embedUrl: string;
  title: string;
  portrait?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = portrait ? "aspect-[9/16]" : "aspect-video";

  if (playing) {
    return (
      <div className={`overflow-hidden bg-black ${frame}`}>
        <iframe
          src={withAutoplay(embedUrl)}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const poster = posterUrl(embedUrl);

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className={`group relative block w-full overflow-hidden bg-[#191816] text-left ${frame}`}
      aria-label={`Смотреть: ${title}`}
    >
      {poster ? (
        // Real YouTube frame. Shorts are cropped to the portrait card.
        <img src={poster} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      ) : null}
      <span className="absolute inset-0 bg-[#191816]/25 transition group-hover:bg-[#191816]/15" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/15 text-white backdrop-blur-[2px] transition group-hover:scale-105 group-hover:bg-white group-hover:text-[#191816] motion-reduce:transition-none sm:h-[4.5rem] sm:w-[4.5rem]">
        <svg viewBox="0 0 24 24" aria-hidden className="ml-1 h-7 w-7 fill-current">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
      </span>
    </button>
  );
}
