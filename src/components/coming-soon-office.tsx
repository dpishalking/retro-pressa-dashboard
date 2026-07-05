import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HUB_PATH } from "@/lib/auth/routes";

type ComingSoonOfficeProps = {
  title: string;
  description: string;
};

export function ComingSoonOffice({ title, description }: ComingSoonOfficeProps) {
  return (
    <main className="mx-auto w-[min(720px,calc(100%-32px))] py-16">
      <Link href={HUB_PATH} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600">
        <ArrowLeft size={16} />
        К рабочему кабинету
      </Link>
      <div className="card p-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-normal text-blue-600">Скоро</p>
        <h1 className="text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>
    </main>
  );
}
