"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import CoverArt from "@/components/library/CoverArt";
import EnqueueButton from "@/components/shared/EnqueueButton";
import Pagination from "@/components/shared/Pagination";
import PlayButton from "@/components/shared/PlayButton";
import SiteMark from "@/components/shared/SiteMark";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import { useFavorites } from "@/context/FavoritesContext";
import { Link } from "@/i18n/navigation";
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
} from "@/lib/constants";
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
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Shuffle,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import {
  type DemoViewProps,
  FEATURE_ITEMS,
  FLOATING_IMAGERY_WORDS,
  songCreditLine,
} from "./shared";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 方向 A：「展卷·刊首画廊」（Editorial Gallery）
 * 呼应歌曲详情页的设计灵魂：封面取色双团径向光晕、竖排刻本摘句、
 * 非对称刊首展台 + 3 张差异化策展 Bento 卡 + 书目感曲库总录。
 */
export default function DemoAEditorial({
  filteredSongs,
  pageSongs,
  featured,
  stats,
  types,
  activeType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  isFiltering,
  onReset,
  view,
  onViewChange,
  page,
  totalPages,
  onPageChange,
  listStartRef,
  onOpenSong,
  onRandomSong,
}: DemoViewProps) {
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tLib = useTranslations("library");
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { currentTrack, isPlaying } = usePlayerStore();

  const [spotIdx, setSpotIdx] = useState(0);
  const [tone, setTone] = useState<CoverTone | null>(null);
  const [paused, setPaused] = useState(false);

  const safeIdx = featured.length > 0 ? spotIdx % featured.length : 0;
  const currentSpot = featured[safeIdx] ?? null;

  // 慢速自动轮换卷首焦点，鼠标悬停时暂停
  useEffect(() => {
    if (featured.length < 2 || paused || isFiltering || page > 1) return;
    const id = window.setInterval(() => {
      setSpotIdx((i) => (i + 1) % featured.length);
    }, 8500);
    return () => window.clearInterval(id);
  }, [featured.length, paused, isFiltering, page]);

  const handleSpotCoverLoad = useCallback((img: HTMLImageElement) => {
    setTone(toneFromImage(img) ?? INK_TONE);
  }, []);

  const appliedTone = tone ?? INK_TONE;
  const showShowcase = !isFiltering && page === 1;
  const excerptColumns =
    currentSpot?.excerpt?.split(/\s+/).filter(Boolean).slice(0, 3) ?? [];

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
      {/* 同详情页的封面取色铺底：随卷首焦点封面的色相缓缓晕开 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[56rem] transition-opacity duration-1400 ease-out"
        style={{
          opacity: tone ? 1 : 0.45,
          background: `radial-gradient(ellipse 68% 48% at 78% 8%, ${appliedTone.wash}, transparent 72%), radial-gradient(ellipse 52% 40% at 14% 4%, ${appliedTone.wash}, transparent 70%)`,
        }}
      />

      <main className="relative mx-auto max-w-7xl px-6 pb-32 pt-28 md:pt-36">
        {/* ── 1. 非对称刊首展台 ── */}
        <header
          className={cn(
            "transition-all duration-500",
            showShowcase ? "pb-14 md:pb-20" : "pb-8",
          )}
        >
          {showShowcase ? (
            <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16">
              {/* 左栏：刊头、大标、导语、档案数字与快捷入口 */}
              <div className="flex flex-col justify-between lg:min-h-[25rem]">
                <div>
                  <p className="mb-6 flex items-center gap-3 text-xs tracking-[0.35em] text-(--tone)">
                    <span>河图音乐档案</span>
                    {stats.oldestYear && stats.newestYear && (
                      <>
                        <span className="h-px w-6 bg-(--tone)/50" aria-hidden />
                        <span className="tabular-nums">
                          {stats.oldestYear} — {stats.newestYear}
                        </span>
                      </>
                    )}
                  </p>

                  <h1 className="font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50 md:text-6xl xl:text-7xl">
                    谣歌
                    <span className="ml-4 inline-flex items-baseline font-serif text-[0.42em] font-normal tracking-wider text-slate-400 dark:text-slate-500">
                      <span className="mr-1 text-[1.45em] font-semibold tabular-nums text-(--tone)">
                        {stats.catalogCount}
                      </span>
                      曲
                    </span>
                  </h1>

                  <p className="mt-6 max-w-xl font-kaiti text-lg leading-[1.95] text-slate-600 dark:text-slate-300 md:text-[19px]">
                    你一定想知道，戏里讲了什么故事……
                    <span className="mt-1 block text-[15px] text-slate-400 dark:text-slate-500">
                      收录历年原唱、合作、填词与曲谱校记，以意象与手记串起一部可听可读的声音志。
                    </span>
                  </p>

                  {/* 克制但清晰的主次操作 */}
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={onRandomSong}
                      className="group inline-flex items-center gap-2.5 rounded-full bg-(--tone) px-5 py-2.5 text-xs tracking-[0.22em] text-white transition-all duration-300 hover:opacity-90 dark:text-slate-950"
                    >
                      <Shuffle
                        size={14}
                        className="transition-transform duration-500 group-hover:rotate-180"
                      />
                      随机展卷一曲
                    </button>
                    <Link
                      href="/quiz"
                      className="group inline-flex items-center gap-2 rounded-full border border-slate-300/80 px-5 py-2.5 text-xs tracking-[0.22em] text-slate-700 transition-colors hover:border-(--tone) hover:text-(--tone) dark:border-slate-700 dark:text-slate-300 dark:hover:border-(--tone) dark:hover:text-(--tone)"
                    >
                      十二问寻歌
                      <ArrowRight
                        size={13}
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </div>

                {/* 底部档案指标细栏 */}
                <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-slate-200/80 pt-6 dark:border-slate-800/80">
                  <div>
                    <dt className="text-[11px] tracking-[0.25em] text-slate-400 dark:text-slate-500">
                      在册曲目
                    </dt>
                    <dd className="mt-1 font-serif text-xl tabular-nums text-slate-800 dark:text-slate-100">
                      {stats.catalogCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.25em] text-slate-400 dark:text-slate-500">
                      涉及专辑
                    </dt>
                    <dd className="mt-1 font-serif text-xl tabular-nums text-slate-800 dark:text-slate-100">
                      {stats.albumCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.25em] text-slate-400 dark:text-slate-500">
                      创作跨度
                    </dt>
                    <dd className="mt-1 font-serif text-xl tabular-nums text-slate-800 dark:text-slate-100">
                      {stats.oldestYear && stats.newestYear
                        ? `${stats.newestYear - stats.oldestYear + 1} 年`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 右栏：今日卷首焦点封面 + 竖排刻本摘句 */}
              {currentSpot && (
                <div
                  onMouseEnter={() => setPaused(true)}
                  onMouseLeave={() => setPaused(false)}
                  className="relative"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs tracking-[0.3em] text-(--tone)">
                      <span className="h-1.5 w-1.5 rounded-full bg-(--tone)" />
                      今日卷首
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
                              (i) =>
                                (i - 1 + featured.length) % featured.length,
                            )
                          }
                          aria-label="上一首卷首推荐"
                          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSpotIdx((i) => (i + 1) % featured.length)
                          }
                          aria-label="下一首卷首推荐"
                          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSpot.song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.55, ease: EASE }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 sm:gap-8"
                    >
                      {/* 主封面 + 底部作品信息 */}
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenSong(currentSpot.song.id)}
                          className="group relative block aspect-square w-full max-w-[23rem] overflow-hidden rounded-md bg-slate-100 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.34)] ring-1 ring-slate-900/5 dark:bg-slate-800 dark:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.75)] dark:ring-white/10"
                        >
                          <Image
                            src={getCoverUrl(currentSpot.song)}
                            alt={currentSpot.song.title}
                            width={520}
                            height={520}
                            sizes="(min-width: 1024px) 368px, 72vw"
                            onLoad={(e) => handleSpotCoverLoad(e.currentTarget)}
                            className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-linear-to-t from-black/65 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span className="text-xs tracking-[0.25em] text-white/90">
                              点击展卷
                            </span>
                            <ArrowUpRight size={16} className="text-white" />
                          </div>
                        </button>

                        <div className="mt-5 flex max-w-[23rem] items-baseline justify-between gap-4">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenSong(currentSpot.song.id)}
                              className="group flex items-center gap-1.5 text-left"
                            >
                              <h2 className="truncate font-serif text-xl text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-50">
                                《{currentSpot.song.title}》
                              </h2>
                            </button>
                            <p className="mt-1 truncate text-xs tracking-wider text-slate-500 dark:text-slate-400">
                              {songCreditLine(currentSpot.song)}
                              {currentSpot.song.year
                                ? ` · ${currentSpot.song.year}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <PlayButton
                              songId={currentSpot.song.id}
                              title={currentSpot.song.title}
                              artist={currentSpot.song.artist?.join(" / ")}
                              coverUrl={getCoverUrl(currentSpot.song)}
                              hasAudio={currentSpot.song.has_audio}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 右侧竖排刻本摘句：与详情页 SongHero 血脉相连 */}
                      {excerptColumns.length > 0 && (
                        <div
                          aria-hidden
                          className="flex flex-row-reverse items-start gap-3 pt-1 sm:gap-4"
                        >
                          <span className="mt-1 h-16 w-px bg-(--tone)/60" />
                          {excerptColumns.map((col, i) => (
                            <span
                              key={i}
                              className="font-calligraphy text-xl leading-none tracking-[0.3em] text-slate-700/85 [writing-mode:vertical-rl] dark:text-slate-300/85 sm:text-2xl"
                              style={{ marginTop: `${i * 2.2}rem` }}
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            /* 筛选或翻页态：自动收敛成利落的紧凑刊头，让视线直达曲库 */
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200/70 pb-6 dark:border-slate-800">
              <div className="flex items-baseline gap-4">
                <h1 className="font-serif text-3xl text-slate-900 dark:text-slate-50">
                  谣歌
                </h1>
                <span className="font-serif text-sm text-(--tone) tabular-nums">
                  共 {filteredSongs.length} 首符合
                </span>
              </div>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 text-xs tracking-widest text-slate-500 transition-colors hover:text-(--tone) dark:text-slate-400"
              >
                <RotateCcw size={13} />
                返回完整首页
              </button>
            </div>
          )}
        </header>

        {/* ── 2. 策展特辑区（三大入口 Bento 展卡） ── */}
        {showShowcase && (
          <section className="pb-16 md:pb-20">
            <SectionHeading label="特辑展卷" />
            <div className="mt-8 grid gap-5 md:grid-cols-12">
              {FEATURE_ITEMS.map((item, idx) => {
                // 不等宽 5 / 4 / 3 杂志栅格，破除平均排版的单调
                const spanClass =
                  idx === 0
                    ? "md:col-span-5"
                    : idx === 1
                      ? "md:col-span-4"
                      : "md:col-span-3";

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    style={
                      {
                        "--feat": item.accentLight,
                        "--feat-dark": item.accentDark,
                      } as React.CSSProperties
                    }
                    className={cn(
                      "group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white/75 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-(--feat)/40 hover:shadow-[0_20px_45px_-22px_rgba(15,23,42,0.22)] dark:border-slate-800/80 dark:bg-slate-900/45 dark:hover:border-(--feat-dark)/40 dark:hover:shadow-[0_20px_45px_-22px_rgba(0,0,0,0.7)]",
                      spanClass,
                    )}
                  >
                    {/* 专属东方色低饱和氛围晕染 */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-700 group-hover:opacity-[0.24] dark:opacity-[0.16] dark:group-hover:opacity-[0.28]"
                      style={{ background: "var(--feat)" }}
                    />

                    {/* 每张卡独有的克制视觉底纹 */}
                    {item.id === "qjtx" && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -bottom-5 right-3 select-none font-calligraphy text-[7.5rem] leading-none text-[#9E3636]/[0.07] transition-transform duration-700 group-hover:scale-105 dark:text-[#E46A6A]/[0.09]"
                      >
                        倾尽
                      </span>
                    )}
                    {item.id === "imagery" && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-4 right-4 flex flex-wrap content-start justify-end gap-x-3 gap-y-1.5 max-w-[10.5rem] select-none opacity-45 transition-opacity duration-500 group-hover:opacity-75"
                      >
                        {FLOATING_IMAGERY_WORDS.slice(0, 6).map((w, i) => (
                          <span
                            key={w}
                            className="font-calligraphy text-[#286B62]/30 dark:text-[#52BCAE]/35"
                            style={{
                              fontSize: i % 2 === 0 ? "1.15rem" : "0.9rem",
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
                        className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 text-[#9A6728]/15 transition-transform duration-1000 group-hover:rotate-45 dark:text-[#DFA95B]/20"
                      >
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="0.8"
                          strokeDasharray="3 4"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="28"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="0.8"
                        />
                        <path
                          d="M60 10 L60 110 M10 60 L110 60"
                          stroke="currentColor"
                          strokeWidth="0.6"
                        />
                      </svg>
                    )}

                    <div className="relative flex items-center justify-between">
                      <span
                        className="text-[11px] tracking-[0.3em]"
                        style={{ color: item.accentLight }}
                      >
                        <span className="dark:hidden">{item.tag}</span>
                        <span
                          className="hidden dark:inline"
                          style={{ color: item.accentDark }}
                        >
                          {item.tag}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={16}
                        className="text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-700 dark:text-slate-600 dark:group-hover:text-slate-200"
                      />
                    </div>

                    <div className="relative mt-8">
                      <h3 className="font-calligraphy text-3xl font-normal tracking-[0.18em] text-slate-900 dark:text-slate-50">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 max-w-xs font-kaiti text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 3. 曲目总录 ── */}
        <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

        <section>
          <SectionHeading label="曲目总录">
            <span className="text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {filteredSongs.length} 首
            </span>
          </SectionHeading>

          {/* 吸顶工具栏 */}
          <div className="sticky top-(--nav-h) z-30 -mx-6 mb-10 mt-6 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-sm dark:bg-[#0B0F19]/95">
            <div
              className={cn(
                TAB_HAIRLINE_CLASS,
                "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
              )}
            >
              <div className="no-scrollbar flex h-12 min-w-0 gap-6 overflow-x-auto md:h-full">
                {types.map((opt) => {
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

              <div className="flex h-11 items-center gap-1 md:ml-auto md:h-full">
                <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-64 md:flex-none">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索歌名、词曲、专辑..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
                  />
                </label>

                <span
                  aria-hidden
                  className="mx-2 h-4 w-px bg-slate-200 dark:bg-slate-800"
                />

                <button
                  type="button"
                  onClick={() => onViewChange("grid")}
                  aria-label={tLib("view.grid")}
                  className={cn(
                    NAV_BUTTON_CLASS,
                    view === "grid" && "text-(--tone) dark:text-(--tone)",
                  )}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onViewChange("list")}
                  aria-label={tLib("view.list")}
                  className={cn(
                    NAV_BUTTON_CLASS,
                    view === "list" && "text-(--tone) dark:text-(--tone)",
                  )}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {pageSongs.length === 0 ? (
            <p className="py-24 text-center font-kaiti text-base text-slate-400">
              未觅得符合条件的曲目
            </p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageSongs.map((song, idx) => {
                const fav = isFavorite(song.id);
                const playing =
                  currentTrack?.songId === song.id && isPlaying;
                return (
                  <article
                    key={song.id}
                    onClick={() => onOpenSong(song.id)}
                    className="group flex cursor-pointer flex-col gap-3.5"
                  >
                    <div
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 ring-1 transition-all duration-500 dark:bg-slate-800",
                        playing
                          ? "ring-2 ring-(--tone) shadow-[0_18px_36px_-14px_rgba(15,23,42,0.35)]"
                          : "ring-slate-900/[0.06] shadow-[0_12px_28px_-14px_rgba(15,23,42,0.22)] group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_48px_-18px_rgba(15,23,42,0.35)] dark:ring-white/10 dark:shadow-black/50",
                      )}
                    >
                      <CoverArt
                        song={song}
                        sizes="(min-width: 1280px) 284px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 75vw"
                        priority={idx < 4 ? "eager" : undefined}
                      />

                      {/* 底部柔和暗角，承载悬停操作，告别右上角突兀小白点 */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/60 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between opacity-0 transition-all duration-300 group-hover:opacity-100">
                        <span className="truncate text-[11px] tracking-[0.2em] text-white/85">
                          {song.type?.[0]
                            ? enumLabel(tEnum, "type", song.type[0])
                            : "作品"}
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
                              aria-label="收藏"
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

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="line-clamp-1 font-serif text-[18px] leading-snug text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                          {song.title}
                        </h3>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {song.year || FILTER_OPTION_UNKNOWN}
                        </span>
                      </div>
                      <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">
                        {songCreditLine(song)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* 方向 A 列表视图：细线唱片目录表 */
            <div className="divide-y divide-slate-200/70 border-y border-slate-200/70 dark:divide-slate-800/70 dark:border-slate-800/70">
              {pageSongs.map((song, idx) => {
                const orderNum =
                  (page - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE + idx + 1;
                return (
                  <div
                    key={song.id}
                    onClick={() => onOpenSong(song.id)}
                    className="group flex cursor-pointer items-center gap-5 py-3.5 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/35 sm:px-3"
                  >
                    <span className="hidden w-8 shrink-0 font-mono text-xs tabular-nums text-slate-300 dark:text-slate-600 sm:block">
                      {String(orderNum).padStart(2, "0")}
                    </span>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm">
                      <CoverArt song={song} sizes="48px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-base text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                        {song.title}
                      </h3>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {songCreditLine(song)}
                      </p>
                    </div>
                    <span className="hidden w-36 truncate text-xs text-slate-400 dark:text-slate-500 lg:block">
                      {song.album && song.album !== song.title
                        ? `《${song.album}》`
                        : "—"}
                    </span>
                    <span className="hidden w-16 text-center text-xs tracking-wider text-slate-400 dark:text-slate-500 md:block">
                      {song.type?.[0]
                        ? enumLabel(tEnum, "type", song.type[0])
                        : "—"}
                    </span>
                    <span className="w-12 text-right font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {song.year || "—"}
                    </span>
                    <span className="hidden w-12 text-right font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500 sm:block">
                      {formatTime(song.length)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <Pagination
            className="mt-14"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            scrollTarget={listStartRef}
          />
        </section>

        {/* 页脚收束 */}
        <footer className="mt-24 flex flex-col items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row dark:border-slate-800/70">
          <SiteMark />
          <p className="font-kaiti text-xs tracking-widest text-slate-400 dark:text-slate-500">
            山河入乐，岁月留声
          </p>
        </footer>
      </main>
    </div>
  );
}
