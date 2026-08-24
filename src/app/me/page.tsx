import type { Metadata } from "next";
import { ManagerCabinetScreen } from "@/components/manager-cabinet-screen";

export const metadata: Metadata = {
  title: "Мои продажи | Retro Pressa",
  description: "Лиды, сделки, конверсии и зарплата менеджера"
};

export default function ManagerCabinetPage() {
  return <ManagerCabinetScreen />;
}
