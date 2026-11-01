"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LyricsEntry } from "@/lib/library/legacy-fuse";
import type { Song } from "@/lib/types";
import type { MatchRanges } from "@/lib/utils/utils-song";

export type { LyricsEntry };

export type LyricsSearchState = "idle" | "loading" | "ready" | "error";

export interface UseLyricsIndexResult {
  /** 全部歌词文本，到了之后由搜索那一端建含歌词的索引（见 src/lib/library/engine.ts） */
  entries: LyricsEntry[] | undefined;
  state: LyricsSearchState;
}

async function fetchLyricsIndex(): Promise<LyricsEntry[]> {
  const response = await fetch("/api/public/songs/lyrics-index");
  if (!response.ok) {
    throw new Error("fetch failed");
  }

  return response.json();
}

/**
 * 后台异步拉取全部歌词文本，供搜索歌词用。
 * 拉取是非阻塞的，不影响页面首屏，完成后无感刷新搜索能力。
 * 拉取结果由 react-query 缓存，返回详情页再回来时可即时恢复，无需重新 fetch。
 * 阶段 5 换成按需拉取（见 docs/LIBRARY.md 阶段 5「3.」）。
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

  const state: LyricsSearchState = !enabled
    ? "idle"
    : query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : "ready";

  return { entries: query.data, state };
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
