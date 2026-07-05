import { Suspense } from "react";
import { OfficeHub } from "@/components/office-hub";

export default function HubPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8 text-sm text-slate-500">Загрузка...</main>}>
      <OfficeHub />
    </Suspense>
  );
}
