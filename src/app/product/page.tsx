import type { Metadata } from "next";
import { BusinessContourScreen } from "@/components/business-contour-screen";

export const metadata: Metadata = {
  title: "Продукт — Retro Pressa",
  description: "Ассортимент, спрос, выпуски и клиенты"
};

export default function ProductPage() {
  return <BusinessContourScreen contourId="product" />;
}
