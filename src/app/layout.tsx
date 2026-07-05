import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retro Pressa — Рабочий кабинет",
  description: "Рабочий кабинет Retro Pressa: аналитика, переписки, инструменты РОП, офис продаж и обучение менеджеров"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
