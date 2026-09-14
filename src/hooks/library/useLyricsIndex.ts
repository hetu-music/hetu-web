"use client";

import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import type { Song } from "@/lib/types";
import { LYRIC_SEARCH_KEY, type MatchRanges } from "@/lib/utils/utils-song";

export type LyricsEntry = { id: number; l: string };

export type LyricsSearchState = "idle" | "loading" | "ready" | "error";

export interface UseLyricsIndexResult {
  // 扩充了歌词后的 Fuse 实例（ready 后替代初始实例）
  lyricsFuseInstance: Fuse<
    Song & { searchableContent: string; lyricContent: string }
  > | null;
  // 按 id 映射的歌词索引 Map，供展示搜索命中片段用
  lyricsMap: Map<number, string>;
  state: LyricsSearchState;
}

type FuseExtended = Fuse<
  Song & { searchableContent: string; lyricContent: string }
>;

function buildFromEntries(
  songs: Song[],
  entries: LyricsEntry[],
): { map: Map<number, string>; fuse: FuseExtended } {
  const map = new Map<number, string>();
  entries.forEach((entry) => map.set(entry.id, entry.l));

  const searchData = songs.map((song) => ({
    ...song,
    searchableContent: [
      song.title,
      song.album || "",
      (song.artist || []).join(" "),
      (song.lyricist || []).join(" "),
      (song.composer || []).join(" "),
      (song.arranger || []).join(" "),
    ]
      .filter(Boolean)
      .join(" "),
    [LYRIC_SEARCH_KEY]: map.get(song.id) || "",
  }));

  const fuse = new Fuse(searchData, {
    keys: [
      { name: "title", weight: 0.35 },
      { name: "album", weight: 0.15 },
      { name: "artist", weight: 0.15 },
      { name: "lyricist", weight: 0.1 },
      { name: "composer", weight: 0.05 },
      { name: "arranger", weight: 0.05 },
      { name: LYRIC_SEARCH_KEY, weight: 0.15 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 1,
    shouldSort: true,
    includeMatches: true,
  });

  return { map, fuse };
}

async function fetchLyricsIndex(): Promise<LyricsEntry[]> {
  const response = await fetch("/api/public/songs/lyrics-index");
  if (!response.ok) {
    throw new Error("fetch failed");
  }

  return response.json();
}

/**
 * 后台异步拉取全部歌词文本，构建包含歌词的 Fuse.js 索引。
 * 拉取是非阻塞的，不影响页面首屏，完成后无感刷新搜索能力。
 * 拉取结果缓存在模块级变量中，返回详情页再回来时可即时恢复，无需重新 fetch。
 */
export function useLyricsIndex(songs: Song[]): UseLyricsIndexResult {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (songs.length === 0) return;
    const timer = setTimeout(() => setEnabled(true), 1000);
    return () => clearTimeout(timer);
  }, [songs]);

  const query = useQuery({
    queryKey: ["lyrics-index"],
    queryFn: fetchLyricsIndex,
    enabled: enabled && songs.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const builtIndex = useMemo(() => {
    if (!query.data) {
      return {
        map: new Map<number, string>(),
        fuse: null as FuseExtended | null,
      };
    }

    const { map, fuse } = buildFromEntries(songs, query.data);
    return { map, fuse };
  }, [songs, query.data]);

  const state: LyricsSearchState = !enabled
    ? "idle"
    : query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : "ready";

  return {
    lyricsFuseInstance: builtIndex.fuse,
    lyricsMap: builtIndex.map,
    state,
  };
}

/**
 * 从歌词文本中截取 Fuse 实际命中的那一段，用于搜索结果展示。
 *
 * 区间直接来自检索时的 Fuse matches，不再用 indexOf 重新查一遍——
 * Fuse 是模糊匹配而 indexOf 是精确匹配，两者算法不一致会让一部分
 * 搜出来的歌显示不出任何片段（例如搜「不知道」命中 53 首，其中 50 首
 * 并不含该精确子串）。
 *
 * @param lyricsText - 处理后的纯文本歌词
 * @param ranges     - Fuse 给出的命中字符区间 [start, end]（闭区间）
 */
export function extractLyricsSnippet(
  lyricsText: string,
  ranges: MatchRanges | undefined,
  maxLength = 36,
): string {
  if (!lyricsText || !ranges?.length) return "";

  // 取最长的那段命中，信息量最大
  let best = ranges[0];
  for (const range of ranges) {
    if (range[1] - range[0] > best[1] - best[0]) best = range;
  }

  const [matchStart, matchEnd] = best;
  const start = Math.max(0, matchStart - 8);
  const end = Math.min(lyricsText.length, matchEnd + 1 + maxLength);
  return lyricsText.slice(start, end).trim();
}
