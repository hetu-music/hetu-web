"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import React, {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  creditSummary,
  localMonthDay,
  pickSeason,
  seasonName,
  stripeColor,
} from "./timeline";

interface ColorTapestryProps {
  /** 全部在册歌曲（顺序不限），从中挑出这个时节的 */
  songs: Song[];
  /** 服务端渲染时的 "MM-DD"（北京时间）；客户端会换成访客本地日期 */
  serverMonthDay: string;
  /** 点击碟片或曲名时打开该曲详情 */
  onOpenSong: (id: number) => void;
  /** 抽起碟片时，把封面主色轻染到页面顶部光晕 */
  onSpotlightColor?: (color: string | null) => void;
}

// 日期在一次访问里不会变，不需要真的订阅
const noopSubscribe = () => () => undefined;

/**
 * 「这个时节」唱片架：当期陈列，不是馆藏的另一种视图。
 * 把二十年折叠到今天这个日子上——历年在这几天前后发布的歌立成一小排，每天都不一样；
 * 不跟着下方的检索与筛选变化。
 * - 常态：每张碟以 3D 透视斜立叠排，露出真实封面的一截斜切面、封脊高光与投向后碟的柔和阴影；
 * - 滑过：经过哪一张，那张碟便向上抽出半寸并转正面向你，左右邻碟如真书架般轻微受触起伏。
 */
