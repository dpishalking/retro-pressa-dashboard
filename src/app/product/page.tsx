import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Продукт — Retro Pressa",
  description: "Контур продукта: ассортимент, выпуски и продуктовая аналитика"
};

export default function ProductPage() {
  return <BusinessContourScreen contourId="product" />;
}
