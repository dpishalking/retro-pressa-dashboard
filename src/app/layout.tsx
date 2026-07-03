import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аналитика Retro Pressa",
  description: "Операционный пульт Retro Pressa для цели €100 000"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
