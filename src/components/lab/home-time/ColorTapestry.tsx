"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { creditSummary, stripeColor } from "./timeline";

interface ColorTapestryProps {
  /** 已按由近及远排好序的全部在册歌曲 */
  songs: Song[];
  /** 当前筛选/搜索命中的歌曲 ID 集合；未筛选时为 null */
  matched: ReadonlySet<number> | null;
  /** 点击某张碟片或年份标尺时，跳到下方对应年份章节 */
  onJumpToYear: (year: number | null) => void;
  /** 点击预览曲名时，直接打开该曲详情 */
  onOpenSong?: (id: number) => void;
  /** 抽起碟片时，把封面主色轻染到页面顶部光晕 */
  onSpotlightColor?: (color: string | null) => void;
}

/**
 * 「实体唱片架」：
 * 一排立在架上的实体唱片封套（按由近及远排列，年份之间插有极简隔片）。
 * - 常态：每张碟以 3D 透视斜立叠排，露出真实封面的一截斜切面、封脊高光与投向后碟的柔和阴影；
 * - 滑过：经过哪一张，那张碟便向上抽出半寸并转正面向你，左右邻碟如真书架般轻微受触起伏；
 * - 筛选：架上瞬间只留命中的那几张碟，排成短短一排随手翻阅。
 */
