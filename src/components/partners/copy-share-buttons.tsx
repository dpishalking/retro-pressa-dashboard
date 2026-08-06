"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";

type CopyShareButtonsProps = {
  value: string;
  openHref?: string;
  shareTitle?: string;
  shareText?: string;
  showOpen?: boolean;
};

export function CopyShareButtons({
  value,
  openHref,
  shareTitle = "Retro Pressa",
  shareText,
  showOpen = false
}: CopyShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText ?? value, url: openHref ?? value });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copy();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Скопировано" : "Копировать"}
      </button>
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Share2 size={16} />
        Поделиться
      </button>
      {showOpen && openHref ? (
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink size={16} />
          Открыть
        </a>
      ) : null}
    </div>
  );
}
