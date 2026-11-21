"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { creditSummary, stripeColor } from "./timeline";

interface ColorTapestryProps {
  /** 已按当前时间方向（由近及远 / 由远及近）排好序的全部在册歌曲 */
  songs: Song[];
  /** 当前筛选/搜索命中的歌曲 ID 集合；未筛选时为 null */
  matched: ReadonlySet<number> | null;
  /** 点击色带上的某首歌/某一年时，平滑跳到对应年份章节 */
  onJumpToYear: (year: number | null) => void;
  /** 悬停或划过色丝时同步给页面顶部做柔和光色回应 */
  onSpotlightColor?: (color: string | null) => void;
}

/**
 * 「二十年的颜色」连续色彩光谱：
 * 三百多首歌的真实封面主色（cover-colors.json）按发行时间织成一条横贯屏宽的色丝带。
 * - 常态：一幅极简抽象的二十年时光色谱，只占 ~96px 高度，不阻挡下方搜索与曲库；
 * - 滑动/悬停：指尖或光标掠过每一根色丝，上方轻声浮现那首歌的封面、曲题与年月；
 * - 搜索/筛选：未命中的色丝褪暗，只有命中的歌曲在光谱中以真实色彩亮起，一眼看清时间分布。
 */
export default function ColorTapestry({
  songs,
  matched,
  onJumpToYear,
  onSpotlightColor,
}: ColorTapestryProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 计算每一年在色带中的起始比例与刻度标签（稀疏标出首尾与整五年，避免撞字）
  const yearMarks = useMemo(() => {
    const total = songs.length;
    if (total === 0) return [];
    const starts: Array<{ year: number | null; index: number }> = [];
    let prev: number | null | undefined = undefined;
    songs.forEach((s, i) => {
      const y = s.year ?? null;
      if (y !== prev) {
        starts.push({ year: y, index: i });
        prev = y;
      }
    });

    return starts.map((item, idx) => {
      const isEdge = idx === 0 || idx === starts.length - 1;
      const isMilestone =
        typeof item.year === "number" &&
        item.year % 5 === 0 &&
        idx >= 2 &&
        idx <= starts.length - 3;
      return {
        ...item,
        leftPct: (item.index / total) * 100,
        showLabel: isEdge || isMilestone,
      };
    });
  }, [songs]);

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = railRef.current;
      if (!el || songs.length === 0) return null;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      const clamped = Math.min(0.99999, Math.max(0, ratio));
      return Math.floor(clamped * songs.length);
    },
    [songs.length],
  );

  const updatePointer = useCallback(
    (clientX: number) => {
      const idx = indexFromClientX(clientX);
      setActiveIndex(idx);
      if (idx !== null) {
        onSpotlightColor?.(stripeColor(songs[idx]));
      }
    },
    [indexFromClientX, songs, onSpotlightColor],
  );

  const handleLeave = useCallback(() => {
    setActiveIndex(null);
    onSpotlightColor?.(null);
  }, [onSpotlightColor]);

  const activeSong = activeIndex !== null ? (songs[activeIndex] ?? null) : null;
  const activeColor = activeSong ? stripeColor(activeSong) : null;
  const activeLeftPct =
    activeIndex !== null && songs.length > 0
      ? ((activeIndex + 0.5) / songs.length) * 100
      : 0;

  if (songs.length === 0) return null;

  return (
    <section aria-label="二十年的颜色光谱" className="relative select-none">
      {/* 顶部微预览栏：常态极简耳语，掠过色带时显现当前那一根色丝对应的作品 */}
      <div className="mb-3 flex min-h-11 items-center justify-between gap-4">
        {activeSong ? (
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xs bg-slate-200 ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/15"
              style={{ backgroundColor: activeColor ?? undefined }}
            >
              {activeSong.hascover && (
                <Image
                  src={getCoverUrl(activeSong)}
                  alt={activeSong.title}
                  width={72}
                  height={72}
                  sizes="36px"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2.5">
                <span className="truncate font-serif text-sm text-slate-900 sm:text-[15px] dark:text-slate-100">
                  《{activeSong.title}》
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-(--tone)">
                  {activeSong.date?.replaceAll("-", ".") ||
                    activeSong.year ||
                    "未详"}
                </span>
              </div>
              <p className="truncate font-kaiti text-xs text-slate-500 dark:text-slate-400">
                {creditSummary(activeSong) || "点击跳转至该年章节"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="text-[11px] tracking-[0.3em] text-(--tone)">
              二十年的颜色
            </span>
            <span
              aria-hidden
              className="h-2.5 w-px bg-slate-200 dark:bg-slate-800"
            />
            <span className="truncate font-kaiti text-[13px] text-slate-400 dark:text-slate-500">
              {matched
                ? `光谱中已为你点亮 ${matched.size} 道色丝，滑过观曲，点选入章`
                : "每一道色丝皆取自封面主色，滑过细听光阴流转，点击直达该年"}
            </span>
          </div>
        )}

        {activeSong && (
          <span className="hidden shrink-0 text-[11px] tracking-[0.22em] text-slate-400 sm:inline dark:text-slate-500">
            点击跳至 {activeSong.year ?? "未详"} 章 ↓
          </span>
        )}
      </div>

      {/* 连续色丝织带主体 */}
      <div
        ref={railRef}
        role="group"
        aria-label="按时间排列的作品色彩光谱"
        onPointerMove={(e) => updatePointer(e.clientX)}
        onPointerDown={(e) => {
          updatePointer(e.clientX);
        }}
        onPointerLeave={handleLeave}
        onClick={(e) => {
          const idx = indexFromClientX(e.clientX);
          if (idx !== null && songs[idx]) {
            onJumpToYear(songs[idx].year ?? null);
          }
        }}
        className="relative flex h-18.5 w-full cursor-pointer touch-pan-y items-end overflow-hidden rounded-xs ring-1 ring-slate-900/8 sm:h-23 dark:ring-white/10"
      >
        {songs.map((song, idx) => {
          const color = stripeColor(song);
          const isMatched = matched === null || matched.has(song.id);
          const isActive = activeIndex === idx;

          return (
            <span
              key={song.id}
              aria-hidden
              className={cn(
                "block h-full flex-1 transition-[opacity,transform] duration-300",
                !color && "bg-slate-300/65 dark:bg-slate-700/55",
                matched && !isMatched && "opacity-[0.1] grayscale",
                matched && isMatched && "opacity-100",
                !matched && "opacity-90",
              )}
              style={{
                backgroundColor: color ?? undefined,
                transform: isActive ? "scaleY(1)" : undefined,
                filter: isActive ? "brightness(1.18) saturate(1.25)" : undefined,
              }}
            />
          );
        })}

        {/* 极细年代分界竖线，让二十年节拍隐约可见 */}
        {yearMarks.slice(1).map((mark) => (
          <span
            key={String(mark.year)}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-[#FAFAFA]/45 dark:bg-[#0B0F19]/50"
            style={{ left: `${mark.leftPct}%` }}
          />
        ))}

        {/* 顶底一层极柔微光过渡，消除色条生硬的电子条形码感，赋予丝绸与画卷光泽 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-linear-to-b from-black/10 to-transparent dark:from-black/35"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t from-black/15 to-transparent dark:from-black/40"
        />

        {/* 游标指针细丝 */}
        {activeIndex !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]"
            style={{ left: `${activeLeftPct}%` }}
          />
        )}
      </div>

      {/* 色带下方疏朗年份标尺：点击任意年份直达章节 */}
      <div className="relative mt-2.5 h-5 w-full">
        {yearMarks.map((mark, i) => {
          if (!mark.showLabel) return null;
          const isFirst = i === 0;
          const isLast = i === yearMarks.length - 1;
          return (
            <button
              key={String(mark.year)}
              type="button"
              onClick={() => onJumpToYear(mark.year)}
              className={cn(
                "absolute top-0 font-mono text-[10px] tabular-nums tracking-wider text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500",
                isFirst
                  ? "left-0"
                  : isLast
                    ? "right-0"
                    : "-translate-x-1/2",
              )}
              style={
                !isFirst && !isLast ? { left: `${mark.leftPct}%` } : undefined
              }
            >
              {mark.year ?? "未详"}
            </button>
          );
        })}
      </div>
    </section>
  );
}
