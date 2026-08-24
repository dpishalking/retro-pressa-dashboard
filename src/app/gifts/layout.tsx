import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const giftsFont = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "600", "900"],
  variable: "--font-gifts",
  display: "swap"
});

export default function GiftsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${giftsFont.variable} gifts-shell`}
      style={{ fontFamily: "var(--font-gifts), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        .gifts-shell {
          --gf-yellow: #fbd530;
          --gf-yellow-hover: #ecc000;
          --gf-ink: #0c0d12;
          --gf-muted: rgba(12, 13, 18, 0.7);
          --gf-line: #dadada;
          min-height: 100vh;
          background: #fff;
          color: var(--gf-ink);
        }
        .gifts-shell a { text-decoration: none; }
        body:has(.gifts-shell) { background: #fff; }
      `}</style>
      {children}
    </div>
  );
}
