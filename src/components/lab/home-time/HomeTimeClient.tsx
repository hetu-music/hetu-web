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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exhibit, ExhibitRail, FilmGrain, Overture } from "./Stage";
import { byDate, groupByYear, pickExhibits, stripeColor } from "./timeline";
import YearChapters from "./YearChapters";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

/**
 * 首页原型「暗场」：
 * 开场全黑，一束光照亮最近的一件作品；往下是「二十年，二十件」，每年一件，
 * 进到画面中央时灯亮起、封面的颜色在黑暗里晕开，离开时暗下去；
 * 最后是全部馆藏，沿用现有曲库的搜索与筛选。整页固定为深色。
 */
export default function HomeTimeClient({ songs }: { songs: Song[] }) {
  const router = useRouter();
  const locale = useLocale();
  const { showScrollTop, scrollToTop } = useScrollTop();
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

  // ── 馆藏：与现有首页同一套状态 ──
  const [params, , urlSynced] = useUrlState();
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

  // ── 展 ──
  const catalog = useMemo(
    () => songs.filter((s) => s.year && !s.dispute_note).sort(byDate),
    [songs],
  );
  const exhibits = useMemo(() => pickExhibits(songs), [songs]);
  const overtureSong = useMemo(
    () => [...catalog].reverse().find((s) => stripeColor(s)) ?? catalog[0],
    [catalog],
  );
  const [activeExhibit, setActiveExhibit] = useState(0);
  const [railVisible, setRailVisible] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const collectionRef = useRef<HTMLElement>(null);

  // 展线只在看展的那一段出现
  useEffect(() => {
    const onScroll = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      setRailVisible(
        r.top < window.innerHeight * 0.4 && r.bottom > window.innerHeight * 0.6,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── 馆藏分章 ──
  const firstYear = catalog[0]?.year ?? 2007;
  const lastYear = catalog[catalog.length - 1]?.year ?? 2026;
  const chapters = useMemo(() => {
    const years: (number | null)[] = [];
    for (let y = firstYear; y <= lastYear; y++) years.push(y);
    if (newestFirst) years.reverse();
    if (songs.some((s) => !s.year)) years.push(null);
    return groupByYear(songs, years);
  }, [songs, firstYear, lastYear, newestFirst]);

  const shownCount = matched
    ? results.filter((s) => !s.dispute_note).length
    : catalog.length;
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

  const scrollToEl = (el: Element | null) =>
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  const goCollection = useCallback(() => scrollToEl(collectionRef.current), []);
  const goExhibit = useCallback(
    (year: number) => scrollToEl(document.getElementById(`ex${year}`)),
    [],
  );

  // 带着搜索或筛选打开（比如从详情页返回），直接落在馆藏
  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current || !urlSynced) return;
    landedRef.current = true;
    if (filtering) collectionRef.current?.scrollIntoView({ block: "start" });
  }, [urlSynced, filtering]);

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
      <div className="dark relative min-h-screen overflow-x-clip bg-[#07090F] text-slate-200">
        <TopBar exit={{ kind: "logo", onClick: handleReset }} />
        <FilmGrain />

        {overtureSong && (
          <Overture
            song={overtureSong}
            total={catalog.length}
            onOpenSong={handleOpenSong}
            onEnter={() => goExhibit(exhibits[0]?.year ?? firstYear)}
            onCollection={goCollection}
          />
        )}

        {/* ── 二十年，二十件 ── */}
        <div ref={stageRef}>
          <div className="mx-auto max-w-7xl px-6 pt-24 pb-4">
            <p className="text-xs tracking-[0.5em] text-white/35">
              二十年 · 二十件
            </p>
          </div>
          {exhibits.map((song, i) => (
            <Exhibit
              key={song.id}
              song={song}
              index={i}
              count={exhibits.length}
              onOpenSong={handleOpenSong}
              onActive={setActiveExhibit}
            />
          ))}
        </div>

        <ExhibitRail
          years={exhibits.map((s) => s.year ?? 0)}
          active={activeExhibit}
          visible={railVisible}
          onJump={goExhibit}
          onCollection={goCollection}
        />

        {/* ── 馆藏 ── */}
        <section
          ref={collectionRef}
          className="scroll-mt-(--nav-h) bg-gradient-to-b from-[#07090F] to-[#0B0F19] to-[40rem]"
        >
          <div className="mx-auto max-w-7xl px-6 pb-28">
            <header className="pt-32 pb-14">
              <p className="text-xs tracking-[0.5em] text-white/35">馆藏</p>
              <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                全部作品
                <span className="ml-5 align-middle font-serif text-xl font-normal tabular-nums text-white/40">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={shownCount}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.28 }}
                      className={cn("inline-block", matched && "text-(--tone)")}
                    >
                      {shownCount}
                    </motion.span>
                  </AnimatePresence>
                  {matched ? ` / ${catalog.length}` : ""} 首
                </span>
              </h2>
            </header>

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
                      : "text-slate-500 hover:text-slate-200",
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

            <footer className="mt-10 flex items-baseline justify-between border-t border-slate-800 pt-8">
              <SiteMark />
              <p className="font-kaiti text-sm text-slate-500">未完。</p>
            </footer>
          </div>
        </section>

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
