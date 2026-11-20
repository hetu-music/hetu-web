import type { GallerySong } from "@/lib/auth-gallery-shared";
import type { Song } from "@/lib/types";

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

export interface FeatureTriptychItem {
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

export const TRIPTYCH_ITEMS: FeatureTriptychItem[] = [
  {
    id: "qjtx",
    numeral: "零壹",
    href: "/story/qjtx",
    tag: "互动长卷",
    title: "倾尽天下",
    subtitle: "一曲长歌，随乐声缓步展开江山旧梦",
    accentLight: "#9E3636",
    accentDark: "#E46A6A",
    washLight: "rgba(158, 54, 54, 0.11)",
    washDark: "rgba(228, 106, 106, 0.16)",
  },
  {
    id: "imagery",
    numeral: "零贰",
    href: "/imagery",
    tag: "词中万象",
    title: "意象词云",
    subtitle: "从长安白雪到孤城旧梦，漫游数百首词作谱系",
    accentLight: "#286B62",
    accentDark: "#52BCAE",
    washLight: "rgba(40, 107, 98, 0.11)",
    washDark: "rgba(82, 188, 174, 0.16)",
  },
  {
    id: "quiz",
    numeral: "零叁",
    href: "/quiz",
    tag: "十二问寻歌",
    title: "寻曲",
    subtitle: "十二个问题，一段旅程，在曲库深处寻一首懂你的歌",
    accentLight: "#9A6728",
    accentDark: "#DFA95B",
    washLight: "rgba(154, 103, 40, 0.12)",
    washDark: "rgba(223, 169, 91, 0.16)",
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

/** 从 gallery 与全量曲库组合卷首留声焦点列表（最多 8 首） */
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
      if (picked.length >= 8) break;
    }
  }

  if (picked.length < 8) {
    for (const song of songs) {
      if (used.has(song.id) || song.dispute_note || !song.hascover) continue;
      picked.push({ song, excerpt: null });
      used.add(song.id);
      if (picked.length >= 8) break;
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

/** 按发行年份保持原序分组，用于编年陈列 */
export interface YearGroup {
  key: string;
  year: number | null;
  songs: Song[];
}

export function groupSongsByYear(songs: Song[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const song of songs) {
    const key = song.year ? String(song.year) : "未知";
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.songs.push(song);
    } else {
      groups.push({ key, year: song.year ?? null, songs: [song] });
    }
  }
  return groups;
}

/** 作品署名或专辑副行 */
export function songCreditLine(song: Song): string {
  if (song.lyricist?.length && song.composer?.length) {
    const l = song.lyricist.join("、");
    const c = song.composer.join("、");
    return l === c ? `词曲 · ${l}` : `词 ${l} · 曲 ${c}`;
  }
  if (song.album && song.album !== song.title) return `《${song.album}》`;
  return song.artist?.join(" / ") || "单曲";
}
