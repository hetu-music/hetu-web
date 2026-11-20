import type { GallerySong } from "@/lib/auth-gallery-shared";
import type { MusicLibraryViewMode } from "@/lib/constants";
import type { Song } from "@/lib/types";
import type React from "react";

export type DemoVariant = "A" | "B" | "C";

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

export interface DemoViewProps {
  songs: Song[];
  filteredSongs: Song[];
  pageSongs: Song[];
  featured: FeaturedEntry[];
  recentSongs: Song[];
  wallSongs: GallerySong[];
  stats: ArchiveStats;
  types: string[];
  activeType: string;
  onTypeChange: (type: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isFiltering: boolean;
  onReset: () => void;
  view: MusicLibraryViewMode;
  onViewChange: (v: MusicLibraryViewMode) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  listStartRef: React.RefObject<HTMLDivElement | null>;
  onOpenSong: (songId: number) => void;
  onRandomSong: () => void;
}

export interface FeatureItem {
  id: "qjtx" | "imagery" | "quiz";
  indexNum: string;
  href: string;
  tag: string;
  title: string;
  subtitle: string;
  accentLight: string;
  accentDark: string;
}

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: "qjtx",
    indexNum: "壹",
    href: "/story/qjtx",
    tag: "互动长卷",
    title: "倾尽天下",
    subtitle: "一曲长歌，血染江山的画卷，随乐声缓步展开",
    accentLight: "#9E3636",
    accentDark: "#E46A6A",
  },
  {
    id: "imagery",
    indexNum: "贰",
    href: "/imagery",
    tag: "词中万象",
    title: "意象词云",
    subtitle: "从长安白雪到孤城旧梦，漫游数百首词作的意象谱系",
    accentLight: "#286B62",
    accentDark: "#52BCAE",
  },
  {
    id: "quiz",
    indexNum: "叁",
    href: "/quiz",
    tag: "十二问寻歌",
    title: "寻曲",
    subtitle: "十二个问题，一段旅程，在曲库深处寻一首懂你的歌",
    accentLight: "#9A6728",
    accentDark: "#DFA95B",
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

/** 从 gallery 与全量曲库组合卷首焦点列表；gallery 缺省时自动兜底取有封面的近期作品 */
export function buildFeaturedEntries(
  songs: Song[],
  gallery: GallerySong[],
): FeaturedEntry[] {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const picked: FeaturedEntry[] = [];
  const used = new Set<number>();

  for (const g of gallery) {
    const song = byId.get(g.id);
    if (song && !song.dispute_note && song.hascover) {
      picked.push({ song, excerpt: g.excerpt || null });
      used.add(song.id);
      if (picked.length >= 6) break;
    }
  }

  if (picked.length < 6) {
    for (const song of songs) {
      if (used.has(song.id) || song.dispute_note || !song.hascover) continue;
      picked.push({ song, excerpt: null });
      used.add(song.id);
      if (picked.length >= 6) break;
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
