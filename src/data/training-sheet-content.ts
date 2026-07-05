import type { ProductTrainingModule } from "@/types/training";
import { applySheetContentToCatalog as mergeSheetContent } from "@/lib/training/google-sheet-catalog";
import type { ParsedSheetProduct } from "@/lib/training/google-sheet-catalog";
import sheetSnapshot from "../../data/training/sheet-products.json";

export const trainingSheetProducts = sheetSnapshot.products as ParsedSheetProduct[];

export function applySheetContentToCatalog(products: ProductTrainingModule[]) {
  return mergeSheetContent(products, trainingSheetProducts);
}
