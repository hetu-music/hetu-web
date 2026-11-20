"use client";

import PlayButton from "@/components/shared/PlayButton";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ArchiveStats, FeaturedEntry } from "./shared";

const EASE = [0.23, 1, 0.32, 1] as const;

interface HeroCoverFlowProps {
  featured: FeaturedEntry[];
  stats: ArchiveStats;
  onToneChange: (tone: CoverTone) => void;
  onOpenSong: (songId: number) => void;
  onRandomSong: () => void;
}

/** 循环距离：保证 7–9 张唱片在左右两侧无缝环绕 */
function circularOffset(index: number, active: number, total: number): number {
  let diff = index - active;
  const half = Math.floor(total / 2);
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;
  return diff;
}

/**
 * 构想一：「立体光影唱片台」（3D 景深叠层翻碟舞台）
 *
 * 重点解决两个问题：
 * 1. 主角是「群像唱片」而不是单首歌详情，移动端绝不会误以为进了详情页；
 * 2. 3D 景深扇面 + 实时封面光色晕染 + 触控滑屏翻碟，在桌面与手机上都有第一眼惊艳感。
 */
export default function HeroCoverFlow({
  featured,
  stats,
  onToneChange,
  onOpenSong,
  onRandomSong,
}: HeroCoverFlowProps) {
  const total = featured.length;
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const toneCacheRef = useRef<Map<number, CoverTone>>(new Map());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const safeActive = total > 0 ? ((activeIdx % total) + total) % total : 0;
  const current = featured[safeActive] ?? null;

  const step = useCallback(
    (delta: number) => {
      if (total < 2) return;
      setActiveIdx((i) => (i + delta + total) % total);
    },
    [total],
  );

  // 自动慢速轮换，用户交互/悬停时暂停
  useEffect(() => {
    if (total < 2 || paused) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % total);
    }, 6500);
    return () => window.clearInterval(id);
  }, [total, paused]);

  // 切换焦点唱片时，如果缓存里已经提取过该封面的色相，立刻同步整页氛围光
  useEffect(() => {
    if (!current) return;
    const cached = toneCacheRef.current.get(current.song.id);
    if (cached) onToneChange(cached);
  }, [current, onToneChange]);

  const handleCoverLoad = useCallback(
    (songId: number, img: HTMLImageElement) => {
      let cached = toneCacheRef.current.get(songId);
      if (!cached) {
        cached = toneFromImage(img) ?? INK_TONE;
        toneCacheRef.current.set(songId, cached);
      }
      if (current && current.song.id === songId) {
        onToneChange(cached);
      }
    },
    [current, onToneChange],
  );

  // 手机与桌面拖拽翻碟：横向滑动超过 36px 切换唱片，不阻断纵向页面滚动
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
    setPaused(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  return (
    <header
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative pb-10 pt-2 md:pb-14 md:pt-4"
    >
      {/* ── 1. 顶部站点刊头：一眼确立“河图音乐总集”身份，与单曲详情页彻底区隔 ── */}
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="flex items-center gap-2.5 text-[11px] tracking-[0.35em] text-(--tone) sm:text-xs">
          <span>河图作品勘鉴</span>
          {stats.oldestYear && stats.newestYear && (
            <>
              <span aria-hidden className="h-px w-4 bg-(--tone)/45" />
              <span className="font-mono tabular-nums tracking-[0.2em]">
                {stats.oldestYear} — {stats.newestYear}
              </span>
            </>
          )}
        </p>

        <div className="mt-3 flex items-baseline justify-center gap-3 sm:mt-4 sm:gap-4">
          <h1 className="font-serif text-4xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl md:text-[3.5rem]">
            谣歌
          </h1>
          <span className="font-serif text-sm tracking-[0.2em] text-slate-400 dark:text-slate-500 sm:text-base">
            凡{" "}
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
              {stats.catalogCount}
            </span>{" "}
            曲
          </span>
        </div>
      </div>

      {/* ── 2. 3D 景深立体翻碟舞台：5–7 张真实唱片呈空间扇面铺开 ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        className="relative mx-auto mt-7 flex h-[228px] w-full max-w-5xl touch-pan-y select-none items-center justify-center sm:mt-9 sm:h-[296px] md:h-[340px]"
        style={{ perspective: "1350px" }}
      >
        {/* 舞台中央柔和地面光晕：衬托前景唱片的悬浮立体感 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[18%] bottom-2 h-16 rounded-full opacity-55 blur-3xl transition-colors duration-1000 dark:opacity-75"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--tone), transparent 72%)",
          }}
        />

        {/* 左右切换按钮（宽屏显示，手机直接指尖滑屏或点侧边封面） */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="上一张唱片"
              className="absolute left-0 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-[#FAFAFA]/80 text-slate-500 backdrop-blur-md transition-all hover:border-(--tone)/50 hover:text-(--tone) md:flex dark:border-slate-800 dark:bg-[#0B0F19]/75 dark:text-slate-400"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="下一张唱片"
              className="absolute right-0 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-[#FAFAFA]/80 text-slate-500 backdrop-blur-md transition-all hover:border-(--tone)/50 hover:text-(--tone) md:flex dark:border-slate-800 dark:bg-[#0B0F19]/75 dark:text-slate-400"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* 唱片扇面卡片组 */}
        <div
          className="relative h-[188px] w-[188px] sm:h-[248px] sm:w-[248px] md:h-[282px] md:w-[282px]"
          style={{ transformStyle: "preserve-3d" }}
        >
          {featured.map((entry, idx) => {
            const offset = circularOffset(idx, safeActive, total);
            const abs = Math.abs(offset);
            if (abs > 3) return null;

            const isCenter = offset === 0;
            const sign = offset < 0 ? -1 : 1;

            // 扇面位移、纵深旋转与缩放：近大远小，两侧层叠后退
            const translateXPercent =
              abs === 0
                ? 0
                : abs === 1
                  ? sign * 64
                  : abs === 2
                    ? sign * 116
                    : sign * 158;
            const translateZ =
              abs === 0 ? 0 : abs === 1 ? -95 : abs === 2 ? -190 : -280;
            const rotateY =
              abs === 0 ? 0 : -sign * (abs === 1 ? 26 : abs === 2 ? 36 : 42);
            const scale =
              abs === 0 ? 1 : abs === 1 ? 0.85 : abs === 2 ? 0.7 : 0.56;
            const opacity =
              abs === 0 ? 1 : abs === 1 ? 0.84 : abs === 2 ? 0.45 : 0.14;

            return (
              <div
                key={entry.song.id}
                onClick={() => {
                  if (swipedRef.current) {
                    swipedRef.current = false;
                    return;
                  }
                  if (isCenter) onOpenSong(entry.song.id);
                  else setActiveIdx(idx);
                }}
                role="button"
                tabIndex={abs <= 1 ? 0 : -1}
                aria-label={
                  isCenter
                    ? `进入《${entry.song.title}》详情页`
                    : `切换到《${entry.song.title}》`
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isCenter) onOpenSong(entry.song.id);
                    else setActiveIdx(idx);
                  }
                }}
                className={cn(
                  "group absolute inset-0 cursor-pointer outline-none",
                  abs === 3 && "hidden md:block",
                )}
                style={{
                  zIndex: 30 - abs * 8,
                  opacity,
                  transform: `translateX(${translateXPercent}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  transition:
                    "transform 680ms cubic-bezier(0.23, 1, 0.32, 1), opacity 680ms ease, filter 680ms ease",
                  filter:
                    abs === 0
                      ? "none"
                      : abs === 1
                        ? "saturate(0.75) brightness(0.95)"
                        : "saturate(0.45) brightness(0.88)",
                }}
              >
                {/* 中央焦点唱片背面微探出一弧哑光黑胶边缘，赋予“唱片行”雕塑感 */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -top-[10%] inset-x-[7%] aspect-square rounded-full transition-all duration-700 ease-page",
                    isCenter
                      ? "opacity-90 group-hover:-translate-y-2.5"
                      : "opacity-0",
                  )}
                  style={{
                    background:
                      "repeating-radial-gradient(circle at center, #181c26 0px, #181c26 2px, #0e1118 3px, #151923 4.5px)",
                    boxShadow: "0 16px 36px -12px rgba(0,0,0,0.65)",
                  }}
                >
                  <span
                    className="absolute inset-0 rounded-full opacity-35"
                    style={{
                      background:
                        "conic-gradient(from 15deg, transparent 0deg, rgba(255,255,255,0.3) 26deg, transparent 60deg)",
                    }}
                  />
                </span>

                {/* 唱片封面本体 */}
                <div
                  className={cn(
                    "relative h-full w-full overflow-hidden rounded-md bg-slate-100 ring-1 transition-shadow duration-700 dark:bg-slate-800",
                    isCenter
                      ? "shadow-[0_32px_64px_-18px_rgba(15,23,42,0.45)] ring-slate-900/10 dark:shadow-[0_34px_70px_-16px_rgba(0,0,0,0.9)] dark:ring-white/15"
                      : "shadow-[0_20px_40px_-20px_rgba(15,23,42,0.35)] ring-slate-900/5 dark:shadow-[0_20px_40px_-18px_rgba(0,0,0,0.75)] dark:ring-white/10",
                  )}
                >
                  <Image
                    src={getCoverUrl(entry.song)}
                    alt={entry.song.title}
                    width={460}
                    height={460}
                    sizes="(min-width: 768px) 282px, (min-width: 640px) 248px, 188px"
                    loading="eager"
                    onLoad={(e) =>
                      handleCoverLoad(entry.song.id, e.currentTarget)
                    }
                    className={cn(
                      "h-full w-full object-cover transition-transform duration-700 ease-out",
                      isCenter && "group-hover:scale-[1.03]",
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. 唱片下方轻盈的诗句与出处（绝不堆单曲署名，保持“翻碟浏览”轻盈感） ── */}
      {current && (
        <div className="mx-auto mt-3 flex max-w-xl flex-col items-center text-center sm:mt-4">
          <div className="min-h-14 sm:min-h-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.song.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                {current.excerpt ? (
                  <p className="font-calligraphy text-xl tracking-[0.14em] text-slate-800 dark:text-slate-100 sm:text-2xl">
                    {current.excerpt}
                  </p>
                ) : (
                  <p className="font-kaiti text-base text-slate-600 dark:text-slate-300">
                    你一定想知道，戏里讲了什么故事……
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-xs tracking-[0.22em]">
                  <button
                    type="button"
                    onClick={() => onOpenSong(current.song.id)}
                    className="group inline-flex items-center gap-1 font-serif text-(--tone) transition-opacity hover:opacity-75"
                  >
                    <span>《{current.song.title}》</span>
                    {current.song.year && (
                      <span className="font-mono text-[11px] tabular-nums opacity-75">
                        {current.song.year}
                      </span>
                    )}
                    <ArrowUpRight
                      size={13}
                      className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </button>

                  <PlayButton
                    songId={current.song.id}
                    title={current.song.title}
                    artist={current.song.artist?.join(" / ")}
                    coverUrl={getCoverUrl(current.song)}
                    hasAudio={current.song.has_audio}
                    size={13}
                    className="p-1"
                  />

                  <span
                    aria-hidden
                    className="h-3 w-px bg-slate-200 dark:bg-slate-800"
                  />

                  <button
                    type="button"
                    onClick={onRandomSong}
                    className="inline-flex items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                  >
                    <Shuffle size={12} />
                    随缘一曲
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 细线进度指示点：同时提示可滑动切换 */}
          {total > 1 && (
            <div className="mt-5 flex items-center gap-1.5">
              {featured.map((entry, idx) => {
                const active = idx === safeActive;
                return (
                  <button
                    key={entry.song.id}
                    type="button"
                    aria-label={`查看第 ${idx + 1} 张唱片`}
                    onClick={() => setActiveIdx(idx)}
                    className={cn(
                      "h-1 rounded-full transition-all duration-500",
                      active
                        ? "w-6 bg-(--tone)"
                        : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-500",
                    )}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
