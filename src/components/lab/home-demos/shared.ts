import type { GallerySong } from "@/lib/auth-gallery-shared";
import { FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import {
  FACET_KEYS,
  isSelectionActive,
  type LibraryFilters,
  type LibraryOptions,
} from "@/lib/library/filters";
import type { Song } from "@/lib/types";

export type YearOption = LibraryOptions["years"][number];

export interface FeaturedEntry {
  song: Song;
  excerpt: string | null;
}

export interface ArchiveStats {
  catalogCount: number;
  albumCount: number;
  oldestYear: number | null;
  newestYear: number | null;
}

export interface FeaturePlateItem {
  id: "qjtx" | "imagery" | "quiz";
  numeral: string;
  href: string;
  tag: string;
  title: string;
  subtitle: string;
  accentLight: string;
  accentDark: string;
  washLight: string;
  washDark: string;
}

export const FEATURE_PLATES: FeaturePlateItem[] = [
  {
    id: "qjtx",
    numeral: "零壹",
    href: "/story/qjtx",
    tag: "互动长卷",
    title: "倾尽天下",
    subtitle: "一曲长歌，倾尽天下",
    accentLight: "#9E3636",
    accentDark: "#E46A6A",
    washLight: "rgba(158, 54, 54, 0.14)",
    washDark: "rgba(228, 106, 106, 0.22)",
  },
  {
    id: "imagery",
    numeral: "零贰",
    href: "/imagery",
    tag: "词中万象",
    title: "意象词云",
    subtitle: "探索词中万千意象",
    accentLight: "#286B62",
    accentDark: "#52BCAE",
    washLight: "rgba(40, 107, 98, 0.14)",
    washDark: "rgba(82, 188, 174, 0.22)",
  },
  {
    id: "quiz",
    numeral: "零叁",
    href: "/quiz",
    tag: "十二问寻歌",
    title: "寻曲",
    subtitle: "十二问，寻一首懂你的歌",
    accentLight: "#9A6728",
    accentDark: "#DFA95B",
    washLight: "rgba(154, 103, 40, 0.15)",
    washDark: "rgba(223, 169, 91, 0.22)",
  },
];

export const FLOATING_IMAGERY_WORDS = [
  "长安",
  "白雪",
  "红尘",
  "孤城",
  "旧梦",
  "桃花",
  "残阳",
  "江湖",
];

/** 从 gallery 与曲库提取带意象摘句的诗格素材 */
export function buildPoetryEntries(
  songs: Song[],
  gallery: GallerySong[],
): FeaturedEntry[] {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const picked: FeaturedEntry[] = [];
  const used = new Set<number>();

  for (const g of gallery) {
    const song = byId.get(g.id);
    if (song && !song.dispute_note && g.excerpt) {
      picked.push({ song, excerpt: g.excerpt });
      used.add(song.id);
      if (picked.length >= 10) break;
    }
  }

  if (picked.length === 0) {
    for (const song of songs) {
      if (used.has(song.id) || song.dispute_note) continue;
      picked.push({ song, excerpt: null });
      used.add(song.id);
      if (picked.length >= 5) break;
    }
  }

  return picked;
}

/** 汇总曲库档案统计信息 */
export function computeArchiveStats(songs: Song[]): ArchiveStats {
  const albums = new Set<string>();
  let oldest: number | null = null;
  let newest: number | null = null;
  let catalogCount = 0;

  for (const song of songs) {
    if (!song.dispute_note) catalogCount += 1;
    if (song.album && song.album !== song.title) albums.add(song.album);
    if (song.year) {
      if (oldest === null || song.year < oldest) oldest = song.year;
      if (newest === null || song.year > newest) newest = song.year;
    }
  }

  return {
    catalogCount,
    albumCount: albums.size,
    oldestYear: oldest,
    newestYear: newest,
  };
}

/** 计算高级筛选中已激活的维度数量（含年份区间与 5 个多选维度） */
export function countActiveAdvancedFilters(filters: LibraryFilters): number {
  let count = filters.year ? 1 : 0;
  for (const key of FACET_KEYS) {
    if (isSelectionActive(filters.facets[key])) count += 1;
  }
  return count;
}

/** 把歌曲映射到 years 选项数组中的 YearOption key */
export function songYearOption(song: Song): YearOption {
  return song.year ?? FILTER_OPTION_UNKNOWN;
}

/** 卡片副标题：单曲若专辑名同歌名，优先展示词曲或演唱者 */
export function songCreditLine(song: Song): string {
  if (song.lyricist?.length && song.composer?.length) {
    const l = song.lyricist.join("、");
    const c = song.composer.join("、");
    return l === c ? `词曲 ${l}` : `词 ${l} · 曲 ${c}`;
  }
  if (song.album && song.album !== song.title) return `《${song.album}》`;
  return song.artist?.join(" / ") || "单曲";
}
