"use client";

import LibraryToolbar from "@/components/library/LibraryToolbar";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import { OverlayHostContext } from "@/components/ui/overlay-host";
import { useLibraryDeferred } from "@/hooks/library/useLibraryDeferred";
import { useLibraryResults } from "@/hooks/library/useLibraryResults";
import { useLibraryState } from "@/hooks/library/useLibraryState";
import { useLyricsLines } from "@/hooks/library/useLyricsLines";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { flushUrlState, useUrlState } from "@/hooks/utils/useUrlState";
import { useRouter } from "@/i18n/navigation";
import {
  buildBaseOptions,
  type FacetOption,
  mapFacets,
} from "@/lib/library/filters";
import { needsDeferred } from "@/lib/library/url-state";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import TimeBand from "./TimeBand";
import { byDate, groupByYear } from "./timeline";
import YearChapters from "./YearChapters";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

/**
 * 首页原型「二十年的颜色」：
 * 首屏是一条色带，一首歌一根，颜色取自封面，从 2007 排到 2026；
 * 往下是一年一章的曲库，每章的题头是这一年的那一段色带。
 * 搜索与筛选沿用现有曲库的全部逻辑，命中的歌在色带和正文里亮着，没有命中的年份折成一行。
 */
export default function HomeTimeClient({ songs }: { songs: Song[] }) {
  const router = useRouter();
  const locale = useLocale();
  const { showScrollTop, scrollToTop } = useScrollTop();
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

  // ── 曲库状态：与现有首页同一套 ──
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
  const { results, available, getLyricsSnippet } = useLibraryResults({
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

  // ── 时间 ──
  const bandSongs = useMemo(
    () => songs.filter((s) => s.year && !s.dispute_note).sort(byDate),
    [songs],
  );
  const firstYear = bandSongs[0]?.year ?? 2007;
  const lastYear = bandSongs[bandSongs.length - 1]?.year ?? 2026;
  const chapters = useMemo(() => {
    const years: (number | null)[] = [];
    for (let y = firstYear; y <= lastYear; y++) years.push(y);
    if (newestFirst) years.reverse();
    if (songs.some((s) => !s.year)) years.push(null);
    return groupByYear(songs, years);
  }, [songs, firstYear, lastYear, newestFirst]);

  const catalogCount = bandSongs.length;
  const shownCount = matched
    ? results.filter((s) => !s.dispute_note).length
    : catalogCount;
  const playKey = useMemo(
    () => JSON.stringify([state.query, state.filters]),
    [state.query, state.filters],
  );

  const handleOpenSong = useCallback(
    (songId: number) => {
      bumpNavDepth();
      flushUrlState();
      router.push(`/song/${songId}`);
    },
    [router],
  );

  const jumpToYear = useCallback((year: number) => {
    document
      .getElementById(`y${year}`)
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
      <div className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19]">
        <TopBar exit={{ kind: "logo", onClick: handleReset }} />

        {/* ── 首屏：二十年的颜色 ── */}
        <section className="flex min-h-svh flex-col pt-[calc(var(--nav-h)+2.5rem)] pb-10 md:pt-[calc(var(--nav-h)+4rem)]">
          <div className="mx-auto w-full max-w-7xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            >
              <p className="text-xs tracking-[0.35em] text-(--tone)">
                河图 · 作品勘鉴
              </p>
              <h1 className="mt-5 font-serif text-5xl font-semibold leading-[1.1] tracking-tight tabular-nums text-slate-900 sm:text-7xl xl:text-8xl dark:text-slate-50">
                {firstYear}
                <span className="mx-[0.3em] font-light text-slate-300 dark:text-slate-700">
                  —
                </span>
                {lastYear}
              </h1>
              <p className="mt-5 font-kaiti text-base text-slate-500 md:text-lg dark:text-slate-400">
                二十年，
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={shownCount}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.28 }}
                    className={cn(
                      "inline-block font-serif tabular-nums",
                      matched && "text-(--tone)",
                    )}
                  >
                    {shownCount}
                  </motion.span>
                </AnimatePresence>
                {matched ? ` / ${catalogCount} 首。` : " 首歌，一首一色。"}
              </p>
            </motion.div>
          </div>

          <div className="mt-auto w-full px-0 pt-12 sm:px-6 lg:px-12">
            <TimeBand
              songs={bandSongs}
              matched={matched}
              onOpenSong={handleOpenSong}
              onJumpYear={jumpToYear}
            />
          </div>
        </section>

        {/* ── 正文：一年一章 ── */}
        <main className="mx-auto max-w-7xl px-6 pb-28">
          <LibraryToolbar
            types={options.types}
            type={state.filters.type}
            onTypeChange={state.setType}
            isAnyFilterActive={state.isAnyFilterActive}
            onReset={handleReset}
            searchInput={state.searchInput}
            onSearchChange={state.setSearchInput}
            onSearchFocus={handleSearchFocus}
            lyricsState={lyrics.state}
            advanced={state.advanced}
            onAdvancedChange={state.setAdvanced}
            view={state.view}
            onViewChange={state.setView}
          >
            {filterPanel}
          </LibraryToolbar>

          <div className="-mt-4 mb-2 flex justify-end gap-5 text-xs tracking-widest">
            {[false, true].map((desc) => (
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
                {desc ? "由近及远" : "由远及近"}
              </button>
            ))}
          </div>

          <YearChapters
            chapters={chapters}
            matched={matched}
            view={state.view}
            playKey={playKey}
            onOpenSong={handleOpenSong}
            getLyricsSnippet={getLyricsSnippet}
          />

          <footer className="mt-10 flex items-baseline justify-between border-t border-slate-200/70 pt-8 dark:border-slate-800">
            <SiteMark />
            <p className="font-kaiti text-sm text-slate-400 dark:text-slate-500">
              未完。
            </p>
          </footer>
        </main>

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
