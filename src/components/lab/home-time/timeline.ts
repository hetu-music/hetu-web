import type { Song } from "@/lib/types";
import coverColors from "./cover-colors.json";

/**
 * 原型用：每首歌封面的主色，离线从封面算好（按饱和度加权的色相分箱，取最重的一箱）。
 * 正式做时应在上传封面时算好存库，而不是放一份 JSON。
 */
const COLORS = coverColors as Record<string, string>;

/** 没有封面的歌：在色带里是一道留白 */
export const BLANK_LIGHT = "#E2E8F0";
export const BLANK_DARK = "#1E293B";

export function stripeColor(song: Song): string | null {
  if (song.hascover !== true) return null;
  return COLORS[String(song.id)] ?? null;
}

/** 按发行日期排：同一天按 id */
export function byDate(a: Song, b: Song): number {
  const da = a.date ?? "";
  const db = b.date ?? "";
  if (da !== db) return da < db ? -1 : 1;
  return a.id - b.id;
}

export interface YearChapter {
  /** null 是年份未详 */
  year: number | null;
  songs: Song[];
}

/** 把歌按年份分章；years 给出全部年份，没有歌的年份也留一章（筛选时折成一行） */
export function groupByYear(songs: Song[], years: (number | null)[]) {
  const map = new Map<number | null, Song[]>();
  for (const y of years) map.set(y, []);
  for (const s of songs) {
    const list = map.get(s.year ?? null);
    if (list) list.push(s);
  }
  return years.map(
    (year): YearChapter => ({
      year,
      songs: (map.get(year) ?? []).slice().sort(byDate),
    }),
  );
}

const CN_DIGITS = "〇一二三四五六七八九";

/** 2016 → 二〇一六 */
export function yearInHanzi(year: number): string {
  return String(year)
    .split("")
    .map((d) => CN_DIGITS[Number(d)])
    .join("");
}