function ColorTapestry({
  songs,
  serverMonthDay,
  onOpenSong,
  onSpotlightColor,
}: ColorTapestryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 水合时沿用服务端的日子，之后换成访客本地的（跨时区、或缓存页面跨了午夜时才会不同）
  const monthDay = useSyncExternalStore(
    noopSubscribe,
    localMonthDay,
    () => serverMonthDay,
  );

  const season = useMemo(() => pickSeason(songs, monthDay), [songs, monthDay]);
  const shelf = season.songs;
  const yearCount = useMemo(
    () => new Set(shelf.map((s) => s.year)).size,
    [shelf],
  );

  // 鼠标拖拽横向翻架（与滑过抽碟互不干扰）
  const dragRef = useRef<{
    down: boolean;
    startX: number;
    startScroll: number;
    dragged: boolean;
  }>({ down: false, startX: 0, startScroll: 0, dragged: false });

  // 每一年第一张碟前插一块年份隔片
  const yearStarts = useMemo(() => {
    const starts = new Set<number>();
    shelf.forEach((s, i) => {
      if (i === 0 || s.year !== shelf[i - 1].year) starts.add(i);
    });
    return starts;
  }, [shelf]);

  const safeActive =
    activeIndex !== null && activeIndex < shelf.length ? activeIndex : null;
  const activeSong = safeActive !== null ? shelf[safeActive] : null;

  // 点击时要知道焦点碟，但不想让 handlePick 随焦点变化而失去稳定（那样所有碟都会重渲）
  const activeRef = useRef(safeActive);
  useLayoutEffect(() => {
    activeRef.current = safeActive;
  }, [safeActive]);

  const activate = useCallback(
    (idx: number | null) => {
      setActiveIndex(idx);
      onSpotlightColor?.(
        idx !== null && shelf[idx] ? stripeColor(shelf[idx]) : null,
      );
    },
    [shelf, onSpotlightColor],
  );

  const handleHover = useCallback(
    (idx: number) => {
      if (!dragRef.current.down) activate(idx);
    },
    [activate],
  );

  const handlePick = useCallback(
    (idx: number) => {
      if (dragRef.current.dragged) return;
      const song = shelf[idx];
      if (!song) return;
      // 手机端第一次轻点抽起该碟预览，再点才进详情
      if (
        activeRef.current !== idx &&
        window.matchMedia("(hover: none)").matches
      ) {
        activate(idx);
        return;
      }
      onOpenSong(song.id);
    },
    [shelf, activate, onOpenSong],
  );

  const scrollRack = useCallback((dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
  }, []);

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

  if (shelf.length === 0) return null;

  return (
    <section aria-label="这个时节" className="relative select-none">
      {/* 顶行：常态是展签，抽起碟片时换成曲名、日期与词曲；两种状态等高，不推动下方 */}
      <div className="mb-1 flex min-h-11 items-center justify-between gap-4">
        {activeSong ? (
          <button
            type="button"
            onClick={() => onOpenSong(activeSong.id)}
            className="group min-w-0 text-left"
          >
            <div className="flex items-baseline gap-2.5">
              <span className="truncate font-serif text-[15px] text-slate-900 transition-colors group-hover:text-(--tone) sm:text-base dark:text-slate-100">
                《{activeSong.title}》
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-(--tone)">
                {activeSong.date?.replaceAll("-", ".")}
              </span>
            </div>
            <p className="truncate font-kaiti text-xs text-slate-500 dark:text-slate-400">
              {creditSummary(activeSong) || "点此入卷"}
            </p>
          </button>
        ) : (
          <div className="min-w-0">
            <p className="text-[11px] leading-6 tracking-[0.3em] text-(--tone)">
              这个时节
            </p>
            <p className="truncate font-kaiti text-xs text-slate-500 dark:text-slate-400">
              {seasonName(monthDay, season.days)} · {yearCount} 个年份里的
              {season.days > 15 ? "这些日子" : "这几天"}
            </p>
          </div>
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

      {/* ── 唱片架横向轨道 ── */}
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
          className="no-scrollbar relative flex cursor-grab items-end overflow-x-auto px-6 pt-13 pb-6 active:cursor-grabbing mask-[linear-gradient(to_right,transparent,black_24px,black_calc(100%-36px),transparent)]"
        >
          {/* 唱片排：每个插槽保持固定横向占位，滑过时不抖动 */}
          <div
            className="relative flex items-end pr-32 sm:pr-40"
            style={{ perspective: "1100px" }}
          >
            {shelf.map((song, idx) => (
              <Disc
                key={song.id}
                song={song}
                idx={idx}
                dist={
                  safeActive === null
                    ? 3
                    : Math.min(Math.abs(idx - safeActive), 3)
                }
                yearLabel={yearStarts.has(idx) ? song.year : undefined}
                onHover={handleHover}
                onPick={handlePick}
              />
            ))}
          </div>
        </div>

        {/* 架面承托细线 */}
        <div
          aria-hidden
          className="pointer-events-none mx-6 -mt-3 h-px bg-linear-to-r from-transparent via-slate-300/85 to-transparent dark:via-slate-700/80"
        />
      </div>
    </section>
  );
}

export default memo(ColorTapestry);

/**
 * 一张碟。dist 是到焦点碟的距离，3 代表「3 及更远」（姿态都一样），
 * 这样滑过时只有姿态真正改变的几张碟会重渲。
 */
const Disc = memo(function Disc({
  song,
  idx,
  dist,
  yearLabel,
  onHover,
  onPick,
}: {
  song: Song;
  idx: number;
  dist: number;
  /** 这一年的第一张碟才有 */
  yearLabel: number | null | undefined;
  onHover: (idx: number) => void;
  onPick: (idx: number) => void;
}) {
  const isAct = dist === 0;
  const bg = stripeColor(song);

  // 物理抽碟姿态：焦点碟抽出并转正面向你，左右邻碟如书架受触般微微起伏让角
  const rotateY = isAct ? 0 : dist === 1 ? -34 : dist === 2 ? -48 : -58;
  const translateY = isAct ? -24 : dist === 1 ? -9 : dist === 2 ? -4 : 0;
  const scale = isAct ? 1.06 : 1;

  return (
    <div
      onMouseEnter={() => onHover(idx)}
      onClick={() => onPick(idx)}
      className={cn(
        "relative h-30 w-7 shrink-0 cursor-pointer sm:h-38 sm:w-9",
        yearLabel !== undefined && idx > 0 && "ml-6 sm:ml-8",
      )}
      style={{
        zIndex: isAct ? 50 : dist === 1 ? 30 : dist === 2 ? 20 : 10,
      }}
    >
      {/* 年份隔片：插在每一年第一张碟前的极简年代标签，像唱片店的隔板 */}
      {yearLabel !== undefined && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 left-0 flex items-center gap-1 font-mono text-[10px] tabular-nums tracking-wider text-slate-400/90 dark:text-slate-500"
        >
          <span className="inline-block h-2.5 w-px bg-slate-300 dark:bg-slate-700" />
          {yearLabel}
        </span>
      )}

      {/* 唱片封套本体（绕左脊旋转，露出真实封面与立体厚度阴影） */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-30 w-30 sm:h-38 sm:w-38"
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
          style={{ backgroundColor: bg }}
        >
          <Image
            src={getCoverUrl(song)}
            alt={song.title}
            width={200}
            height={200}
            sizes="152px"
            className={cn(
              "h-full w-full object-cover transition-[filter] duration-300",
              isAct
                ? "brightness-100 saturate-100"
                : "brightness-95 saturate-[0.88] dark:brightness-90",
            )}
          />

          {/* 封脊左缘极细纸边高光，模拟真实封套厚度 */}
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
});
