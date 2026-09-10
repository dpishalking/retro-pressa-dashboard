import type { Metadata } from "next";
import { ManagerRegisterScreen } from "@/components/manager-register-screen";

export const metadata: Metadata = {
  title: "Регистрация | Retro Pressa"
};

export default function ManagerRegisterPage() {
  return <ManagerRegisterScreen />;
}
