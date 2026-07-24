import { Cormorant_Garamond, Manrope } from "next/font/google";
import type { ReactNode } from "react";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-g2m-display",
  display: "swap"
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-g2m-body",
  display: "swap"
});

export default function Gift2manLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${manrope.variable}`}>{children}</div>;
}
