"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { stripeColor } from "./timeline";

interface TimeBandProps {
  /** 有日期的歌，按发行日期排好 */
  songs: Song[];
  /** 当前筛选命中的歌；null 是没有筛选 */
  matched: ReadonlySet<number> | null;
  onOpenSong: (id: number) => void;
  onJumpYear: (year: number) => void;
}

interface YearSpan {
  year: number;
  start: number;
  count: number;
}

const EASE_TIME = [0.65, 0, 0.35, 1] as const;

/**
 * 二十年的颜色：一首歌一根竖条，颜色取自它的封面，按发行顺序从左排到右。
 * 没有封面的歌是一道留白。年份只在下面的标尺上标出，色带本身不断开。
 */
export default function TimeBand({
  songs,
  matched,
  onOpenSong,
  onJumpYear,
}: TimeBandProps) {
  const reduceMotion = useReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);
  const [bandSize, setBandSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const n = songs.length;

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setBandSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spans = useMemo(() => {
    const out: YearSpan[] = [];
    songs.forEach((s, i) => {
      const y = s.year ?? 0;
      const last = out[out.length - 1];
      if (last && last.year === y) last.count += 1;
      else out.push({ year: y, start: i, count: 1 });
    });
    return out;
  }, [songs]);

  // 年份标在自己那一段的正中；挤的地方隔开标，首尾两年总是标
  const labelled = useMemo(() => {
    const minGap = bandSize.w > 0 ? 44 / bandSize.w : 0.05;
    const shown = new Set<number>();
    let lastCenter = -1;
    spans.forEach((sp, i) => {
      const center = (sp.start + sp.count / 2) / n;
      const isEnd = i === 0 || i === spans.length - 1;
      if (isEnd || center - lastCenter >= minGap) {
        if (i === spans.length - 1 && center - lastCenter < minGap) {
          // 末年总要标：挤掉前一个
          const prev = [...shown].pop();
          if (prev !== undefined && prev !== spans[0].year) shown.delete(prev);
        }
        shown.add(sp.year);
        lastCenter = center;
      }
    });
    return shown;
  }, [spans, n, bandSize.w]);

  const indexAt = (clientX: number) => {
    const el = bandRef.current;
    if (!el || n === 0) return null;
    const rect = el.getBoundingClientRect();
    const i = Math.floor(((clientX - rect.left) / rect.width) * n);
    return Math.min(n - 1, Math.max(0, i));
  };

  const hoveredSong = hovered !== null ? songs[hovered] : null;
  const hoveredColor = hoveredSong ? stripeColor(hoveredSong) : null;
  const previewSize = Math.round(bandSize.h * 0.62);
  const previewLeft =
    hovered !== null && bandSize.w > 0
      ? Math.min(
          bandSize.w - previewSize / 2,
          Math.max(previewSize / 2, ((hovered + 0.5) / n) * bandSize.w),
        )
      : 0;

  return (
    <div className="[--blank:#E2E8F0] dark:[--blank:#1E293B]">
      <motion.div
        ref={bandRef}
        role="img"
        aria-label={`${n} 首歌的封面颜色，按发行顺序排列`}
        initial={
          reduceMotion ? false : { clipPath: "inset(0 100% 0 0)" }
        }
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 2.6, ease: EASE_TIME, delay: 0.25 }}
        onAnimationComplete={() => setRevealed(true)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") setHovered(indexAt(e.clientX));
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHovered(null);
        }}
        onClick={(e) => {
          const i = indexAt(e.clientX);
          if (i === null) return;
          // 鼠标点了就进；触屏第一下只是看，第二下同一根才进
          const isTouch =
            (e.nativeEvent as PointerEvent).pointerType !== "mouse";
          if (isTouch && hovered !== i) {
            setHovered(i);
            return;
          }
          onOpenSong(songs[i].id);
        }}
        className="relative flex h-[clamp(220px,44svh,480px)] w-full cursor-pointer"
      >
        {songs.map((s, i) => {
          const color = stripeColor(s);
          const lit = matched === null || matched.has(s.id);
          return (
            <span
              key={s.id}
              className={cn(
                "h-full flex-1 transition-opacity duration-700 ease-page",
                !lit && "opacity-[0.07]",
                hovered !== null && hovered !== i && lit && "opacity-80",
              )}
              style={{ background: color ?? "var(--blank)" }}
            />
          );
        })}

        {/* 停在哪一根，就从那一根里翻出封面 */}
        {hoveredSong && hoveredColor && previewSize > 0 && (
          <motion.div
            key={hoveredSong.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none absolute top-1/2 overflow-hidden shadow-[0_24px_60px_-24px_rgba(15,23,42,0.55)] ring-1 ring-black/5"
            style={{
              width: previewSize,
              height: previewSize,
              left: previewLeft - previewSize / 2,
              marginTop: -previewSize / 2,
              background: hoveredColor,
            }}
          >
            <Image
              src={getCoverUrl(hoveredSong)}
              alt=""
              fill
              sizes={`${previewSize}px`}
              className="object-cover"
            />
          </motion.div>
        )}
      </motion.div>

      {/* 标尺：每年一道刻度，年份标在自己那一段正中 */}
      <div
        className={cn(
          "relative mt-3 h-8 transition-opacity duration-1000",
          revealed || reduceMotion ? "opacity-100" : "opacity-0",
        )}
      >
        {spans.map((sp) => {
          const left = (sp.start / n) * 100;
          const center = ((sp.start + sp.count / 2) / n) * 100;
          const isHoverYear = hoveredSong?.year === sp.year;
          return (
            <div key={sp.year}>
              <span
                aria-hidden
                className="absolute top-0 h-1.5 w-px bg-slate-300 dark:bg-slate-700"
                style={{ left: `${left}%` }}
              />
              {(labelled.has(sp.year) || isHoverYear) && (
                <button
                  type="button"
                  onClick={() => onJumpYear(sp.year)}
                  className={cn(
                    "absolute top-2.5 -translate-x-1/2 font-serif text-[11px] tabular-nums tracking-wider transition-colors hover:text-(--tone)",
                    isHoverYear
                      ? "z-10 bg-[#FAFAFA] px-1 text-slate-900 dark:bg-[#0B0F19] dark:text-slate-100"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                  style={{ left: `${center}%` }}
                >
                  {sp.year}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 说明行：停在哪首就写哪首 */}
      <div className="mt-2 flex h-6 items-baseline gap-3 text-sm">
        {hoveredSong ? (
          <>
            <span className="font-serif tabular-nums text-xs tracking-wider text-slate-400 dark:text-slate-500">
              {hoveredSong.date?.replaceAll("-", ".")}
            </span>
            <button
              type="button"
              onClick={() => onOpenSong(hoveredSong.id)}
              className="truncate font-serif text-slate-900 transition-colors hover:text-(--tone) dark:text-slate-100"
            >
              {hoveredSong.title}
            </button>
            {hoveredSong.album && hoveredSong.album !== hoveredSong.title && (
              <span className="truncate text-xs text-slate-400 dark:text-slate-500">
                《{hoveredSong.album}》
              </span>
            )}
          </>
        ) : (
          <span className="font-kaiti text-slate-400 dark:text-slate-500">
            {matched
              ? `亮着的 ${songs.filter((s) => matched.has(s.id)).length} 根，是这次找到的歌。`
              : "一首歌一种颜色，取自它的封面；空白处是还没有封面的歌。"}
          </span>
        )}
      </div>
    </div>
  );
}
