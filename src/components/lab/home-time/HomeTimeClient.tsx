"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import SiteMark from "@/components/shared/SiteMark";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import TopBar from "@/components/shared/topbar/TopBar";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { OverlayHostContext } from "@/components/ui/overlay-host";
import { useLibraryDeferred } from "@/hooks/library/useLibraryDeferred";
import { useLibraryResults } from "@/hooks/library/useLibraryResults";
import { useLibraryState } from "@/hooks/library/useLibraryState";
import { useLyricsLines } from "@/hooks/library/useLyricsLines";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { flushUrlState, useUrlState } from "@/hooks/utils/useUrlState";
import { Link, useRouter } from "@/i18n/navigation";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import {
  buildBaseOptions,
  FACET_KEYS,
  type FacetOption,
  isSelectionActive,
  mapFacets,
} from "@/lib/library/filters";
import { needsDeferred } from "@/lib/library/url-state";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import { cn } from "@/lib/utils/utils";
import { enumLabel } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React, { useCallback, useMemo, useState } from "react";
import ColorTapestry from "./ColorTapestry";
import YearChapters, { type ReadingMode } from "./YearChapters";
import { byDate, byDateDesc, groupByYear } from "./timeline";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

const FEATURE_LINKS = [
  { href: "/story/qjtx", label: "倾尽天下", dot: "#9E3636" },
  { href: "/imagery", label: "意象词云", dot: "#286B62" },
  { href: "/quiz", label: "寻曲", dot: "#9A6728" },
];

/**
 * 首页原型「二十年的颜色 · 时间长卷」：
 * 把原先 /lab/time 割裂的「20 屏暗场展厅」与「6 列缩略图货架」熔为一体：
 * 1. 卷首只占半屏以内：用 cover-colors.json 将全部作品织成一条真实色彩光谱（可滑、可点、搜歌实时显影）；
 * 2. 紧贴其下即完整吸顶搜索与高级筛选（宽屏展开，手机走底部抽屉），0 门槛查歌；
 * 3. 正文彻底去货架：一年一章，左栏一幅带色彩弥散的动态大画幅（随右侧悬停实时切换）+ 右栏清疏编年书目；
 * 4. 完整支持浅色宣纸画册与深色暗场展厅双主题，与歌曲详情页无缝衔接。
 */
