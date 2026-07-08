import { Manrope, PT_Serif } from "next/font/google";

export const productBodyFont = PT_Serif({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  display: "swap"
});

export const productDisplayFont = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-product-display",
  display: "swap"
});
