"use client";

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
import { Link, useRouter } from "@/i18n/navigation";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import { MUSIC_LIBRARY_ITEMS_PER_PAGE } from "@/lib/constants";
import {
  buildBaseOptions,
  type FacetOption,
  mapFacets,
} from "@/lib/library/filters";
import { needsDeferred } from "@/lib/library/url-state";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import { cn } from "@/lib/utils/utils";
import { type CoverTone, INK_TONE } from "@/lib/utils/utils-tone";
import { RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CatalogSection from "./CatalogSection";
import HeroCoverFlow from "./HeroCoverFlow";
import HeroMosaicCurtain from "./HeroMosaicCurtain";
import TriptychStrip from "./TriptychStrip";
import {
  type HeroConcept,
  TRIPTYCH_ITEMS,
  buildFeaturedEntries,
  computeArchiveStats,
  countActiveAdvancedFilters,
} from "./shared";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

const CONCEPTS: Array<{ id: HeroConcept; label: string }> = [
  { id: "coverflow", label: "构想一 · 立体唱片台" },
  { id: "mosaic", label: "构想二 · 流光声廊" },
];

interface HomeDemosClientProps {
  songs: Song[];
  gallery: GallerySong[];
}

/**
 * 首页重设计对比原型（构想一 立体唱片台 vs 构想二 流光声廊）：
 * 完整接入真实的曲库检索内核、歌词搜索与 5 维高级筛选（移动端走底部抽屉）。
 */
export default function HomeDemosClient({
  songs,
  gallery,
}: HomeDemosClientProps) {
  const router = useRouter();
  const locale = useLocale();
  const { showScrollTop, scrollToTop } = useScrollTop();
  const listStartRef = useRef<HTMLDivElement>(null);
  const toolbarSearchRef = useRef<HTMLInputElement>(null);

  const [concept, setConcept] = useState<HeroConcept>("coverflow");
  const [tone, setTone] = useState<CoverTone | null>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

  const handleJumpToSearch = useCallback(() => {
    setSearchFocused(true);
    listStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toolbarSearchRef.current?.focus({ preventScroll: true });
  }, []);

  // ── 完整接入真实曲库状态、三档懒加载搜索内核与歌词检索 ──
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

  const {
    results,
    available,
    getLyricsSnippet,
    pending,
    approximate,
    lyricsPending,
  } = useLibraryResults({
    songs,
    query: state.query,
    filters: state.filters,
    engine,
    corpus: lyrics.corpus,
    lyricsState: lyrics.state,
    withAvailable: state.advanced,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(results.length / MUSIC_LIBRARY_ITEMS_PER_PAGE),
  );
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const { setPage, resetAll } = state;

  useEffect(() => {
    if (!pending && !lyricsPending && safePage !== state.page) {
      setPage(safePage);
    }
  }, [pending, lyricsPending, safePage, state.page, setPage]);

  const pageSongs = useMemo(() => {
    const start = (safePage - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE;
    return results.slice(start, start + MUSIC_LIBRARY_ITEMS_PER_PAGE);
  }, [results, safePage]);

  const featured = useMemo(
    () => buildFeaturedEntries(songs, gallery),
    [songs, gallery],
  );
  const stats = useMemo(() => computeArchiveStats(songs), [songs]);
  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedFilters(state.filters),
    [state.filters],
  );

  const handleReset = useCallback(() => {
    resetAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resetAll]);

  const handleOpenSong = useCallback(
    (songId: number) => {
      bumpNavDepth();
      flushUrlState();
      router.push(`/song/${songId}`);
    },
    [router],
  );

  const handleRandomSong = useCallback(() => {
    const pool = songs.filter((s) => !s.dispute_note);
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    handleOpenSong(picked.id);
  }, [songs, handleOpenSong]);

  const appliedTone = tone ?? INK_TONE;
  // 进入搜索、筛选或翻到第 2 页以后，首屏与特辑自然收敛，直达曲库
  const showHero = !state.isAnyFilterActive && safePage === 1;

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
      <div
        className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] transition-colors duration-500 [--tone:var(--tone-light)] dark:bg-[#0B0F19] dark:[--tone:var(--tone-dark)]"
        style={
          {
            "--tone-light": appliedTone.light,
            "--tone-dark": appliedTone.dark,
          } as React.CSSProperties
        }
      >
        {/* 顶部封面实时取色光晕（同详情页的 wash 语言） */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[56rem] transition-opacity duration-1400 ease-out"
          style={{
            opacity: tone ? 1 : 0.45,
            background: `radial-gradient(ellipse 72% 48% at 50% 6%, ${appliedTone.wash}, transparent 72%), radial-gradient(ellipse 46% 38% at 15% 12%, ${appliedTone.wash}, transparent 70%)`,
          }}
        />

        <TopBar
          exit={{
            kind: "logo",
            onClick: handleReset,
            tooltip: "回到卷首",
          }}
          nav={
            <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-slate-400 sm:inline-flex dark:text-slate-500">
              <span aria-hidden>/</span>
              <span>首页首屏方案对比</span>
            </span>
          }
        />

        <main className="relative mx-auto max-w-7xl px-6 pb-32 pt-24 md:pt-28">
          {showHero ? (
            <>
              {concept === "coverflow" ? (
                <HeroCoverFlow
                  featured={featured}
                  stats={stats}
                  onToneChange={setTone}
                  onOpenSong={handleOpenSong}
                  onRandomSong={handleRandomSong}
                />
              ) : (
                <HeroMosaicCurtain
                  songs={songs}
                  wallSongs={gallery}
                  featured={featured}
                  stats={stats}
                  onJumpToSearch={handleJumpToSearch}
                  onToneChange={setTone}
                  onOpenSong={handleOpenSong}
                  onRandomSong={handleRandomSong}
                />
              )}

              <TriptychStrip />
            </>
          ) : (
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200/75 pb-4 pt-2 dark:border-slate-800/75">
              <div className="flex items-baseline gap-3">
                <h1 className="font-serif text-2xl text-slate-900 sm:text-3xl dark:text-slate-50">
                  谣歌 · 总录
                </h1>
                <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-(--tone)">
                  {results.length} 曲
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs tracking-[0.22em] text-slate-400 transition-colors hover:text-(--tone) dark:text-slate-500"
              >
                <RotateCcw size={13} />
                返回卷首
              </button>
            </div>
          )}

          <CatalogSection
            pageSongs={pageSongs}
            totalCount={results.length}
            types={options.types}
            activeType={state.filters.type}
            onTypeChange={state.setType}
            searchInput={state.searchInput}
            searchInputRef={toolbarSearchRef}
            onSearchChange={state.setSearchInput}
            onSearchFocus={handleSearchFocus}
            lyricsState={lyrics.state}
            isAnyFilterActive={state.isAnyFilterActive}
            activeAdvancedCount={activeAdvancedCount}
            onReset={handleReset}
            advanced={state.advanced}
            onAdvancedChange={state.setAdvanced}
            filterPanel={filterPanel}
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            listStartRef={listStartRef}
            onOpenSong={handleOpenSong}
            getLyricsSnippet={getLyricsSnippet}
            approximate={approximate}
            lyricsPending={lyricsPending}
            showHeading={showHero}
          />

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

        {/* 底部居中对比切换坞：一键切换 构想一 / 构想二 */}
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div
            role="tablist"
            aria-label="首页首屏构想切换"
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200/90 bg-[#FAFAFA]/92 p-1.5 shadow-[0_14px_40px_-10px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/15 dark:bg-[#0B0F19]/92 dark:shadow-[0_14px_40px_-10px_rgba(0,0,0,0.85)]"
          >
            {CONCEPTS.map((item) => {
              const active = concept === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setConcept(item.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs tracking-wider transition-all duration-300 sm:px-4",
                    active
                      ? "bg-slate-900 font-medium text-white shadow-xs dark:bg-white dark:text-slate-950"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />

        {/* 让移动端筛选抽屉继承页面根容器上的动态 --tone */}
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
