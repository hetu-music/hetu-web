"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import CoverArt from "@/components/library/CoverArt";
import EnqueueButton from "@/components/shared/EnqueueButton";
import Pagination from "@/components/shared/Pagination";
import PlayButton from "@/components/shared/PlayButton";
import PlayingBars from "@/components/shared/PlayingBars";
import SiteMark from "@/components/shared/SiteMark";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import { useFavorites } from "@/context/FavoritesContext";
import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import { Link } from "@/i18n/navigation";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { enumLabel, getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { usePlayerStore } from "@/store/player-store";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  RotateCcw,
  Search,
  Shuffle,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ArchiveStats,
  type FeaturedEntry,
  FLOATING_IMAGERY_WORDS,
  TRIPTYCH_ITEMS,
  groupSongsByYear,
  songCreditLine,
} from "./shared";

const EASE = [0.23, 1, 0.32, 1] as const;

interface RecordSalonHomeProps {
  filteredSongs: Song[];
  pageSongs: Song[];
  featured: FeaturedEntry[];
  recentSongs: Song[];
  stats: ArchiveStats;
  types: string[];
  activeType: string;
  onTypeChange: (type: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isFiltering: boolean;
  onReset: () => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  listStartRef: React.RefObject<HTMLDivElement | null>;
  onOpenSong: (songId: number) => void;
  onRandomSong: () => void;
}

/**
 * 彻底重设计的首页原型：「留声书肆 · 光影唱片行 × 河图作品勘鉴」
 *
 * 1. 保留光影唱片行的视听氛围与唱片实体感，但彻底对齐全站设计语言：
 *    统一底色 #FAFAFA / #0B0F19、封面实时取色光晕 wash、衬线/楷体/刻本/等宽字阶、
 *    细线与留白分层，不用圆角白卡片、彩色图标盒与英文标签。
 * 2. 彻底取消网格/列表双视图切换，采用单一、标志性的「编年唱片陈列架」：
 *    左栏吸顶大号年份标尺 + 右栏无框宽幅唱片图版（呼应详情页的两栏书卷版式）。
 */
export default function RecordSalonHome({
  filteredSongs,
  pageSongs,
  featured,
  recentSongs,
  stats,
  types,
  activeType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  isFiltering,
  onReset,
  page,
  totalPages,
  onPageChange,
  listStartRef,
  onOpenSong,
  onRandomSong,
}: RecordSalonHomeProps) {
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tSong = useTranslations("song");
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { currentTrack, isPlaying } = usePlayerStore();

  const [spotIdx, setSpotIdx] = useState(0);
  const [tone, setTone] = useState<CoverTone | null>(null);
  const [heroPaused, setHeroPaused] = useState(false);

  const safeIdx = featured.length > 0 ? spotIdx % featured.length : 0;
  const spotlight = featured[safeIdx] ?? null;
  const appliedTone = tone ?? INK_TONE;

  // 进入搜索、筛选或翻至第 2 页以后，首屏与展陈自然收起，聚焦曲库检索
  const showEditorialTop = !isFiltering && page === 1;

  // 唱片展台慢速轮换，鼠标移入即停
  useEffect(() => {
    if (featured.length < 2 || heroPaused || !showEditorialTop) return;
    const id = window.setInterval(() => {
      setSpotIdx((i) => (i + 1) % featured.length);
    }, 9000);
    return () => window.clearInterval(id);
  }, [featured.length, heroPaused, showEditorialTop]);

  const handleCoverLoad = useCallback((img: HTMLImageElement) => {
    setTone(toneFromImage(img) ?? INK_TONE);
  }, []);

  const yearGroups = useMemo(() => groupSongsByYear(pageSongs), [pageSongs]);

  const {
    containerRef: shelfRef,
    hasDraggedRef: shelfDraggedRef,
    dragHandlers: shelfDragHandlers,
  } = useMouseDragScroll<HTMLDivElement>();

  const scrollShelf = useCallback(
    (dir: -1 | 1) => {
      const el = shelfRef.current;
      if (!el) return;
      el.scrollBy({ left: dir * 560, behavior: "smooth" });
    },
    [shelfRef],
  );

  const spotExcerptCols =
    spotlight?.excerpt?.split(/\s+/).filter(Boolean).slice(0, 3) ?? [];

  const spotIsPlaying =
    !!spotlight && currentTrack?.songId === spotlight.song.id && isPlaying;

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] transition-colors duration-500 [--tone:var(--tone-light)] dark:bg-[#0B0F19] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": appliedTone.light,
          "--tone-dark": appliedTone.dark,
        } as React.CSSProperties
      }
    >
      {/* ── 整页顶部的动态唱片光晕：随当前留声封面色相缓缓流转 ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[64rem] transition-opacity duration-1400 ease-out"
        style={{
          opacity: tone ? 1 : 0.45,
          background: `radial-gradient(ellipse 68% 48% at 24% 8%, ${appliedTone.wash}, transparent 70%), radial-gradient(ellipse 56% 42% at 86% 18%, ${appliedTone.wash}, transparent 72%)`,
        }}
      />

      <main className="relative mx-auto max-w-7xl px-6 pb-28 pt-28 md:pt-36">
        {/* ═══════════════════════════════════════════════════════════════════
            第一幕：留声幕启（无框唱片光影展台 + 底部选碟胶片条）
           ═══════════════════════════════════════════════════════════════════ */}
        {showEditorialTop ? (
          <header
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
            className="pb-16 md:pb-24"
          >
            {/* 顶行刊眉：极简书卷气 */}
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/75 pb-4 dark:border-slate-800/75">
              <div className="flex items-center gap-3 text-xs tracking-[0.35em] text-(--tone)">
                <span>河图声音志</span>
                {stats.oldestYear && stats.newestYear && (
                  <>
                    <span className="h-px w-5 bg-(--tone)/50" aria-hidden />
                    <span className="font-mono tabular-nums tracking-[0.2em]">
                      {stats.oldestYear} — {stats.newestYear}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-5 text-xs tracking-[0.22em] text-slate-400 dark:text-slate-500">
                <span className="tabular-nums">
                  在册{" "}
                  <strong className="font-serif font-semibold text-slate-700 dark:text-slate-200">
                    {stats.catalogCount}
                  </strong>{" "}
                  曲
                </span>
                <span aria-hidden className="h-3 w-px bg-slate-200 dark:bg-slate-800" />
                <button
                  type="button"
                  onClick={onRandomSong}
                  className="group inline-flex items-center gap-1.5 text-slate-500 transition-colors hover:text-(--tone) dark:text-slate-400 dark:hover:text-(--tone)"
                >
                  <Shuffle
                    size={13}
                    className="transition-transform duration-500 group-hover:rotate-180"
                  />
                  随缘听一曲
                </button>
              </div>
            </div>

            {/* 核心舞台：左唱片实体光影 · 中题名与署名 · 右竖排刻本摘句 */}
            {spotlight && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={spotlight.song.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className="grid items-center gap-12 lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[26rem_minmax(0,1fr)]"
                >
                  {/* 左侧：巨幅无框唱片封套 + 探出的黑胶唱盘 */}
                  <div className="relative mx-auto w-full max-w-[21rem] pr-10 sm:max-w-[23rem] sm:pr-14 lg:mx-0 lg:max-w-none">
                    {/* 封面背后轻晕一团柔光，模拟画廊射灯 */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-6 rounded-full opacity-55 blur-3xl transition-colors duration-1000 dark:opacity-45"
                      style={{ background: appliedTone.wash }}
                    />

                    <button
                      type="button"
                      onClick={() => onOpenSong(spotlight.song.id)}
                      aria-label={`进入《${spotlight.song.title}》详情页`}
                      className="group relative block aspect-square w-full text-left"
                    >
                      {/* 探出的哑光黑胶唱片：带真实细纹与随 --tone 染色的碟心 */}
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute inset-y-[5%] -right-[22%] aspect-square rounded-full shadow-[0_20px_45px_-14px_rgba(15,23,42,0.55)] ring-1 ring-white/10 transition-transform duration-1000 ease-page dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.9)]",
                          spotIsPlaying
                            ? "translate-x-5 animate-[spin_18s_linear_infinite]"
                            : "group-hover:translate-x-4 group-hover:rotate-12",
                        )}
                        style={{
                          background:
                            "repeating-radial-gradient(circle at center, #181c26 0px, #181c26 2px, #10131a 3px, #141822 4.5px)",
                        }}
                      >
                        {/* 黑胶表面微弱斜向反光 */}
                        <span
                          className="absolute inset-0 rounded-full opacity-35"
                          style={{
                            background:
                              "conic-gradient(from 35deg, transparent 0deg, rgba(255,255,255,0.28) 24deg, transparent 58deg, transparent 180deg, rgba(255,255,255,0.2) 210deg, transparent 245deg)",
                          }}
                        />
                        {/* 碟心纸标 */}
                        <span
                          className="absolute inset-[34%] rounded-full border border-white/15 shadow-inner"
                          style={{
                            background: `radial-gradient(circle at 35% 35%, var(--tone), #111622 95%)`,
                          }}
                        >
                          <span className="absolute inset-[42%] rounded-full bg-[#FAFAFA] dark:bg-[#0B0F19]" />
                        </span>
                      </span>

                      {/* 唱片正封 */}
                      <span className="relative block h-full w-full overflow-hidden rounded-md bg-slate-100 shadow-[0_36px_70px_-22px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/[0.07] dark:bg-slate-800 dark:shadow-[0_36px_70px_-20px_rgba(0,0,0,0.85)] dark:ring-white/10">
                        <Image
                          src={getCoverUrl(spotlight.song)}
                          alt={spotlight.song.title}
                          width={560}
                          height={560}
                          sizes="(min-width: 1280px) 360px, (min-width: 1024px) 320px, 72vw"
                          onLoad={(e) => handleCoverLoad(e.currentTarget)}
                          className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                        />
                      </span>
                    </button>
                  </div>

                  {/* 右侧：与详情页 SongHero 同宗同源的卷首排版 + 竖排刻本摘句 */}
                  <div className="relative flex min-w-0 flex-col justify-between lg:min-h-[22rem] lg:pr-32">
                    <div>
                      <p className="mb-5 flex flex-wrap items-center gap-2 text-xs tracking-[0.35em] text-(--tone)">
                        <span>今日留声</span>
                        <span aria-hidden>·</span>
                        <span>
                          {spotlight.song.type?.[0]
                            ? enumLabel(tEnum, "type", spotlight.song.type[0])
                            : "作品"}
                        </span>
                        {spotlight.song.genre?.[0] && (
                          <>
                            <span aria-hidden>·</span>
                            <span>
                              {enumLabel(
                                tEnum,
                                "genre",
                                spotlight.song.genre[0],
                              )}
                            </span>
                          </>
                        )}
                        {spotlight.song.year && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-mono tabular-nums tracking-[0.2em]">
                              {spotlight.song.year}
                            </span>
                          </>
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={() => onOpenSong(spotlight.song.id)}
                        className="group block text-left"
                      >
                        <h1 className="font-serif text-4xl font-semibold leading-[1.12] tracking-tight text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-50 sm:text-5xl xl:text-6xl text-balance">
                          {spotlight.song.title}
                        </h1>
                      </button>

                      {/* 署名：复刻详情页 SongHero 的无框 dl 行 */}
                      <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-[15px]">
                        {spotlight.song.lyricist?.length ? (
                          <div className="flex items-baseline gap-2">
                            <dt className="text-xs text-slate-400 dark:text-slate-500">
                              {tSong("folio.credits.lyricist")}
                            </dt>
                            <dd className="text-slate-800 dark:text-slate-200">
                              {spotlight.song.lyricist.join(" / ")}
                            </dd>
                          </div>
                        ) : null}
                        {spotlight.song.composer?.length ? (
                          <div className="flex items-baseline gap-2">
                            <dt className="text-xs text-slate-400 dark:text-slate-500">
                              {tSong("folio.credits.composer")}
                            </dt>
                            <dd className="text-slate-800 dark:text-slate-200">
                              {spotlight.song.composer.join(" / ")}
                            </dd>
                          </div>
                        ) : null}
                        {spotlight.song.artist?.length ? (
                          <div className="flex items-baseline gap-2">
                            <dt className="text-xs text-slate-400 dark:text-slate-500">
                              {tSong("folio.credits.artist")}
                            </dt>
                            <dd className="text-slate-800 dark:text-slate-200">
                              {spotlight.song.artist.join(" / ")}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {/* 窄屏横向摘句（宽屏移至右侧竖排） */}
                      {spotlight.excerpt && (
                        <p className="mt-7 border-l border-(--tone)/60 pl-4 font-kaiti text-base leading-relaxed text-slate-600 lg:hidden dark:text-slate-300">
                          {spotlight.excerpt}
                        </p>
                      )}
                    </div>

                    {/* 底部动作：极简书卷文字按钮 + 细线 */}
                    <div className="mt-10 flex flex-wrap items-center gap-6">
                      <button
                        type="button"
                        onClick={() => onOpenSong(spotlight.song.id)}
                        className="group inline-flex items-center gap-3 border-b border-(--tone) pb-1.5 font-serif text-sm tracking-[0.3em] text-(--tone) transition-opacity hover:opacity-75"
                      >
                        <span>展卷细读</span>
                        <ArrowRight
                          size={14}
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </button>

                      <PlayButton
                        songId={spotlight.song.id}
                        title={spotlight.song.title}
                        artist={spotlight.song.artist?.join(" / ")}
                        coverUrl={getCoverUrl(spotlight.song)}
                        hasAudio={spotlight.song.has_audio}
                        className="border border-slate-200/80 dark:border-slate-800"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setSpotIdx((i) => (i + 1) % featured.length)
                        }
                        className="text-xs tracking-[0.25em] text-slate-400 transition-colors hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200"
                      >
                        换一张唱片
                      </button>
                    </div>

                    {/* 宽屏右侧竖排刻本摘句：与详情页 SongHero 严格呼应 */}
                    {spotExcerptCols.length > 0 && (
                      <div
                        aria-hidden
                        className="hidden lg:flex absolute right-0 top-0 flex-row-reverse items-start gap-4"
                      >
                        <span className="mt-1 h-20 w-px bg-(--tone)/60" />
                        {spotExcerptCols.map((col, i) => (
                          <span
                            key={i}
                            className="font-calligraphy text-[1.55rem] leading-none tracking-[0.34em] text-slate-700/85 [writing-mode:vertical-rl] dark:text-slate-300/85"
                            style={{ marginTop: `${i * 2.5}rem` }}
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* ── 唱片架选曲条：轻点任意封面即可切换首屏唱片与整页光色 ── */}
            {featured.length > 1 && (
              <div className="mt-14 border-t border-slate-200/75 pt-6 dark:border-slate-800/75">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-kaiti text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    拨选架上唱片，观其光色与词句
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {String(safeIdx + 1).padStart(2, "0")} /{" "}
                      {String(featured.length).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSpotIdx(
                            (i) => (i - 1 + featured.length) % featured.length,
                          )
                        }
                        aria-label="上一张"
                        className="p-1 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSpotIdx((i) => (i + 1) % featured.length)
                        }
                        aria-label="下一张"
                        className="p-1 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1 sm:gap-5">
                  {featured.map((entry, idx) => {
                    const active = idx === safeIdx;
                    return (
                      <button
                        key={entry.song.id}
                        type="button"
                        onClick={() => setSpotIdx(idx)}
                        className="group relative flex w-36 shrink-0 items-center gap-3 pb-3 text-left transition-opacity sm:w-44"
                      >
                        <span
                          className={cn(
                            "h-11 w-11 shrink-0 overflow-hidden rounded-sm ring-1 ring-slate-900/5 transition-all duration-500 dark:ring-white/10",
                            active
                              ? "opacity-100 grayscale-0 scale-105 shadow-md"
                              : "opacity-55 grayscale-[45%] group-hover:opacity-90 group-hover:grayscale-0",
                          )}
                        >
                          <Image
                            src={getCoverUrl(entry.song)}
                            alt={entry.song.title}
                            width={88}
                            height={88}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate font-serif text-sm transition-colors",
                              active
                                ? "text-slate-900 dark:text-slate-50"
                                : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200",
                            )}
                          >
                            {entry.song.title}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                            {entry.song.year || "—"}
                          </span>
                        </span>
                        {/* 底部极细激活线 */}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute inset-x-0 bottom-0 h-[1.5px] bg-(--tone) transition-opacity duration-500",
                            active ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </header>
        ) : (
          /* 筛选或翻页时：自动收起大展台，瞬间进入安静的检目模式 */
          <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200/75 pb-5 dark:border-slate-800/75">
            <div className="flex items-baseline gap-4">
              <h1 className="font-serif text-3xl text-slate-900 dark:text-slate-50">
                谣歌 · 编年总录
              </h1>
              <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-(--tone)">
                {filteredSongs.length} 曲
              </span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs tracking-[0.22em] text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
            >
              <RotateCcw size={13} />
              返回卷首
            </button>
          </header>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            第二幕：三联特辑画廊（无圆角卡片、无彩色图标盒，细线 + 水墨晕染）
           ═══════════════════════════════════════════════════════════════════ */}
        {showEditorialTop && (
          <section className="py-12 md:py-16">
            <SectionHeading label="特辑">
              <span className="hidden font-kaiti text-xs tracking-[0.2em] text-slate-400 sm:inline dark:text-slate-500">
                听歌之外，另有三径可游
              </span>
            </SectionHeading>

            <div className="mt-10 grid divide-y divide-slate-200/75 border-y border-slate-200/75 md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-slate-800/75 dark:border-slate-800/75">
              {TRIPTYCH_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  style={
                    {
                      "--ink": item.accentLight,
                      "--ink-dark": item.accentDark,
                      "--wash": item.washLight,
                      "--wash-dark": item.washDark,
                    } as React.CSSProperties
                  }
                  className="group relative flex min-h-56 flex-col justify-between overflow-hidden px-1 py-8 transition-colors duration-500 md:px-8 md:py-10"
                >
                  {/* 悬停时各自东方矿物色如水墨晕开，常态干干净净 */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 dark:hidden"
                    style={{
                      background: `radial-gradient(ellipse 85% 75% at 80% 20%, var(--wash), transparent 72%)`,
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-700 group-hover:opacity-100 dark:block"
                    style={{
                      background: `radial-gradient(ellipse 85% 75% at 80% 20%, var(--wash-dark), transparent 72%)`,
                    }}
                  />

                  {/* 每径独有的极克制背景意象 */}
                  {item.id === "qjtx" && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-6 right-2 select-none font-calligraphy text-[8.5rem] leading-none text-[#9E3636]/[0.055] transition-transform duration-1000 group-hover:-translate-y-1 dark:text-[#E46A6A]/[0.08]"
                    >
                      倾
                    </span>
                  )}
                  {item.id === "imagery" && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute right-5 top-10 flex max-w-36 flex-wrap justify-end gap-x-2.5 gap-y-1.5 select-none opacity-45 transition-opacity duration-700 group-hover:opacity-80"
                    >
                      {FLOATING_IMAGERY_WORDS.slice(0, 6).map((w, i) => (
                        <span
                          key={w}
                          className="font-calligraphy text-[#286B62]/30 dark:text-[#52BCAE]/35"
                          style={{
                            fontSize: i % 2 === 0 ? "1.1rem" : "0.88rem",
                          }}
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.id === "quiz" && (
                    <svg
                      aria-hidden
                      viewBox="0 0 120 120"
                      className="pointer-events-none absolute -bottom-7 -right-7 h-36 w-36 text-[#9A6728]/15 transition-transform duration-1000 group-hover:rotate-45 dark:text-[#DFA95B]/20"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.7"
                        strokeDasharray="2 4"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="30"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.7"
                      />
                      <path
                        d="M60 8 L60 112 M8 60 L112 60"
                        stroke="currentColor"
                        strokeWidth="0.5"
                      />
                    </svg>
                  )}

                  {/* 顶栏：序号 · 标签 + 细箭头 */}
                  <div className="relative flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-[11px] tracking-[0.32em] text-(--ink) dark:text-(--ink-dark)">
                      <span>{item.numeral}</span>
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                      <span>{item.tag}</span>
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--ink) dark:text-slate-700 dark:group-hover:text-(--ink-dark)"
                    />
                  </div>

                  {/* 主标 + 楷体导语 */}
                  <div className="relative mt-10">
                    <h2 className="font-calligraphy text-3xl font-normal tracking-[0.22em] text-slate-900 transition-colors duration-300 group-hover:text-(--ink) dark:text-slate-50 dark:group-hover:text-(--ink-dark)">
                      {item.title}
                    </h2>
                    <p className="mt-3 max-w-xs font-kaiti text-sm leading-[1.85] text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            第三幕：近期新声（无框大尺幅新碟架，打破全页单一网格节奏）
           ═══════════════════════════════════════════════════════════════════ */}
        {showEditorialTop && recentSongs.length > 0 && (
          <section className="py-12 md:py-16">
            <SectionHeading label="近期新声">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollShelf(-1)}
                  aria-label="向左浏览近期新声"
                  className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollShelf(1)}
                  aria-label="向右浏览近期新声"
                  className="p-1.5 text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </SectionHeading>

            <div
              ref={shelfRef}
              {...shelfDragHandlers}
              className="no-scrollbar -mx-6 mt-10 flex cursor-grab gap-8 overflow-x-auto px-6 pb-4 active:cursor-grabbing"
            >
              {recentSongs.map((song, idx) => (
                <article
                  key={song.id}
                  onClick={() => {
                    if (shelfDraggedRef.current) return;
                    onOpenSong(song.id);
                  }}
                  className="group w-56 shrink-0 cursor-pointer sm:w-64"
                >
                  <div className="relative pr-3">
                    {/* 悬停时微微露出一丝黑胶边，保持唱片行触感又不抢封面 */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-[7%] right-0 aspect-square rounded-full bg-slate-900 opacity-0 shadow-md transition-all duration-700 ease-page group-hover:translate-x-2 group-hover:opacity-90 dark:bg-slate-950"
                      style={{
                        background:
                          "repeating-radial-gradient(circle at center, #1b202b 0px, #1b202b 2px, #0e1118 3px, #141822 4px)",
                      }}
                    />
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 shadow-[0_18px_36px_-18px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.06] transition-transform duration-500 group-hover:-translate-y-1 dark:bg-slate-800 dark:shadow-[0_18px_36px_-16px_rgba(0,0,0,0.75)] dark:ring-white/10">
                      <CoverArt
                        song={song}
                        sizes="256px"
                        priority={idx < 4 ? "eager" : undefined}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pr-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate font-serif text-[17px] text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                        {song.title}
                      </h3>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        {song.year || "—"}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-kaiti text-[13px] text-slate-500 dark:text-slate-400">
                      {songCreditLine(song)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            第四幕：编年总录（取消视图切换 —— 独一形态：左栏吸顶年份 + 右栏画册陈列）
           ═══════════════════════════════════════════════════════════════════ */}
        <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

        <section className={cn(showEditorialTop ? "pt-12 md:pt-16" : "pt-0")}>
          {showEditorialTop && (
            <SectionHeading label="编年总录">
              <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
                凡 {filteredSongs.length} 曲
              </span>
            </SectionHeading>
          )}

          {/* 吸顶检目栏：去掉了网格/列表切换，更加纯粹利落 */}
          <div
            className={cn(
              "sticky top-(--nav-h) z-30 -mx-6 mb-12 bg-[#FAFAFA]/94 px-6 pt-2 backdrop-blur-md dark:bg-[#0B0F19]/94",
              showEditorialTop && "mt-8",
            )}
          >
            <div
              className={cn(
                TAB_HAIRLINE_CLASS,
                "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
              )}
            >
              {/* 类型切换 */}
              <div className="no-scrollbar flex h-12 min-w-0 gap-6 overflow-x-auto md:h-full">
                {types.map((opt) => {
                  if (opt === FILTER_OPTION_ALL && isFiltering) {
                    return (
                      <button
                        key="reset"
                        type="button"
                        onClick={onReset}
                        className="relative flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap font-serif text-[15px] tracking-wider text-(--tone) transition-opacity hover:opacity-75"
                      >
                        <RotateCcw size={13} />
                        重置
                      </button>
                    );
                  }
                  const active = activeType === opt;
                  const label =
                    opt === FILTER_OPTION_ALL
                      ? tCommon("all")
                      : opt === FILTER_OPTION_UNKNOWN
                        ? tCommon("unknown")
                        : enumLabel(tEnum, "type", opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onTypeChange(opt)}
                      aria-pressed={active}
                      className={cn(
                        "relative flex h-full shrink-0 items-center whitespace-nowrap font-serif text-[15px] tracking-wider transition-colors",
                        active
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* 右侧底线搜索 */}
              <div className="flex h-11 items-center gap-3 md:ml-auto md:h-full">
                <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2.5 md:w-72 md:flex-none">
                  <Search
                    size={15}
                    className="shrink-0 text-slate-400 transition-colors group-focus-within:text-(--tone)"
                  />
                  <input
                    type="text"
                    placeholder="寻曲：题名、词曲、专辑..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent font-kaiti text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      aria-label="清空搜索"
                      className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 编年陈列正文：左栏吸顶大号年份 + 右栏三列画册唱片 */}
          {pageSongs.length === 0 ? (
            <p className="py-24 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              未觅得符合条件的曲目
            </p>
          ) : (
            <div className="space-y-16 md:space-y-20">
              {yearGroups.map((group, gIdx) => (
                <div
                  key={group.key}
                  className={cn(
                    "grid gap-y-8 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-x-12",
                    gIdx > 0 &&
                      "border-t border-slate-200/70 pt-14 dark:border-slate-800/70 md:pt-16",
                  )}
                >
                  {/* 左栏：年份标尺（宽屏吸顶随读，窄屏横向分隔） */}
                  <div className="flex items-baseline justify-between lg:sticky lg:top-[calc(var(--nav-h)+4.5rem)] lg:block lg:self-start">
                    <div className="flex items-baseline gap-3 lg:block">
                      <h3 className="font-serif text-3xl font-semibold tabular-nums tracking-tight text-slate-900/90 dark:text-slate-100/90 lg:text-4xl">
                        {group.year ?? FILTER_OPTION_UNKNOWN}
                      </h3>
                      <span
                        aria-hidden
                        className="hidden h-px w-6 bg-(--tone)/70 lg:mt-3 lg:block"
                      />
                    </div>
                    <p className="font-mono text-xs tabular-nums tracking-[0.2em] text-slate-400 lg:mt-3 dark:text-slate-500">
                      {group.songs.length} 曲
                    </p>
                  </div>

                  {/* 右栏：三列宽幅唱片图版 */}
                  <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                    {group.songs.map((song, sIdx) => {
                      const fav = isFavorite(song.id);
                      const isCurrentPlaying =
                        currentTrack?.songId === song.id && isPlaying;
                      return (
                        <article
                          key={song.id}
                          onClick={() => onOpenSong(song.id)}
                          className="group flex cursor-pointer flex-col"
                        >
                          {/* 无框封面：常态洁净，悬停底部淡出暗角与操作 */}
                          <div
                            className={cn(
                              "relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 ring-1 transition-all duration-500 dark:bg-slate-800",
                              isCurrentPlaying
                                ? "ring-2 ring-(--tone) shadow-[0_20px_42px_-16px_rgba(15,23,42,0.34)]"
                                : "ring-slate-900/[0.06] shadow-[0_14px_30px_-16px_rgba(15,23,42,0.22)] group-hover:-translate-y-1.5 group-hover:shadow-[0_26px_50px_-20px_rgba(15,23,42,0.38)] dark:ring-white/10 dark:shadow-black/55",
                            )}
                          >
                            <CoverArt
                              song={song}
                              sizes="(min-width: 1280px) 320px, (min-width: 1024px) 36vw, (min-width: 640px) 46vw, 78vw"
                              priority={gIdx === 0 && sIdx < 3 ? "eager" : undefined}
                            />

                            {/* 悬停底部微暗渐变 + 时长/播放/队列/收藏 */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/65 via-black/20 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />

                            <div
                              className={cn(
                                "absolute inset-x-3 bottom-3 flex items-center justify-between transition-opacity duration-300",
                                fav || isCurrentPlaying
                                  ? "opacity-100"
                                  : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                              )}
                            >
                              <span className="inline-flex items-center gap-2 font-mono text-[11px] tabular-nums text-white/85 drop-shadow-xs">
                                {isCurrentPlaying && <PlayingBars />}
                                {song.length ? formatTime(song.length) : ""}
                              </span>

                              <div className="flex items-center gap-1">
                                <PlayButton
                                  songId={song.id}
                                  title={song.title}
                                  artist={song.artist?.join(" / ")}
                                  coverUrl={getCoverUrl(song)}
                                  hasAudio={song.has_audio}
                                  className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-white"
                                  size={13}
                                />
                                <EnqueueButton
                                  songId={song.id}
                                  title={song.title}
                                  artist={song.artist?.join(" / ")}
                                  coverUrl={getCoverUrl(song)}
                                  hasAudio={song.has_audio}
                                  className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-white"
                                  size={13}
                                />
                                {isLoggedIn && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavorite(song.id);
                                    }}
                                    aria-label={
                                      fav
                                        ? tSong("actions.unfavorite")
                                        : tSong("actions.favorite")
                                    }
                                    className={cn(
                                      "rounded-full bg-white/90 p-1.5 shadow-sm transition-colors dark:bg-slate-900/90",
                                      fav
                                        ? "text-rose-500"
                                        : "text-slate-600 hover:text-rose-500 dark:text-slate-300",
                                    )}
                                  >
                                    <Heart
                                      size={13}
                                      className={fav ? "fill-current" : ""}
                                    />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 三层书卷排版信息：题名 / 楷体词曲 / 极淡流派类型 */}
                          <div className="mt-4 space-y-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <h4
                                className={cn(
                                  "line-clamp-1 font-serif text-[19px] leading-snug text-slate-900 transition-colors dark:text-slate-100",
                                  isCurrentPlaying
                                    ? "text-(--tone)"
                                    : "group-hover:text-(--tone)",
                                )}
                                title={song.title}
                              >
                                {song.title}
                              </h4>
                              {song.type?.[0] && (
                                <span className="shrink-0 text-[11px] tracking-[0.22em] text-slate-400 dark:text-slate-500">
                                  {enumLabel(tEnum, "type", song.type[0])}
                                </span>
                              )}
                            </div>

                            <p className="truncate font-kaiti text-[14px] text-slate-600 dark:text-slate-400">
                              {songCreditLine(song)}
                            </p>

                            {song.genre && song.genre.length > 0 && (
                              <p className="truncate text-[11px] tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                {song.genre
                                  .slice(0, 3)
                                  .map((g) => enumLabel(tEnum, "genre", g))
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination
            className="mt-16"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            scrollTarget={listStartRef}
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            版记收束
           ═══════════════════════════════════════════════════════════════════ */}
        <footer className="mt-24 border-t border-slate-200/75 pt-8 dark:border-slate-800/75">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <SiteMark />
            <div className="flex flex-wrap items-center gap-6 text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500">
              {TRIPTYCH_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="transition-colors hover:text-(--tone)"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