export default function HomeTimeClient({ songs }: { songs: Song[] }) {
  const router = useRouter();
  const locale = useLocale();
  const tLib = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const isDesktop = useIsDesktop();
  const { showScrollTop, scrollToTop } = useScrollTop();
  const { containerRef: tabRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>("index");
  const [activeYearKey, setActiveYearKey] = useState<string | null>(null);
  const [spotlightColor, setSpotlightColor] = useState<string | null>(null);

  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

  // ── 完整曲库检索与筛选状态（复用正式首页全部能力） ──
  const [params] = useUrlState();
  const deferred = useLibraryDeferred(
    songs,
    searchFocused || needsDeferred(params),
  );
  const { engine, SongFilters } = deferred;
  const baseOptions = useMemo(() => buildBaseOptions(songs), [songs]);
  const options = useMemo(
    () => ({
      ...baseOptions,
      facets: engine?.facetOptions ?? NO_FACET_OPTIONS,
    }),
    [baseOptions, engine],
  );
  const state = useLibraryState(options, engine?.normalize);
  const lyrics = useLyricsLines({
    locale,
    wanted: searchFocused || state.query !== "",
    engine,
  });
  const { results, available, getLyricsSnippet, approximate, lyricsPending } =
    useLibraryResults({
      songs,
      query: state.query,
      filters: state.filters,
      engine,
      corpus: lyrics.corpus,
      lyricsState: lyrics.state,
      withAvailable: state.advanced,
    });

  const filtering = state.isAnyFilterActive || state.query !== "";
  const matched = useMemo(
    () => (filtering ? new Set(results.map((s) => s.id)) : null),
    [filtering, results],
  );

  // 高级筛选中已激活维度数
  const activeAdvancedCount = useMemo(() => {
    let n = state.filters.year ? 1 : 0;
    for (const k of FACET_KEYS) {
      if (isSelectionActive(state.filters.facets[k])) n += 1;
    }
    return n;
  }, [state.filters]);

  // ── 二十年时间脉络：光谱与下方分章共享同一时间方向 ──
  const catalog = useMemo(() => {
    const valid = songs.filter((s) => !s.dispute_note);
    return valid.slice().sort(newestFirst ? byDateDesc : byDate);
  }, [songs, newestFirst]);

  const { firstYear, lastYear } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of songs) {
      if (s.year && !s.dispute_note) {
        if (s.year < min) min = s.year;
        if (s.year > max) max = s.year;
      }
    }
    return {
      firstYear: Number.isFinite(min) ? min : 2007,
      lastYear: Number.isFinite(max) ? max : 2026,
    };
  }, [songs]);

  const chapters = useMemo(() => {
    const years: (number | null)[] = [];
    for (let y = firstYear; y <= lastYear; y++) years.push(y);
    if (newestFirst) years.reverse();
    if (songs.some((s) => !s.year && !s.dispute_note)) years.push(null);
    return groupByYear(
      songs.filter((s) => !s.dispute_note),
      years,
      newestFirst,
    );
  }, [songs, firstYear, lastYear, newestFirst]);

  const shownCount = matched
    ? results.filter((s) => !s.dispute_note).length
    : catalog.length;

  const handleOpenSong = useCallback(
    (songId: number) => {
      bumpNavDepth();
      flushUrlState();
      router.push(`/song/${songId}`);
    },
    [router],
  );

  const jumpToYear = useCallback((year: number | null) => {
    const key = String(year ?? "unknown");
    document
      .getElementById(`y${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleReset = useCallback(() => {
    state.resetAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  const filterPanel = SongFilters ? (
    <SongFilters
      options={options}
      checked={state.checked}
      onFacetChange={state.setFacetChecked}
      available={available}
      yearSlider={state.yearSlider}
      onYearChange={state.setYearSlider}
    />
  ) : (
    <div aria-hidden className="h-60 lg:h-26" />
  );

  return (
    <OverlayHostContext.Provider value={overlayHost}>
      <div className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] transition-colors duration-500 dark:bg-[#0B0F19]">
        {/* 顶部极柔色彩雾面：平时淡墨蓝，滑过色带时轻染那首歌的真实主色 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] transition-all duration-1000 ease-out"
          style={{
            background: spotlightColor
              ? `radial-gradient(ellipse 68% 46% at 50% 0%, color-mix(in oklab, ${spotlightColor} 22%, transparent), transparent 72%)`
              : "radial-gradient(ellipse 68% 46% at 24% 0%, color-mix(in oklab, var(--tone) 13%, transparent), transparent 72%)",
          }}
        />

        <TopBar
          exit={{ kind: "logo", onClick: handleReset, tooltip: "回到卷首" }}
          nav={
            <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-slate-400 sm:inline-flex dark:text-slate-500">
              <span aria-hidden>/</span>
              <span>二十年的颜色</span>
            </span>
          }
        />

        <main className="relative mx-auto max-w-7xl px-6 pb-28 pt-26 md:pt-32">
          {/* ── 1. 卷首：极凝练刊头 + 三径轻入口 ── */}
          <header className="pb-8 md:pb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-[11px] tracking-[0.38em] text-(--tone) sm:text-xs">
                河图 · 作品勘鉴
              </p>

              {/* 三大特辑作为书眉轻游径：干净克制，绝不劈裂页面 */}
              <nav
                aria-label="站点特辑"
                className="flex items-center gap-4 text-xs tracking-[0.22em] text-slate-500 sm:gap-6 dark:text-slate-400"
              >
                {FEATURE_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group inline-flex items-center gap-1.5 transition-colors hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full opacity-75 transition-transform duration-300 group-hover:scale-125"
                      style={{ backgroundColor: item.dot }}
                    />
                    <span className="font-serif">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <h1 className="font-serif text-4xl font-semibold leading-none tracking-tight tabular-nums text-slate-900 sm:text-5xl md:text-6xl dark:text-slate-50">
                  {newestFirst ? lastYear : firstYear}
                  <span className="mx-[0.22em] font-light text-slate-300 dark:text-slate-700">
                    —
                  </span>
                  {newestFirst ? firstYear : lastYear}
                </h1>
                <span className="font-serif text-sm tracking-[0.18em] text-slate-400 sm:text-base dark:text-slate-500">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={shownCount}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        "inline-block font-semibold tabular-nums",
                        matched
                          ? "text-(--tone)"
                          : "text-slate-800 dark:text-slate-200",
                      )}
                    >
                      {shownCount}
                    </motion.span>
                  </AnimatePresence>
                  {matched ? ` / ${catalog.length}` : ""} 曲
                </span>
              </div>

              <p className="hidden font-kaiti text-sm text-slate-400 lg:block dark:text-slate-500">
                从二〇〇七年的第一首，唱到二〇二六年的这一首。
              </p>
            </div>
          </header>

          {/* ── 2. 二十年的颜色光谱（核心视觉与时间索引） ── */}
          <ColorTapestry
            songs={catalog}
            matched={matched}
            onJumpToYear={jumpToYear}
            onSpotlightColor={setSpotlightColor}
          />

          {/* ── 3. 完整吸顶检目栏（紧贴光谱之下，0 门槛查歌与筛选） ── */}
          <div className="sticky top-(--nav-h) z-30 -mx-6 mt-6 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-md dark:bg-[#0B0F19]/95">
            <div
              className={cn(
                TAB_HAIRLINE_CLASS,
                "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
              )}
            >
              {/* 类型标签 */}
              <div
                ref={tabRef}
                {...dragHandlers}
                className="no-scrollbar flex h-11 min-w-0 cursor-grab gap-6 overflow-x-auto mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)] after:w-2 after:shrink-0 active:cursor-grabbing md:h-full md:mask-none md:after:hidden"
              >
                {options.types.map((opt) => {
                  if (opt === FILTER_OPTION_ALL && state.isAnyFilterActive) {
                    return (
                      <button
                        key="reset"
                        type="button"
                        onClick={(event) => {
                          if (hasDraggedRef.current) {
                            event.preventDefault();
                            return;
                          }
                          handleReset();
                        }}
                        className="relative flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap font-serif text-[15px] tracking-wider text-(--tone) transition-opacity hover:opacity-75"
                      >
                        <RotateCcw size={13} />
                        {tLib("reset")}
                      </button>
                    );
                  }

                  const active = state.filters.type === opt;
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
                      aria-pressed={active}
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        state.setType(opt);
                      }}
                      className={cn(
                        "relative flex h-full shrink-0 items-center whitespace-nowrap font-serif text-[15px] tracking-wider transition-colors select-none",
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

              {/* 搜索 + 高级筛选 */}
              <div
                className={cn(
                  TAB_HAIRLINE_CLASS,
                  "flex h-11 items-center gap-1 md:ml-auto md:h-full md:before:hidden",
                )}
              >
                <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-64 md:flex-none">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder={tLib("search.placeholder")}
                    value={state.searchInput}
                    onFocus={handleSearchFocus}
                    onChange={(e) => state.setSearchInput(e.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                  {state.searchInput ? (
                    <button
                      type="button"
                      onClick={() => state.setSearchInput("")}
                      aria-label="清空搜索"
                      className="shrink-0 p-1 text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                    >
                      <XCircle size={14} />
                    </button>
                  ) : lyrics.state === "loading" ? (
                    <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600" />
                  ) : lyrics.state === "ready" ? (
                    <Mic2
                      size={13}
                      className="shrink-0 text-(--tone) opacity-55"
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
                  />
                </label>

                <span
                  aria-hidden
                  className="mx-2 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
                />

                <button
                  type="button"
                  onClick={() => state.setAdvanced(!state.advanced)}
                  aria-pressed={state.advanced}
                  title={tLib("advancedFilter")}
                  className={cn(
                    NAV_BUTTON_CLASS,
                    "inline-flex shrink-0 items-center gap-1.5",
                    (state.advanced || activeAdvancedCount > 0) &&
                      "text-(--tone) dark:text-(--tone)",
                  )}
                >
                  {state.advanced && isDesktop ? (
                    <X size={17} />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}
                  <span className="text-xs tracking-widest">
                    筛选
                    {activeAdvancedCount > 0 && (
                      <span className="ml-1 font-mono tabular-nums">
                        ({activeAdvancedCount})
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {state.advanced && isDesktop && (
              <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/70 pb-6 pt-5 duration-300 dark:border-slate-800">
                {filterPanel}
              </div>
            )}
          </div>

          {/* 移动端底部抽屉承载高级筛选 */}
          {!isDesktop && (
            <Drawer open={state.advanced} onOpenChange={state.setAdvanced}>
              <DrawerContent title={tLib("advancedFilter")}>
                <div className="pt-2">{filterPanel}</div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-200/75 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!state.isAnyFilterActive}
                    className="text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-40 dark:text-slate-500 dark:hover:text-slate-200"
                  >
                    {tLib("filter.clearAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => state.setAdvanced(false)}
                    className="rounded-full bg-(--tone) px-5 py-2 text-xs tracking-[0.2em] text-white dark:text-slate-950"
                  >
                    查看 {shownCount} 首
                  </button>
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {/* 极轻的阅读次序与书目排版微切换（方便你对比行目 vs 排印） */}
          <div className="mt-5 mb-2 flex flex-wrap items-center justify-between gap-4 text-xs tracking-[0.22em]">
            <div className="flex items-center gap-4">
              {(
                [
                  ["index", "编年目录"],
                  ["prose", "诗集排印"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={readingMode === mode}
                  onClick={() => setReadingMode(mode)}
                  className={cn(
                    "transition-colors",
                    readingMode === mode
                      ? "text-(--tone)"
                      : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {(
                [
                  [true, "由近及远"],
                  [false, "由远及近"],
                ] as const
              ).map(([desc, label]) => (
                <button
                  key={String(desc)}
                  type="button"
                  aria-pressed={newestFirst === desc}
                  onClick={() => setNewestFirst(desc)}
                  className={cn(
                    "transition-colors",
                    newestFirst === desc
                      ? "text-(--tone)"
                      : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {approximate && (
            <p className="mt-4 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {tLib("search.approximate")}
            </p>
          )}

          {/* ── 4. 编年分章正文（一年一画幅 + 右侧书目，零货架感） ── */}
          {shownCount === 0 ? (
            <p className="py-24 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {lyricsPending
                ? tLib("search.lyricsPending")
                : tLib("noFilteredSongs")}
            </p>
          ) : (
            <YearChapters
              chapters={chapters}
              matched={matched}
              readingMode={readingMode}
              onOpenSong={handleOpenSong}
              getLyricsSnippet={getLyricsSnippet}
              onActiveYearChange={setActiveYearKey}
            />
          )}

          {lyricsPending && shownCount > 0 && (
            <p className="mt-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {tLib("search.lyricsPending")}
            </p>
          )}

          <footer className="mt-14 flex flex-wrap items-baseline justify-between gap-4 border-t border-slate-200/75 pt-8 dark:border-slate-800">
            <SiteMark />
            <p className="font-kaiti text-sm text-slate-400 dark:text-slate-500">
              未完。
            </p>
          </footer>
        </main>

        {/* 宽屏右侧悬浮年份标尺：随时跨越二十年 */}
        <nav
          aria-label="年份标尺"
          className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-1 xl:flex"
        >
          {chapters.map((ch) => {
            const key = String(ch.year ?? "unknown");
            const active = activeYearKey === key;
            const hasHit =
              matched === null || ch.songs.some((s) => matched.has(s.id));
            return (
              <button
                key={key}
                type="button"
                onClick={() => jumpToYear(ch.year)}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[10px] tabular-nums tracking-wider transition-colors duration-300",
                  active
                    ? "text-(--tone)"
                    : hasHit
                      ? "text-slate-400/60 hover:text-slate-800 dark:text-slate-500/60 dark:hover:text-slate-200"
                      : "text-slate-300/40 dark:text-slate-700/50",
                )}
              >
                {active && <span className="h-px w-3 bg-(--tone)" />}
                {ch.year ?? "未详"}
              </button>
            );
          })}
        </nav>

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
