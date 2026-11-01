"use client";

/**
 * 曲库页搜歌词用的数据（docs/LIBRARY.md 阶段 5，三档加载里的第三档）。
 *
 * 不再挂载 1 秒后固定去拉（R3）：搜索框获得焦点、或者已经有搜索词时才拉。大多数访客不搜索，
 * 数据又比代码大得多，所以不放进空闲预加载。拉到之后用第二档的 engine 分段建索引，
 * 建好之前只查题名、人名这些元数据。
 *
 * 地址带页面字形和版本号：同一地址内容不变，第二次访问从 Service Worker 直接读（sw.ts）。
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { LibraryEngine } from "@/lib/library/engine";
import type { LyricsCorpus, LyricsLinesEntry } from "@/lib/search/corpus";

/** idle：还没要；loading：在拉或在建索引；ready：可以搜歌词了 */
export type LyricsSearchState = "idle" | "loading" | "ready" | "error";

function lyricsUrl(locale: string, version: string): string {
  const params = new URLSearchParams({ locale });
  // 版本号取不到时不带 v：带了就会被当成「不会再变」长缓存
  if (version) params.set("v", version);
  return `/api/public/songs/lyrics-lines?${params}`;
}

async function fetchLyricsLines(url: string): Promise<LyricsLinesEntry[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`lyrics-lines ${response.status}`);
  return response.json();
}

export function useLyricsLines({
  locale,
  version,
  wanted,
  engine,
}: {
  locale: string;
  version: string;
  /** 用户表现出要搜索了（搜索框获得焦点、有搜索词）；一旦为 true 就一直拉着 */
  wanted: boolean;
  /** 建索引要用归一化，在第二档里 */
  engine: LibraryEngine | null;
}): { corpus: LyricsCorpus | null; state: LyricsSearchState } {
  const [requested, setRequested] = useState(false);
  if (wanted && !requested) setRequested(true);

  const url = lyricsUrl(locale, version);
  const query = useQuery({
    queryKey: ["lyrics-lines", url],
    queryFn: () => fetchLyricsLines(url),
    enabled: requested,
    staleTime: Infinity,
    // 从详情页返回时还在内存里，索引也不用重建
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  const entries = query.data;

  // 建好的索引按数据缓存在 engine 里，返回曲库页时同步拿到
  const built = engine && entries ? engine.builtCorpus(entries) : null;
  const [corpus, setCorpus] = useState<{
    entries: LyricsLinesEntry[];
    corpus: LyricsCorpus;
  } | null>(null);
  const [buildFailed, setBuildFailed] = useState(false);

  useEffect(() => {
    if (!engine || !entries || built) return;
    let cancelled = false;
    engine.buildCorpus(entries).then(
      (c) => {
        if (!cancelled) setCorpus({ entries, corpus: c });
      },
      (error: unknown) => {
        console.error("Failed to build lyrics corpus:", error);
        if (!cancelled) setBuildFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [engine, entries, built]);

  const current =
    built ?? (corpus && corpus.entries === entries ? corpus.corpus : null);

  const state: LyricsSearchState = !requested
    ? "idle"
    : query.isError || buildFailed
      ? "error"
      : current
        ? "ready"
        : "loading";

  return { corpus: current, state };
}
