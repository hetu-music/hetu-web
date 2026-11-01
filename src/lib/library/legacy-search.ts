/**
 * 旧的 Fuse 搜索，包成和阶段 2 的 searchSongs（src/lib/search/rank.ts）同样的调用方式：
 * 传入要在其中搜索的歌和搜索词，没有可搜的字时返回 null。阶段 5 换成 rank.ts，阶段 6 删除。
 * 见 docs/LIBRARY.md 阶段 3「4. 搜索与筛选拆开」。
 */
import type Fuse from "fuse.js";
import type { Song } from "@/lib/types";
import { LYRIC_SEARCH_KEY, type MatchRanges } from "@/lib/utils/utils-song";

export interface LegacySearchResult {
  /** 按 Fuse 的相关度排好的歌 */
  songs: Song[];
  /** 命中发生在歌词上的歌的字符区间，显示片段用 */
  lyricMatchesById: Map<number, MatchRanges>;
}

export function legacySearch<T extends Song>(
  songs: readonly Song[],
  query: string,
  // 基础索引或含歌词的扩展索引
  fuse: Fuse<T>,
): LegacySearchResult | null {
  if (!query.trim()) return null;
  // Fuse 的结果是它自己建索引时复制的对象，换回传入的原对象（SongMeta 按对象缓存）
  const byId = new Map(songs.map((s) => [s.id, s]));
  const lyricMatchesById = new Map<number, MatchRanges>();
  const found: Song[] = [];
  for (const result of fuse.search(query)) {
    const song = byId.get(result.item.id);
    if (!song) continue;
    found.push(song);
    const lyricMatch = result.matches?.find((m) => m.key === LYRIC_SEARCH_KEY);
    if (lyricMatch?.indices?.length) {
      lyricMatchesById.set(result.item.id, lyricMatch.indices);
    }
  }
  return { songs: found, lyricMatchesById };
}
