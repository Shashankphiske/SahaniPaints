import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getProductSizeInLitres = (sizeStr?: string): number => {
  if (!sizeStr) return 1;
  const normalized = sizeStr.toLowerCase().trim();
  if (normalized.endsWith("ml")) {
    const val = parseFloat(normalized);
    return isNaN(val) ? 1 : val / 1000;
  }
  if (normalized.endsWith("ltr") || normalized.endsWith("l") || normalized.endsWith("lt")) {
    const val = parseFloat(normalized);
    return isNaN(val) ? 1 : val;
  }
  const val = parseFloat(normalized);
  return isNaN(val) ? 1 : val;
};
