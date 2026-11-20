"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import CoverArt from "@/components/library/CoverArt";
import Pagination from "@/components/shared/Pagination";
import SiteMark from "@/components/shared/SiteMark";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import { Link } from "@/i18n/navigation";
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
} from "@/lib/constants";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { enumLabel } from "@/lib/utils/utils-song";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Shuffle,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useState } from "react";
import {
  type DemoViewProps,
  FEATURE_ITEMS,
  songCreditLine,
} from "./shared";

/**
 * 方向 C：「现代国风典籍·精装版」（Refined Folio）
 * 克制而不素：极微宣纸纸纹质感 + 建筑感纵横细线扉页 + 朱砂印章落款 +
 * 三枚竖排书签入口 + 带编目编号（No.001）与画框留白的艺术画册图版。
 */
export default function DemoCFolio({
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

  const [quoteIdx, setQuoteIdx] = useState(0);
  const quoteList = featured.filter((f) => f.excerpt);
  const currentQuote =
    quoteList.length > 0 ? quoteList[quoteIdx % quoteList.length] : null;

  useEffect(() => {
    if (quoteList.length < 2) return;
    const id = window.setInterval(
      () => setQuoteIdx((i) => (i + 1) % quoteList.length),
      7500,
    );
    return () => window.clearInterval(id);
  }, [quoteList.length]);

  const showFrontispiece = !isFiltering && page === 1;

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#F9F8F5] transition-colors duration-500 dark:bg-[#0B0F19]"
      style={
        {
          "--tone-light": INK_TONE.light,
          "--tone-dark": INK_TONE.dark,
        } as React.CSSProperties
      }
    >
      {/* 极微宣纸噪点纹理：消除冷白塑料感，几乎不可察却极显温润 */}
      <svg
        aria-hidden
        className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.032] dark:opacity-[0.045]"
      >
        <filter id="demo-c-paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#demo-c-paper-grain)" />
      </svg>

      {/* 顶部淡墨蓝光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem]"
        style={{
          background: `radial-gradient(ellipse 65% 45% at 22% 0%, ${INK_TONE.wash}, transparent 72%)`,
        }}
      />

      <main className="relative mx-auto max-w-7xl px-6 pb-32 pt-28 md:pt-36">
        {/* ── 1. 精装书扉页：纵横细线编排 ── */}
        {showFrontispiece ? (
          <header className="mb-16 border-y border-slate-300/70 dark:border-slate-800">
            {/* 书眉细栏 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 py-3 text-[11px] tracking-[0.35em] text-slate-400 dark:border-slate-800/80 dark:text-slate-500">
              <span>卷首 · 总目</span>
              <span className="font-mono tabular-nums">
                {stats.oldestYear && stats.newestYear
                  ? `${stats.oldestYear} — ${stats.newestYear}`
                  : "编年"}
                {" · "}凡 {stats.catalogCount} 曲
              </span>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              {/* 左扉：大字刊名 + 朱砂印 + 导语 + 轮换词句摘录 */}
              <div className="flex flex-col justify-between py-10 lg:border-r lg:border-slate-200/80 lg:py-14 lg:pr-12 dark:lg:border-slate-800/80">
                <div>
                  <div className="flex items-start gap-5">
                    <h1 className="font-serif text-6xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50 md:text-7xl">
                      谣歌
                    </h1>
                    {/* 微型朱砂篆印点缀 */}
                    <span
                      aria-hidden
                      className="mt-1 inline-grid grid-cols-2 place-items-center border border-[#A33E3E]/70 px-1.5 py-1 font-calligraphy text-[13px] leading-[1.05] text-[#A33E3E] dark:border-[#DE5D5D]/60 dark:text-[#DE5D5D]"
                    >
                      <span>勘</span>
                      <span>河</span>
                      <span>鉴</span>
                      <span>图</span>
                    </span>
                  </div>

                  <p className="mt-6 max-w-lg font-kaiti text-lg leading-[2] text-slate-600 dark:text-slate-300">
                    你一定想知道，戏里讲了什么故事……
                  </p>
                </div>

                {/* 轮换摘句条：像古籍扉页的一则题记 */}
                <div className="mt-10 border-t border-slate-200/75 pt-6 dark:border-slate-800/75">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] tracking-[0.3em] text-slate-400 dark:text-slate-500">
                      卷中摘句
                    </span>
                    <button
                      type="button"
                      onClick={onRandomSong}
                      className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] text-(--tone) transition-opacity hover:opacity-75"
                    >
                      <Shuffle size={12} />
                      随翻一卷
                    </button>
                  </div>
                  <div className="mt-3 min-h-14">
                    <AnimatePresence mode="wait">
                      {currentQuote ? (
                        <motion.div
                          key={currentQuote.song.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.6 }}
                          className="flex flex-wrap items-baseline justify-between gap-3"
                        >
                          <p className="font-calligraphy text-2xl tracking-[0.12em] text-slate-800 dark:text-slate-200">
                            {currentQuote.excerpt}
                          </p>
                          <button
                            type="button"
                            onClick={() => onOpenSong(currentQuote.song.id)}
                            className="font-serif text-xs tracking-[0.2em] text-(--tone) hover:underline"
                          >
                            ——《{currentQuote.song.title}》
                          </button>
                        </motion.div>
                      ) : (
                        <p className="font-kaiti text-sm text-slate-400">
                          词中万象，静候展读
                        </p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 右扉：三枚竖排书签栏（壹·贰·叁），纯靠线条与留白做出高级感 */}
              <div className="grid grid-cols-3 divide-x divide-slate-200/80 border-t border-slate-200/80 lg:border-t-0 dark:divide-slate-800/80 dark:border-slate-800/80">
                {FEATURE_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group relative flex flex-col justify-between px-4 py-8 transition-colors duration-500 hover:bg-slate-900/[0.025] sm:px-6 lg:py-12 dark:hover:bg-white/[0.03]"
                  >
                    {/* 顶部色线：悬停时向两侧展开 */}
                    <span
                      aria-hidden
                      className="absolute inset-x-6 top-0 h-[2px] origin-center scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                      style={{ backgroundColor: item.accentLight }}
                    />

                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs text-slate-400 dark:text-slate-500">
                        {item.indexNum}
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="text-slate-300 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-700 dark:text-slate-600 dark:group-hover:text-slate-200"
                      />
                    </div>

                    <div className="my-8 flex justify-center">
                      <span
                        className="font-calligraphy text-2xl tracking-[0.42em] [writing-mode:vertical-rl] transition-colors duration-500 sm:text-[26px]"
                        style={{ color: item.accentLight }}
                      >
                        <span className="dark:hidden">{item.title}</span>
                        <span
                          className="hidden dark:inline"
                          style={{ color: item.accentDark }}
                        >
                          {item.title}
                        </span>
                      </span>
                    </div>

                    <p className="text-center font-kaiti text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.tag}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </header>
        ) : (
          <div className="mb-8 flex items-baseline justify-between border-b border-slate-200/80 pb-5 dark:border-slate-800">
            <div className="flex items-baseline gap-4">
              <h1 className="font-serif text-3xl text-slate-900 dark:text-slate-50">
                谣歌 · 总目
              </h1>
              <span className="font-mono text-xs text-(--tone)">
                {filteredSongs.length} 曲
              </span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs tracking-widest text-slate-500 hover:text-(--tone)"
            >
              <RotateCcw size={12} />
              返回卷首
            </button>
          </div>
        )}

        {/* ── 2. 曲目编年图版 ── */}
        <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

        <section>
          <SectionHeading label="曲目图版">
            <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {filteredSongs.length} PLATES
            </span>
          </SectionHeading>

          {/* 极简细线工具栏 */}
          <div className="sticky top-(--nav-h) z-30 -mx-6 mb-10 mt-6 bg-[#F9F8F5]/95 px-6 pt-2 backdrop-blur-sm dark:bg-[#0B0F19]/95">
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
                          "absolute inset-x-0 bottom-0 h-0.5 bg-(--tone) transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex h-11 items-center gap-1 md:ml-auto md:h-full">
                <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-60 md:flex-none">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder="检目：题名、词曲、专辑..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent font-kaiti text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchChange("")}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
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
              未见此目
            </p>
          ) : view === "grid" ? (
            /* 艺术画册图版：顶线编号 No.001 + 装裱留白画框 + 默认微褪色悬停焕彩 */
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageSongs.map((song, idx) => {
                const num =
                  (page - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE + idx + 1;
                return (
                  <article
                    key={song.id}
                    onClick={() => onOpenSong(song.id)}
                    className="group cursor-pointer"
                  >
                    <div className="mb-2.5 flex items-center justify-between border-t border-slate-300/70 pt-2 font-mono text-[11px] tabular-nums text-slate-400 transition-colors group-hover:border-(--tone)/60 dark:border-slate-800 dark:text-slate-500">
                      <span>No.{String(num).padStart(3, "0")}</span>
                      <span>{song.year || FILTER_OPTION_UNKNOWN}</span>
                    </div>

                    <div className="border border-slate-200/90 bg-white/70 p-2 transition-all duration-500 group-hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:group-hover:border-slate-700">
                      <div className="aspect-square overflow-hidden">
                        <CoverArt
                          song={song}
                          sizes="(min-width: 1280px) 268px, (min-width: 1024px) 28vw, (min-width: 640px) 44vw, 75vw"
                          priority={idx < 4 ? "eager" : undefined}
                          className="grayscale-[24%] transition-[filter] duration-700 group-hover:grayscale-0"
                        />
                      </div>
                    </div>

                    <div className="mt-3.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="line-clamp-1 font-serif text-[18px] text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                          {song.title}
                        </h3>
                        {song.type?.[0] && (
                          <span className="shrink-0 text-[11px] tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            {enumLabel(tEnum, "type", song.type[0])}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-kaiti text-[13px] text-slate-500 dark:text-slate-400">
                        {songCreditLine(song)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* 方向 C 列表视图：古籍目录引线风格 */
            <div className="divide-y divide-slate-200/70 border-y border-slate-300/70 dark:divide-slate-800/70 dark:border-slate-800">
              {pageSongs.map((song, idx) => {
                const num =
                  (page - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE + idx + 1;
                return (
                  <div
                    key={song.id}
                    onClick={() => onOpenSong(song.id)}
                    className="group flex cursor-pointer items-center gap-4 py-3.5 transition-colors hover:bg-slate-900/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      No.{String(num).padStart(3, "0")}
                    </span>
                    <div className="h-11 w-11 shrink-0 overflow-hidden border border-slate-200/80 p-0.5 dark:border-slate-800">
                      <CoverArt
                        song={song}
                        sizes="44px"
                        className="grayscale-[30%] transition-[filter] duration-500 group-hover:grayscale-0"
                      />
                    </div>
                    <h3 className="shrink-0 font-serif text-base text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
                      {song.title}
                    </h3>
                    <span
                      aria-hidden
                      className="hidden h-px flex-1 border-b border-dotted border-slate-300/80 md:block dark:border-slate-700/80"
                    />
                    <span className="hidden max-w-56 truncate font-kaiti text-xs text-slate-500 sm:block dark:text-slate-400">
                      {songCreditLine(song)}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-slate-400 md:ml-0 dark:text-slate-500">
                      {song.year || "—"}
                    </span>
                    <span className="hidden w-12 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400 sm:block dark:text-slate-500">
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

        {/* 版记页脚 */}
        <footer className="mt-24 border-t border-slate-300/70 pt-8 dark:border-slate-800">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <SiteMark />
            <p className="font-kaiti text-xs tracking-[0.25em] text-slate-400 dark:text-slate-500">
              版记 · 凡录作品皆以初发年月为序，点击曲题即入详情卷
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
