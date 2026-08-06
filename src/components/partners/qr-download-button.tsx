"use client";

import { Download } from "lucide-react";

type QrDownloadButtonProps = {
  value: string;
  fileName?: string;
};

export function QrDownloadButton({ value, fileName = "retro-pressa-qr.png" }: QrDownloadButtonProps) {
  const download = async () => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(value)}`;
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <Download size={16} />
      Скачать QR-код
    </button>
  );
}
