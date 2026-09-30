"use client";

import { usePlaybackTick } from "@/hooks/player/usePlayerTime";
import { getCurrentLrcIndex, parseLrc } from "@/lib/player/player-utils";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import { useCallback, useEffect, useMemo, useState } from "react";

/** 当前曲带时间轴的歌词行；没有歌词或没有时间轴时为空数组 */
export function useLyricLines(songId: number | undefined) {
  const lrc = usePlayerStore((s) =>
    songId === undefined ? undefined : s.lyricsMap.get(songId),
  );
  return useMemo(() => (lrc ? parseLrc(lrc) : []), [lrc]);
}

/**
 * 当前唱到的那一句。跟 timeupdate 算，只在句子变化时重渲染调用方
 * （同一个 index 的 setState 会被 React 直接跳过）。
 */
export function useCurrentLyric(songId: number) {
  const lines = useLyricLines(songId);
  const [index, setIndex] = useState(-1);
  const refresh = usePlaybackTick(
    useCallback(
      (ct: number) => setIndex(getCurrentLrcIndex(lines, ct)),
      [lines],
    ),
  );
  // 换曲或歌词刚到时立即算一次；暂停中不会有 timeupdate
  useEffect(() => refresh(), [lines, refresh]);

  const text = index >= 0 ? (lines[index]?.text ?? null) : null;
  return { hasLyrics: lines.length > 0, index, text };
}

/**
 * 按字符估算一行的视觉宽度（单位 em）：汉字与全角标点约 1em，西文约半个。
 * 乘 1.08 留出字距与估算误差，免得「刚好放满」时最后一个字被省略号吃掉
 */
function visualLength(text: string) {
  let n = 0;
  for (const ch of text) n += /[\u2e80-\uffef]/.test(ch) ? 1 : 0.55;
  return Math.max(n, 1) * 1.08;
}

/**
 * 一句歌词，楷体。字号在 11px 与 maxPx 之间取「刚好一行放下」的值：
 * 用容器宽度（cqw）除以估算的字数，不量 DOM、不滚动。缩到下限仍放不下才省略。
 * 需要祖先元素带 @container。
 */
export function LyricText({
  text,
  maxPx,
  className,
}: {
  text: string;
  maxPx: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "truncate font-kaiti text-(--tone) animate-in fade-in duration-500",
        className,
      )}
      style={{
        fontSize: `clamp(11px, calc(100cqw / ${visualLength(text).toFixed(2)}), ${maxPx}px)`,
      }}
    >
      {text}
    </p>
  );
}
