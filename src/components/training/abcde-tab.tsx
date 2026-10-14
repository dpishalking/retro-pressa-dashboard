"use client";

import { Download, Layers } from "lucide-react";

export function AbcdeTab() {
  return (
    <div className="space-y-4">
      <section className="card p-6">
        <h2 className="text-2xl font-black text-slate-950">ABCDE</h2>
        <p className="mt-1 text-sm text-slate-600">Сегментация клиентов. Презентация для менеджеров.</p>
      </section>

      <section className="card border-rose-200 bg-rose-50/60 p-6">
        <div>
          <h2 className="text-xl font-black text-slate-950">Презентация</h2>
          <p className="mt-1 text-sm text-slate-600">Скачайте файл и держите под рукой в работе с клиентом.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="/training/abcde/segmentation.pdf"
            download="Сегментация ABCDE.pdf"
            className="group flex items-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 transition hover:border-rose-300 hover:bg-rose-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Layers size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-950">Сегментация ABCDE</span>
              <span className="block truncate text-xs text-slate-500">Скачать презентацию</span>
            </span>
            <Download size={16} className="shrink-0 text-slate-400 group-hover:text-rose-600" />
          </a>
        </div>
      </section>
    </div>
  );
}
