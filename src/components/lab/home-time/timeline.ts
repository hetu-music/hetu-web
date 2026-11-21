import type { Song } from "@/lib/types";
import coverColors from "./cover-colors.json";

/**
 * 原型用：每首歌封面的主色，离线从封面算好（按饱和度加权的色相分箱，取最重的一箱），
 * 用作二十年色彩光谱与章节色彩弥散的底色。
 */
const COLORS = coverColors as Record<string, string>;

export function stripeColor(song: Song): string | null {
  if (song.hascover !== true) return null;
  return COLORS[String(song.id)] ?? null;
}

/** 按发行日期升序：同一天按 id */
export function byDate(a: Song, b: Song): number {
  const da = a.date ?? "";
  const db = b.date ?? "";
  if (da !== db) return da < db ? -1 : 1;
  return a.id - b.id;
}

/** 按发行日期降序：最新在前 */
export function byDateDesc(a: Song, b: Song): number {
  return byDate(b, a);
}

export interface YearChapter {
  /** null 表示年份未详 */
  year: number | null;
  songs: Song[];
}

/** 把歌按年份分章；years 给出全部年份，没有歌的年份也留一章（筛选时折成一行，时间不断） */
export function groupByYear(
  songs: Song[],
  years: (number | null)[],
  newestFirst: boolean,
): YearChapter[] {
  const map = new Map<number | null, Song[]>();
  for (const y of years) map.set(y, []);
  for (const s of songs) {
    const list = map.get(s.year ?? null);
    if (list) list.push(s);
  }
  const sorter = newestFirst ? byDateDesc : byDate;
  return years.map((year): YearChapter => ({
    year,
    songs: (map.get(year) ?? []).slice().sort(sorter),
  }));
}

/** 为某一章挑出默认展示的焦点作品：有封面、原创、有音频的优先 */
export function pickChapterFocal(songs: Song[]): Song | null {
  if (songs.length === 0) return null;
  const score = (s: Song) =>
    (stripeColor(s) ? 4 : 0) +
    (s.type?.includes("原创") ? 2 : 0) +
    (s.has_audio ? 1 : 0);

  let best = songs[0];
  let bestScore = score(best);
  for (let i = 1; i < songs.length; i++) {
    const candidate = songs[i];
    const s = score(candidate);
    if (s > bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}

/** 精炼的词曲/专辑副行 */
export function creditSummary(song: Song): string {
  if (song.lyricist?.length && song.composer?.length) {
    const l = song.lyricist.join("、");
    const c = song.composer.join("、");
    return l === c ? `词曲 ${l}` : `词 ${l} · 曲 ${c}`;
  }
  if (song.lyricist?.length) return `词 ${song.lyricist.join("、")}`;
  if (song.composer?.length) return `曲 ${song.composer.join("、")}`;
  if (song.album && song.album !== song.title) return `《${song.album}》`;
  return song.artist?.join(" / ") || "";
}
