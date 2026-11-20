"use client";

import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Search, Shuffle } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveStats, FeaturedEntry } from "./shared";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import type { Song } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
const COL_DURATIONS = [125, 100, 140, 112, 132, 106];

interface HeroMosaicCurtainProps {
  songs: Song[];
  wallSongs: GallerySong[];
  featured: FeaturedEntry[];
  stats: ArchiveStats;
  onJumpToSearch: () => void;
  onToneChange: (tone: CoverTone) => void;
  onOpenSong: (songId: number) => void;
  onRandomSong: () => void;
}

/**
 * 构想二：「幕启流光 · 群像声廊」（Ambient Mosaic Curtain）
 *
 * 宽屏：全宽六列缓慢错落流动的真实封面织锦，借柔和径向柔光托出居中的总集刊头、
 * 轮换经典词句（轮到哪首，背景里对应的封面悄然亮彩并同步整页光晕）与直达检索栏。
 * 手机：顶部两道丝滑横向对流封面带 + 干净大气的居中刊头与检索栏，绝不撞脸详情页。
 */
export default function HeroMosaicCurtain({
  songs,
  wallSongs,
  featured,
  stats,
  onJumpToSearch,
  onToneChange,
  onOpenSong,
  onRandomSong,
}: HeroMosaicCurtainProps) {
  const quoteList = useMemo(
    () => (featured.some((f) => f.excerpt) ? featured.filter((f) => f.excerpt) : featured),
    [featured],
  );
  const [quoteIdx, setQuoteIdx] = useState(0);
  const toneCacheRef = useRef<Map<number, CoverTone>>(new Map());

  const safeIdx = quoteList.length > 0 ? quoteIdx % quoteList.length : 0;
  const activeEntry = quoteList[safeIdx] ?? null;

  useEffect(() => {
    if (quoteList.length < 2) return;
    const id = window.setInterval(
      () => setQuoteIdx((i) => (i + 1) % quoteList.length),
      7000,
    );
    return () => window.clearInterval(id);
  }, [quoteList.length]);

  useEffect(() => {
    if (!activeEntry) return;
    const cached = toneCacheRef.current.get(activeEntry.song.id);
    if (cached) onToneChange(cached);
  }, [activeEntry, onToneChange]);

  const handleThumbLoad = useCallback(
    (songId: number, img: HTMLImageElement) => {
      if (!toneCacheRef.current.has(songId)) {
        toneCacheRef.current.set(songId, toneFromImage(img) ?? INK_TONE);
      }
      if (activeEntry && activeEntry.song.id === songId) {
        onToneChange(toneCacheRef.current.get(songId) ?? INK_TONE);
      }
    },
    [activeEntry, onToneChange],
  );

  // 保证封面织锦池至少有 24 张真实封面
  const mosaicIds = useMemo(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const f of featured) {
      if (!seen.has(f.song.id)) {
        seen.add(f.song.id);
        ids.push(f.song.id);
      }
    }
    for (const g of wallSongs) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        ids.push(g.id);
      }
    }
    for (const s of songs) {
      if (ids.length >= 30) break;
      if (s.hascover && !s.dispute_note && !seen.has(s.id)) {
        seen.add(s.id);
        ids.push(s.id);
      }
    }
    return ids;
  }, [featured, wallSongs, songs]);

  const desktopCols = useMemo(
    () =>
      Array.from({ length: 6 }, (_, c) =>
        mosaicIds.filter((_, i) => i % 6 === c),
      ),
    [mosaicIds],
  );
  const mobileRows = useMemo(
    () => [
      mosaicIds.filter((_, i) => i % 2 === 0).slice(0, 12),
      mosaicIds.filter((_, i) => i % 2 === 1).slice(0, 12),
    ],
    [mosaicIds],
  );

  return (
    <header className="relative -mx-6 mb-6 overflow-hidden px-6 pb-12 pt-4 sm:pb-16 md:mb-10 md:py-16">
      {/* ── 桌面端：全宽六列慢速流动封面织锦（中央柔光留白，四周浮光掠影） ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
      >
        <div className="absolute -inset-y-20 inset-x-0 grid grid-cols-6 gap-4 px-4 opacity-90 lg:gap-5">
          {desktopCols.map((col, c) => (
            <div
              key={c}
              className="flex flex-col gap-4 lg:gap-5 motion-reduce:animate-none!"
              style={{
                animation: `${c % 2 === 0 ? "cover-drift-up" : "cover-drift-down"} ${COL_DURATIONS[c]}s linear infinite`,
              }}
            >
              {[...col, ...col].map((id, i) => {
                const isLit = activeEntry?.song.id === id;
                return (
                  <div
                    key={`${id}-${i}`}
                    className={cn(
                      "aspect-square shrink-0 overflow-hidden rounded-md bg-slate-200 ring-1 ring-slate-900/5 transition-all duration-1000 dark:bg-slate-800 dark:ring-white/10",
                      isLit
                        ? "opacity-95 grayscale-0 scale-[1.03] ring-(--tone)/50 shadow-lg"
                        : "opacity-35 grayscale-[55%] dark:opacity-28",
                    )}
                  >
                    <Image
                      src={getCoverUrl({ id, hascover: true })}
                      alt=""
                      width={200}
                      height={200}
                      sizes="15vw"
                      onLoad={
                        i < col.length
                          ? (e) => handleThumbLoad(id, e.currentTarget)
                          : undefined
                      }
                      className="h-full w-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 中央柔和光幕 + 四周渐隐到页面底色，文字绝对清晰且无硬边框 */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_56%_76%_at_50%_50%,#FAFAFA_36%,rgba(250,250,250,0.82)_65%,rgba(250,250,250,0.32)_100%)] dark:bg-[radial-gradient(ellipse_56%_76%_at_50%_50%,#0B0F19_38%,rgba(11,15,25,0.84)_68%,rgba(11,15,25,0.38)_100%)]"
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-[#FAFAFA] to-transparent dark:from-[#0B0F19]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[#FAFAFA] to-transparent dark:from-[#0B0F19]" />
      </div>

      {/* ── 移动端：顶部两道横向轻流封面带（省高度、高密度群像感） ── */}
      <div
        aria-hidden
        className="relative -mx-6 mb-7 space-y-2.5 overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] md:hidden"
      >
        {mobileRows.map((row, r) => (
          <div
            key={r}
            className="flex w-max gap-2.5 motion-reduce:animate-none!"
            style={{
              animation: `${r === 0 ? "imagery-marquee-ltr" : "imagery-marquee-rtl"} ${r === 0 ? 75 : 92}s linear infinite`,
            }}
          >
            {[...row, ...row].map((id, i) => {
              const isLit = activeEntry?.song.id === id;
              return (
                <div
                  key={`${id}-${i}`}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-slate-200 ring-1 ring-slate-900/5 transition-all duration-1000 dark:bg-slate-800 dark:ring-white/10",
                    isLit
                      ? "opacity-100 grayscale-0 ring-(--tone)"
                      : "opacity-65 grayscale-[40%] dark:opacity-45",
                  )}
                >
                  <Image
                    src={getCoverUrl({ id, hascover: true })}
                    alt=""
                    width={120}
                    height={120}
                    sizes="64px"
                    onLoad={
                      i < row.length
                        ? (e) => handleThumbLoad(id, e.currentTarget)
                        : undefined
                    }
                    className="h-full w-full object-cover"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── 前景居中：总集刊头 + 轮换词句 + 优雅首屏直达检索栏 ── */}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="flex items-center gap-3 text-[11px] tracking-[0.35em] text-(--tone) sm:text-xs">
          <span>河图作品勘鉴</span>
          {stats.oldestYear && stats.newestYear && (
            <>
              <span aria-hidden className="h-px w-5 bg-(--tone)/50" />
              <span className="font-mono tabular-nums tracking-[0.2em]">
                {stats.oldestYear} — {stats.newestYear}
              </span>
            </>
          )}
        </p>

        <h1 className="mt-4 flex items-baseline justify-center gap-3 font-serif text-5xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50 sm:mt-5 sm:text-6xl md:text-7xl">
          <span>谣歌</span>
          <span className="text-[0.36em] font-normal tracking-[0.2em] text-slate-400 dark:text-slate-500">
            <strong className="mr-1 font-serif text-[1.4em] font-semibold tabular-nums text-(--tone)">
              {stats.catalogCount}
            </strong>
            曲
          </span>
        </h1>

        {/* 轮换词句摘录：点歌名即可入卷，并点亮背景中对应封面 */}
        <div className="mt-6 min-h-14 sm:mt-7 sm:min-h-16">
          <AnimatePresence mode="wait">
            {activeEntry && (
              <motion.figure
                key={activeEntry.song.id}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.65, ease: EASE }}
              >
                <blockquote className="font-calligraphy text-xl tracking-[0.14em] text-slate-800 dark:text-slate-100 sm:text-2xl">
                  {activeEntry.excerpt || "你一定想知道，戏里讲了什么故事……"}
                </blockquote>
                <figcaption className="mt-2 flex items-center justify-center gap-2 text-xs tracking-[0.25em] text-(--tone)">
                  <span aria-hidden className="h-px w-4 bg-(--tone)/50" />
                  <button
                    type="button"
                    onClick={() => onOpenSong(activeEntry.song.id)}
                    className="group inline-flex items-center gap-0.5 font-serif transition-opacity hover:opacity-75"
                  >
                    <span>《{activeEntry.song.title}》</span>
                    <ArrowUpRight
                      size={12}
                      className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </button>
                </figcaption>
              </motion.figure>
            )}
          </AnimatePresence>
        </div>

        {/* 贴合全站设计语言的通透细线搜索入口：点击同步聚焦吸顶真实搜索框，避免中文输入法中断 */}
        <div className="mt-7 w-full max-w-lg sm:mt-8">
          <div className="flex items-center gap-3 border-b border-slate-300/90 bg-[#FAFAFA]/75 px-3 py-3 backdrop-blur-md transition-colors hover:border-(--tone)/70 dark:border-slate-700/90 dark:bg-[#0B0F19]/75 dark:hover:border-(--tone)/70">
            <button
              type="button"
              onClick={onJumpToSearch}
              className="group flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none"
            >
              <Search
                size={16}
                className="shrink-0 text-slate-400 transition-colors group-hover:text-(--tone)"
              />
              <span className="truncate font-kaiti text-sm text-slate-400 transition-colors group-hover:text-slate-600 sm:text-[15px] dark:text-slate-500 dark:group-hover:text-slate-300">
                搜一首歌名、词曲作者，或记得的一句歌词...
              </span>
            </button>
            <span
              aria-hidden
              className="h-3.5 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={onRandomSong}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs tracking-[0.2em] text-slate-500 transition-colors hover:text-(--tone) dark:text-slate-400 dark:hover:text-(--tone)"
            >
              <Shuffle size={12} />
              随缘一曲
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
