import type { Metadata } from "next";
import { RopHub } from "@/components/rop-hub";

export const metadata: Metadata = {
  title: "Инструменты РОП — Retro Pressa",
  description: "Кабинет РОП: ежедневный импорт переписок из Bitrix, план-факт, команда и Growth Intelligence."
};

export default function RopPage() {
  return <RopHub />;
}
