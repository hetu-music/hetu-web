import type { Song } from "@/lib/types";
import coverColors from "./cover-colors.json";

/**
 * 原型用：每首歌封面的主色，离线从封面算好（按饱和度加权的色相分箱，取最重的一箱），
 * 用作二十年色彩光谱与章节色彩弥散的底色。
 */
const COLORS = coverColors as Record<string, string>;

/**
 * 没有自己封面的歌也有封面：共用图床上的 proto.jpg（确定没有）或 default.jpg（还没核对），
 * 见 getCoverFilename。这两张的主色同样离线算好
 */
const PROTO_COLOR = "#1c3240";
const DEFAULT_COLOR = "#d07f9a";

/** 封面主色。每首歌都有封面，所以总有颜色 */
export function stripeColor(song: Song): string {
  if (song.hascover === true) return COLORS[String(song.id)] ?? DEFAULT_COLOR;
  return song.hascover === false ? PROTO_COLOR : DEFAULT_COLOR;
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

/** 为某一章挑出默认展示的焦点作品：有自己封面（不是共用的）、原创、有音频的优先 */
export function pickChapterFocal(songs: Song[]): Song | null {
  if (songs.length === 0) return null;
  const score = (s: Song) =>
    (s.hascover === true ? 4 : 0) +
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

// ── 这个时节：把二十年折叠到今天这个日子上 ──

/** "MM-DD" → 一年中的第几天（按平年算；2 月 29 日并入 3 月 1 日） */
function dayOfYear(monthDay: string): number {
  const [m, d] = monthDay.split("-").map(Number);
  return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5);
}

/** 两个日子在年历上相隔几天（跨年环绕） */
function dayDistance(a: number, b: number): number {
  const x = Math.abs(a - b);
  return Math.min(x, 365 - x);
}

/** 窗口从半个月起，太冷清的日子逐步放宽 */
const SEASON_WINDOWS = [15, 30, 45];
const SEASON_MIN = 12;

export interface Season {
  songs: Song[];
  /** 实际用的窗口：前后各多少天 */
  days: number;
}

/** 历年在今天前后发布的歌，由近及远。只算有完整日期的歌 */
export function pickSeason(songs: Song[], monthDay: string): Season {
  const today = dayOfYear(monthDay);
  const dated = songs.filter(
    (s): s is Song & { date: string } =>
      !!s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date),
  );
  let picked: Song[] = [];
  let days = SEASON_WINDOWS[0];
  for (const w of SEASON_WINDOWS) {
    days = w;
    picked = dated.filter(
      (s) => dayDistance(dayOfYear(s.date.slice(5)), today) <= w,
    );
    if (picked.length >= SEASON_MIN) break;
  }
  return { songs: picked.sort(byDateDesc), days };
}

const MONTHS = "一二三四五六七八九十";
function monthName(m: number): string {
  return m <= 10 ? MONTHS[m - 1] : `十${MONTHS[m - 11]}`;
}

/** 展签上的时节名：窗口半个月以内说「十一月下旬」，放宽了就说「十一月前后」 */
export function seasonName(monthDay: string, days: number): string {
  const [m, d] = monthDay.split("-").map(Number);
  const month = `${monthName(m)}月`;
  if (days > 15) return `${month}前后`;
  return `${month}${d <= 10 ? "上旬" : d <= 20 ? "中旬" : "下旬"}`;
}

/** 访客本地的 "MM-DD" */
export function localMonthDay(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