export default function ColorTapestry({
  songs,
  matched,
  onJumpToYear,
  onOpenSong,
  onSpotlightColor,
}: ColorTapestryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 鼠标拖拽横向翻架（与滑过抽碟互不干扰）
  const dragRef = useRef<{
    down: boolean;
    startX: number;
    startScroll: number;
    dragged: boolean;
  }>({ down: false, startX: 0, startScroll: 0, dragged: false });

  // 有筛选时只留命中的碟在架上，真正像从大架上挑出一小叠来翻
  const visibleSongs = useMemo(
    () => (matched ? songs.filter((s) => matched.has(s.id)) : songs),
    [songs, matched],
  );

  // 记录每一年的起始下标，用于插入极简年份隔片与底部快速跳转
  const yearAnchors = useMemo(() => {
    const anchors: Array<{ year: number | null; index: number }> = [];
    let prev: number | null | undefined = undefined;
    visibleSongs.forEach((s, i) => {
      const y = s.year ?? null;
      if (y !== prev) {
        anchors.push({ year: y, index: i });
        prev = y;
      }
    });
    return anchors;
  }, [visibleSongs]);

  const yearStartMap = useMemo(() => {
    const map = new Map<number, number | null>();
    yearAnchors.forEach((a) => map.set(a.index, a.year));
    return map;
  }, [yearAnchors]);

  const safeActive =
    activeIndex !== null && activeIndex < visibleSongs.length
      ? activeIndex
      : null;
  const activeSong = safeActive !== null ? visibleSongs[safeActive] : null;
  const activeColor = activeSong ? stripeColor(activeSong) : null;

  const activate = useCallback(
    (idx: number | null) => {
      setActiveIndex(idx);
      if (idx !== null && visibleSongs[idx]) {
        onSpotlightColor?.(stripeColor(visibleSongs[idx]));
      } else {
        onSpotlightColor?.(null);
      }
    },
    [visibleSongs, onSpotlightColor],
  );

  const scrollRack = useCallback((dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
  }, []);

  const scrollRackToYear = useCallback(
    (year: number | null) => {
      const anchor = yearAnchors.find((a) => a.year === year);
      const container = scrollerRef.current;
      if (anchor && container) {
        const target = container.querySelector<HTMLElement>(
          `[data-disc-idx="${anchor.index}"]`,
        );
        if (target) {
          container.scrollTo({
            left: Math.max(0, target.offsetLeft - 32),
            behavior: "smooth",
          });
        }
      }
      onJumpToYear(year);
    },
    [yearAnchors, onJumpToYear],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || e.button !== 0) return;
    dragRef.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      dragged: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!dragRef.current.down || !el) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 6) dragRef.current.dragged = true;
    el.scrollLeft = dragRef.current.startScroll - dx * 1.4;
  };

  const handleMouseUp = () => {
    dragRef.current.down = false;
    window.setTimeout(() => {
      dragRef.current.dragged = false;
    }, 60);
  };

  if (visibleSongs.length === 0) return null;

  return (
    <section aria-label="唱片架" className="relative select-none">
      {/* 顶行：常态安静，抽起碟片时浮现曲名、日期与词曲；右侧可左右推架 */}
      <div className="mb-1 flex min-h-11 items-center justify-between gap-4">
        {activeSong ? (
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onOpenSong
                  ? onOpenSong(activeSong.id)
                  : onJumpToYear(activeSong.year ?? null)
              }
              className="group min-w-0 text-left"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="truncate font-serif text-[15px] text-slate-900 transition-colors group-hover:text-(--tone) sm:text-base dark:text-slate-100">
                  《{activeSong.title}》
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-(--tone)">
                  {activeSong.date?.replaceAll("-", ".") ||
                    activeSong.year ||
                    "未详"}
                </span>
              </div>
              <p className="truncate font-kaiti text-xs text-slate-500 dark:text-slate-400">
                {creditSummary(activeSong) || "点此入卷"}
              </p>
            </button>
          </div>
        ) : (
          <span className="text-[11px] tracking-[0.3em] text-(--tone)">
            架上唱片
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => scrollRack(-1)}
            aria-label="向左推架"
            className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollRack(1)}
            aria-label="向右推架"
            className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── 实体唱片架横向轨道 ── */}
      <div className="relative -mx-6">
        <div
          ref={scrollerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            activate(null);
          }}
          className="no-scrollbar relative flex cursor-grab items-end overflow-x-auto px-6 pt-11 pb-6 active:cursor-grabbing mask-[linear-gradient(to_right,transparent,black_24px,black_calc(100%-36px),transparent)]"
        >
          {/* 唱片排：每个插槽保持固定横向占位，确保滑过时绝对顺滑不抖动 */}
          <div
            className="relative flex items-end pr-28 sm:pr-32"
            style={{ perspective: "1100px" }}
          >
            {visibleSongs.map((song, idx) => {
              const dist = safeActive !== null ? Math.abs(idx - safeActive) : 99;
              const isAct = dist === 0;
              const yearLabel = yearStartMap.get(idx);
              const bg = stripeColor(song);

              // 物理抽碟姿态：焦点碟抽出并转正面向你，左右邻碟如书架受触般微微起伏让角
              const rotateY = isAct
                ? 0
                : dist === 1
                  ? -34
                  : dist === 2
                    ? -48
                    : -58;
              const translateY = isAct
                ? -24
                : dist === 1
                  ? -9
                  : dist === 2
                    ? -4
                    : 0;
              const scale = isAct ? 1.06 : 1;

              return (
                <div
                  key={song.id}
                  data-disc-idx={idx}
                  onMouseEnter={() => {
                    if (!dragRef.current.down) activate(idx);
                  }}
                  onClick={() => {
                    if (dragRef.current.dragged) return;
                    // 手机端第一次轻点抽起该碟预览，再点或桌面单击直接入卷/跳章
                    if (safeActive !== idx && window.matchMedia("(hover: none)").matches) {
                      activate(idx);
                      return;
                    }
                    if (onOpenSong) onOpenSong(song.id);
                    else onJumpToYear(song.year ?? null);
                  }}
                  className={cn(
                    "relative h-25 w-5.5 shrink-0 cursor-pointer sm:h-29.5 sm:w-6.5",
                    yearLabel !== undefined && idx > 0 && "ml-5 sm:ml-6",
                  )}
                  style={{
                    zIndex: isAct ? 50 : dist === 1 ? 30 : dist === 2 ? 20 : 10,
                  }}
                >
                  {/* 年份隔片：插在每一年第一张碟前的极简年代标签，像唱片店木/纸隔板 */}
                  {yearLabel !== undefined && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-7 left-0 flex items-center gap-1 font-mono text-[10px] tabular-nums tracking-wider text-slate-400/90 dark:text-slate-500"
                    >
                      <span className="inline-block h-2.5 w-px bg-slate-300 dark:bg-slate-700" />
                      {yearLabel ?? "未详"}
                    </span>
                  )}

                  {/* 实体唱片封套本体（绕左脊旋转，露出真实封面与立体厚度阴影） */}
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 h-25 w-25 sm:h-29.5 sm:w-29.5"
                    style={{
                      transformOrigin: "left center",
                      transform: `translateY(${translateY}px) rotateY(${rotateY}deg) scale(${scale})`,
                      transition:
                        "transform 380ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 380ms ease, filter 380ms ease",
                    }}
                  >
                    {/* 抽起时碟后微探一弧黑胶边，强化“唱片”实感 */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-[-9%] inset-x-[9%] aspect-square rounded-full transition-all duration-400",
                        isAct ? "opacity-90 -translate-y-1" : "opacity-0",
                      )}
                      style={{
                        background:
                          "repeating-radial-gradient(circle at center, #181c26 0px, #181c26 2px, #0d1017 3px, #151923 4.5px)",
                      }}
                    />

                    {/* 封面封套主体 */}
                    <div
                      className={cn(
                        "relative h-full w-full overflow-hidden rounded-[3px] ring-1 transition-shadow duration-300",
                        isAct
                          ? "shadow-[0_24px_42px_-12px_rgba(15,23,42,0.55)] ring-slate-900/15 dark:shadow-[0_26px_48px_-10px_rgba(0,0,0,0.92)] dark:ring-white/25"
                          : "shadow-[-6px_6px_14px_-4px_rgba(15,23,42,0.28)] ring-slate-900/10 dark:shadow-[-8px_8px_18px_-4px_rgba(0,0,0,0.75)] dark:ring-white/12",
                      )}
                      style={{
                        backgroundColor: bg ?? undefined,
                      }}
                    >
                      {song.hascover ? (
                        <Image
                          src={getCoverUrl(song)}
                          alt={song.title}
                          width={160}
                          height={160}
                          sizes="118px"
                          loading={idx < 32 ? "eager" : "lazy"}
                          className={cn(
                            "h-full w-full object-cover transition-[filter] duration-300",
                            isAct
                              ? "brightness-100 saturate-100"
                              : "brightness-95 saturate-[0.88] dark:brightness-90",
                          )}
                        />
                      ) : (
                        /* 无封面的早期作品：实体牛皮/素纸封套 + 竖排曲题 */
                        <div className="flex h-full w-full items-start justify-start bg-[#ECEAE4] p-2.5 dark:bg-[#151B28]">
                          <span className="line-clamp-4 font-serif text-[11px] leading-tight tracking-[0.22em] text-slate-600 [writing-mode:vertical-rl] dark:text-slate-300">
                            {song.title}
                          </span>
                        </div>
                      )}

                      {/* 封脊左缘极细纸边高光，模拟真实实体封套厚度 */}
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-0.5 bg-white/45 dark:bg-white/25"
                      />
                      {/* 未抽起时封套表面的微弱斜向阴影，拉开前后层叠景深 */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-0 bg-linear-to-r from-transparent via-black/6 to-black/30 transition-opacity duration-300",
                          isAct ? "opacity-0" : "opacity-100",
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 实体架面承托细线与微投影 */}
        <div
          aria-hidden
          className="pointer-events-none mx-6 -mt-3 h-px bg-linear-to-r from-transparent via-slate-300/85 to-transparent dark:via-slate-700/80"
        />
        {activeColor && (
          <div
            aria-hidden
            className="pointer-events-none mx-auto -mt-px h-3 w-2/3 opacity-35 blur-lg transition-colors duration-500"
            style={{ background: activeColor }}
          />
        )}
      </div>

      {/* 架下年份快跳条：一键把唱片架与下方编年目录同步滑到那一年 */}
      {yearAnchors.length > 1 && (
        <div className="no-scrollbar mt-3 flex items-center gap-3.5 overflow-x-auto pb-0.5 text-[10px] font-mono tabular-nums tracking-wider text-slate-400 dark:text-slate-500">
          {yearAnchors.map((a) => {
            const isCurrent = activeSong?.year === a.year;
            return (
              <button
                key={String(a.year)}
                type="button"
                onClick={() => scrollRackToYear(a.year)}
                className={cn(
                  "shrink-0 transition-colors hover:text-(--tone)",
                  isCurrent && "text-(--tone)",
                )}
              >
                {a.year ?? "未详"}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
