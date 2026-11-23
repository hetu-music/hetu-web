"use client";

import { FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { type YearOption, songYearOption } from "./shared";

interface YearBucket {
  option: YearOption;
  totalCount: number;
  matchedCount: number;
  sampleTitles: string[];
}

interface ChronologySpectrumProps {
  /** 与库里年份滑轨同序：左新右旧（2026 → 2007 → 未知） */
  years: YearOption[];
  allSongs: Song[];
  matchedSongs: Song[];
  /** 当前是否有年份以外的检索/筛选生效（用于区分“常态全亮”还是“命中星图”） */
  hasNonYearFilter: boolean;
  yearSlider: [number, number];
  onYearChange: (range: [number, number]) => void;
  /** 下方曲库悬停或正在播放的曲目，反向点亮声谱上的对应年份 */
  focusedSong: Song | null;
}

/**
 * 「二十年光阴声谱」（左新右旧：2026 → 2007 → 未知）
 *
 * 绝不是统计柱状图，而是一件与下方曲库双向实时联动的极简墨韵装置：
 * - 常态下呈现河图二十年创作起伏的远山/琴弦墨谱；
 * - 单击某年锁定该年，按住横拖拉出光带即筛出该年代区间；
 * - 搜索或筛选人名/曲风/类型时，声谱实时重绘——命中年份亮起墨光，未命中褪成淡雾；
 * - 鼠标经过下方任意唱片封面时，对应年份的墨线亮起并浮现曲题，形成完整整体感。
 */
export default function ChronologySpectrum({
  years,
  allSongs,
  matchedSongs,
  hasNonYearFilter,
  yearSlider,
  onYearChange,
  focusedSong,
}: ChronologySpectrumProps) {
  const tCommon = useTranslations("common");
  const trackRef = useRef<HTMLDivElement>(null);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dragRange, setDragRange] = useState<[number, number] | null>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const didDragMoveRef = useRef(false);

  const count = years.length;
  const [selLeft, selRight] = dragRange ?? yearSlider;
  const isYearRangeActive = count > 1 && (selLeft > 0 || selRight < count - 1);

  // 按年份聚合总曲库（远山底稿）与当前命中结果（墨光星图）
  const { buckets, maxTotal } = useMemo(() => {
    const totalMap = new Map<YearOption, { count: number; titles: string[] }>();
    const matchedMap = new Map<YearOption, number>();

    for (const song of allSongs) {
      if (song.dispute_note) continue;
      const key = songYearOption(song);
      const entry = totalMap.get(key);
      if (entry) {
        entry.count += 1;
        if (entry.titles.length < 3) entry.titles.push(song.title);
      } else {
        totalMap.set(key, { count: 1, titles: [song.title] });
      }
    }

    for (const song of matchedSongs) {
      if (song.dispute_note) continue;
      const key = songYearOption(song);
      matchedMap.set(key, (matchedMap.get(key) ?? 0) + 1);
    }

    const list: YearBucket[] = years.map((opt) => {
      const t = totalMap.get(opt);
      return {
        option: opt,
        totalCount: t?.count ?? 0,
        matchedCount: matchedMap.get(opt) ?? 0,
        sampleTitles: t?.titles ?? [],
      };
    });
    const peak = list.reduce((m, b) => Math.max(m, b.totalCount), 1);

    return { buckets: list, maxTotal: peak };
  }, [years, allSongs, matchedSongs]);

  const focusedYearIdx = useMemo(() => {
    if (!focusedSong) return null;
    const key = songYearOption(focusedSong);
    const idx = years.indexOf(key);
    return idx >= 0 ? idx : null;
  }, [focusedSong, years]);

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || count === 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      return Math.min(count - 1, Math.max(0, Math.floor(ratio * count)));
    },
    [count],
  );

  const labelOf = useCallback(
    (opt: YearOption) =>
      opt === FILTER_OPTION_UNKNOWN ? tCommon("unknown") : String(opt),
    [tCommon],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || count === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = indexFromClientX(e.clientX);
    dragAnchorRef.current = idx;
    didDragMoveRef.current = false;
    setHoveredIdx(idx);
    setDragRange([idx, idx]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const idx = indexFromClientX(e.clientX);
    setHoveredIdx(idx);
    if (dragAnchorRef.current !== null) {
      if (idx !== dragAnchorRef.current) didDragMoveRef.current = true;
      const a = dragAnchorRef.current;
      setDragRange([Math.min(a, idx), Math.max(a, idx)]);
    }
  };

  const handlePointerUp = () => {
    if (dragAnchorRef.current === null || !dragRange) return;
    const [a, b] = dragRange;
    const wasClick = !didDragMoveRef.current;
    dragAnchorRef.current = null;
    setDragRange(null);

    // 单击已经锁定的唯一一年 → 复位全年代；否则锁定该年或拖选区间
    if (
      wasClick &&
      yearSlider[0] === a &&
      yearSlider[1] === b &&
      (a > 0 || b < count - 1)
    ) {
      onYearChange([0, count - 1]);
    } else {
      onYearChange([a, b]);
    }
  };

  const handlePointerCancel = () => {
    dragAnchorRef.current = null;
    setDragRange(null);
  };

  // 决定顶行耳语展示什么：拖拽区间 > 悬停声谱 > 悬停下方唱片 > 当前已选年代 > 默认提示
  const whisper = useMemo(() => {
    if (dragRange) {
      const [a, b] = dragRange;
      const rangeText =
        a === b
          ? `${labelOf(years[a])} 年`
          : `${labelOf(years[a])} — ${labelOf(years[b])}`;
      let sum = 0;
      for (let i = a; i <= b; i++) sum += buckets[i]?.totalCount ?? 0;
      return {
        primary: rangeText,
        secondary: `此段共 ${sum} 曲`,
        accent: true,
      };
    }

    if (hoveredIdx !== null && buckets[hoveredIdx]) {
      const b = buckets[hoveredIdx];
      const countText = hasNonYearFilter
        ? `命中 ${b.matchedCount} / ${b.totalCount} 曲`
        : `${b.totalCount} 曲`;
      const titles = b.sampleTitles
        .slice(0, 2)
        .map((t) => `《${t}》`)
        .join("");
      return {
        primary: `${labelOf(b.option)}${b.option === FILTER_OPTION_UNKNOWN ? "年份" : ""}`,
        secondary: titles ? `${countText} · ${titles}` : countText,
        accent: true,
      };
    }

    if (focusedSong) {
      return {
        primary: focusedSong.year
          ? String(focusedSong.year)
          : tCommon("unknown"),
        secondary: `《${focusedSong.title}》`,
        accent: true,
      };
    }

    if (isYearRangeActive) {
      const rangeText =
        selLeft === selRight
          ? `${labelOf(years[selLeft])}`
          : `${labelOf(years[selLeft])} — ${labelOf(years[selRight])}`;
      return {
        primary: `光阴切片 · ${rangeText}`,
        secondary: "再点年份或重置可展全谱",
        accent: true,
      };
    }

    return {
      primary: "二十年光阴声谱",
      secondary: "点选单年，或沿弦拖选一段岁月",
      accent: false,
    };
  }, [
    dragRange,
    hoveredIdx,
    buckets,
    hasNonYearFilter,
    focusedSong,
    isYearRangeActive,
    selLeft,
    selRight,
    years,
    labelOf,
    tCommon,
  ]);

  if (count === 0) return null;

  // 底部疏朗标出的刻度年份（首、尾及整五年，避免窄屏挤在一起）
  const shouldShowTick = (idx: number, opt: YearOption) => {
    if (idx === 0 || idx === count - 1) return true;
    if (typeof opt === "number" && opt % 5 === 0) {
      // 距离首尾至少 2 格才标，免得撞字
      return idx >= 2 && idx <= count - 3;
    }
    return false;
  };

  return (
    <section
      aria-label="二十年光阴声谱"
      className="relative pb-6 pt-3 select-none md:pb-8 md:pt-4"
    >
      {/* 声谱上方耳语行：实时响应悬停、拖拽、与下方曲库联动 */}
      <div className="mb-3 flex min-h-5 items-baseline justify-between gap-4 text-xs">
        <div className="flex min-w-0 items-baseline gap-2.5 truncate">
          <span
            className={cn(
              "shrink-0 font-mono tracking-[0.2em] transition-colors duration-300",
              whisper.accent ? "text-(--tone)" : "text-ink-meta",
            )}
          >
            {whisper.primary}
          </span>
          <span
            aria-hidden
            className="h-2.5 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
          />
          <span className="truncate font-kaiti text-[13px] text-ink-muted">
            {whisper.secondary}
          </span>
        </div>

        {isYearRangeActive && (
          <button
            type="button"
            onClick={() => onYearChange([0, count - 1])}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] tracking-[0.2em] text-(--tone) transition-opacity hover:opacity-75"
          >
            <RotateCcw size={11} />
            全谱
          </button>
        )}
      </div>

      {/* 声谱交互轨道：高 72px（桌面 88px），极细墨线如远山琴弦 */}
      <div
        ref={trackRef}
        role="group"
        aria-label="按发行年份点选或拖选声谱"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          if (dragAnchorRef.current === null) setHoveredIdx(null);
        }}
        className="relative flex h-[68px] w-full cursor-crosshair touch-pan-y items-end md:h-[86px]"
      >
        {/* 选段柔和光幕：拖选或锁定年份区间时浮现 */}
        {isYearRangeActive && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-t-sm bg-(--tone)/[0.06] transition-all duration-300 dark:bg-(--tone)/[0.11]"
            style={{
              left: `${(selLeft / count) * 100}%`,
              width: `${((selRight - selLeft + 1) / count) * 100}%`,
            }}
          />
        )}

        {/* 贯穿全宽的 1px 琴弦底线 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-slate-200/90 dark:bg-slate-800/90"
        />

        {/* 底线上对应已选区间的一段高亮强调丝线 */}
        {isYearRangeActive && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 h-[1.5px] bg-(--tone) transition-all duration-300"
            style={{
              left: `${(selLeft / count) * 100}%`,
              width: `${((selRight - selLeft + 1) / count) * 100}%`,
            }}
          />
        )}

        {/* 逐年细墨谱线 */}
        {buckets.map((bucket, idx) => {
          const inRange = idx >= selLeft && idx <= selRight;
          const isHovered = hoveredIdx === idx;
          const isFocusedFromGrid = focusedYearIdx === idx;
          const isHighlighted = isHovered || isFocusedFromGrid;

          // 开方缓和高度差，让低产年份也有清瘦骨感、高产年份如山峰舒展
          const totalRatio =
            bucket.totalCount > 0
              ? 0.14 + 0.82 * Math.sqrt(bucket.totalCount / maxTotal)
              : 0.05;
          const matchedRatio =
            bucket.matchedCount > 0
              ? Math.max(
                  0.12,
                  totalRatio *
                    (bucket.matchedCount / Math.max(1, bucket.totalCount)),
                )
              : 0;

          const showMatchedOverlay =
            hasNonYearFilter || isYearRangeActive || isHighlighted;

          return (
            <div
              key={String(bucket.option)}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
            >
              {/* 底部总库远山底稿线 */}
              <div
                className={cn(
                  "relative w-[2px] rounded-t-full transition-all duration-500 ease-page sm:w-[2.5px]",
                  !inRange
                    ? "bg-slate-300/30 dark:bg-slate-700/30"
                    : hasNonYearFilter
                      ? "bg-slate-300/45 dark:bg-slate-700/45"
                      : "bg-slate-400/55 dark:bg-slate-500/50",
                  isHighlighted && "w-[3px] sm:w-[3.5px]",
                )}
                style={{
                  height: `${Math.round(totalRatio * 100)}%`,
                }}
              >
                {/* 命中/激活墨光叠层：从琴弦底端升起 */}
                {showMatchedOverlay && inRange && matchedRatio > 0 && (
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 rounded-t-full bg-(--tone) transition-all duration-500 ease-page",
                      isHighlighted
                        ? "opacity-100 shadow-[0_0_12px_var(--tone)]"
                        : hasNonYearFilter || isYearRangeActive
                          ? "opacity-85"
                          : "opacity-0",
                    )}
                    style={{
                      height: `${Math.round((matchedRatio / totalRatio) * 100)}%`,
                    }}
                  />
                )}

                {/* 峰顶微墨点：在悬停、反向联动或命中星图时亮起星芒 */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full transition-all duration-300",
                    isHighlighted
                      ? "scale-150 bg-(--tone) opacity-100 shadow-[0_0_8px_var(--tone)]"
                      : inRange && hasNonYearFilter && bucket.matchedCount > 0
                        ? "bg-(--tone) opacity-85"
                        : inRange && !hasNonYearFilter
                          ? "bg-slate-400/70 opacity-60 dark:bg-slate-500/70"
                          : "opacity-0",
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 琴弦下方疏朗年份刻度（左新右旧） */}
      <div className="mt-2.5 flex w-full">
        {buckets.map((bucket, idx) => {
          const visible =
            shouldShowTick(idx, bucket.option) ||
            hoveredIdx === idx ||
            focusedYearIdx === idx;
          const active = hoveredIdx === idx || focusedYearIdx === idx;
          return (
            <div key={String(bucket.option)} className="relative flex-1">
              {visible && (
                <span
                  className={cn(
                    "block whitespace-nowrap font-mono text-[10px] tabular-nums transition-colors duration-300",
                    idx === 0
                      ? "text-left"
                      : idx === count - 1
                        ? "text-right"
                        : "text-center",
                    active ? "text-(--tone)" : "text-ink-meta/85",
                  )}
                >
                  {labelOf(bucket.option)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
