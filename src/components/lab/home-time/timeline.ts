import type { Song } from "@/lib/types";
import coverColors from "./cover-colors.json";

/**
 * 原型用：每首歌封面的主色，离线从封面算好（按饱和度加权的色相分箱，取最重的一箱），
 * 用作色彩弥散的底色。正式做时应在上传封面时算好存库，而不是放一份 JSON。
 */
const COLORS = coverColors as Record<string, string>;

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
  return years.map((year): YearChapter => ({
    year,
    songs: (map.get(year) ?? []).slice().sort(byDate),
  }));
}

/**
 * 原型用：每年自动挑一件展品。有封面、原创、有音频的优先，同分取最早发行的。
 * 正式做时应由人来挑，并配一句短评。
 */
export function pickExhibits(songs: Song[]): Song[] {
  const byYear = new Map<number, Song[]>();
  for (const s of songs) {
    if (!s.year || s.dispute_note) continue;
    const list = byYear.get(s.year) ?? [];
    list.push(s);
    byYear.set(s.year, list);
  }
  const score = (s: Song) =>
    (stripeColor(s) ? 4 : 0) +
    (s.type?.includes("原创") ? 2 : 0) +
    (s.has_audio ? 1 : 0);
  return [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((y) => {
      const list = byYear.get(y) ?? [];
      return list
        .slice()
        .sort((a, b) => score(b) - score(a) || byDate(a, b))[0];
    });
}
