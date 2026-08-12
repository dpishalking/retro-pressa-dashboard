import type { Metadata } from "next";
import { ManagerPayrollScreen } from "@/components/manager-payroll-screen";

export const metadata: Metadata = {
  title: "Зарплаты менеджеров — Retro Pressa",
  description: "Калькулятор ФОТ отдела продаж: Bitrix и ручные сценарии"
};

export default function SalesPayrollPage() {
  return <ManagerPayrollScreen />;
}
