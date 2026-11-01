import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NUMERALS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 1–99 写成汉字：四、十、十二、二十三 */
export function toChineseNumeral(n: number): string {
  if (n < 10) return NUMERALS[n];
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? NUMERALS[tens] : ""}十${NUMERALS[n % 10]}`;
}
