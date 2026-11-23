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
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
} from "@/lib/constants";
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
import { enumLabel } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { usePlayerStore } from "@/store/player-store";
import { AnimatePresence, motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CatalogGallery from "./CatalogGallery";
import ChronologySpectrum from "./ChronologySpectrum";
import {
  FEATURE_PLATES,
  buildPoetryEntries,
  computeArchiveStats,
  countActiveAdvancedFilters,
} from "./shared";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

interface HomeDemosClientProps {
  songs: Song[];
  gallery: GallerySong[];
}

/**
 * 首页重设计原型：「二十年光阴声谱 × 联动画册」
 *
 * 彻底消除“上截门面、下截曲库”的割裂：
 * - 活刊头随当前搜索/筛选实时改写；
 * - 二十年光阴声谱（左新右旧）既是视觉艺术主角，又是点拖年份筛选器与实时检索星图；
 * - 下方画册曲库自然织入留白诗格与三大特辑彩插页，悬停任意唱片同步点亮声谱与全页封面光晕。
 */
export default function HomeDemosClient({
  songs,
  gallery,
}: HomeDemosClientProps) {
  const router = useRouter();
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const { showScrollTop, scrollToTop } = useScrollTop();
  const { currentTrack, isPlaying } = usePlayerStore();
  const listStartRef = useRef<HTMLDivElement>(null);

  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [poetryIdx, setPoetryIdx] = useState(0);

  // 悬停曲库封面时的反向联动：声谱高亮 + 柔和防抖的封面取色光晕
  const [hoveredSong, setHoveredSong] = useState<Song | null>(null);
  const [tone, setTone] = useState<CoverTone | null>(null);
  const toneCacheRef = useRef<Map<number, CoverTone>>(new Map());
  const toneTimerRef = useRef<number | null>(null);

  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

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

  const stats = useMemo(() => computeArchiveStats(songs), [songs]);
  const poetryList = useMemo(
    () => buildPoetryEntries(songs, gallery),
    [songs, gallery],
  );
  const activePoetry =
    poetryList.length > 0 ? poetryList[poetryIdx % poetryList.length] : null;

  const activeAdvancedCount = useMemo(
    () => countActiveAdvancedFilters(state.filters),
    [state.filters],
  );

  const hasNonYearFilter = useMemo(
    () =>
      state.query !== "" ||
      state.filters.type !== FILTER_OPTION_ALL ||
      FACET_KEYS.some((k) => isSelectionActive(state.filters.facets[k])),
    [state.query, state.filters],
  );

  // 当前正在播放的曲目（无悬停时也可作为声谱的轻柔焦点）
  const playingSong = useMemo(() => {
    if (!isPlaying || !currentTrack) return null;
    return songs.find((s) => s.id === currentTrack.songId) ?? null;
  }, [isPlaying, currentTrack, songs]);

  const handleHoverSong = useCallback(
    (song: Song | null, imgEl?: HTMLImageElement | null) => {
      setHoveredSong(song);
      if (toneTimerRef.current !== null) {
        window.clearTimeout(toneTimerRef.current);
        toneTimerRef.current = null;
      }
      if (!song) return;

      const cached = toneCacheRef.current.get(song.id);
      // 略作 160ms 停留防抖：快速划过封面墙时不乱闪，目光停住时水墨缓缓晕开
      toneTimerRef.current = window.setTimeout(() => {
        if (cached) {
          setTone(cached);
          return;
        }
        if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
          const extracted = toneFromImage(imgEl) ?? INK_TONE;
          toneCacheRef.current.set(song.id, extracted);
          setTone(extracted);
        }
      }, 160);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toneTimerRef.current !== null) {
        window.clearTimeout(toneTimerRef.current);
      }
    };
  }, []);

  const handleReset = useCallback(() => {
    resetAll();
    setTone(null);
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

  // ── 活刊头：根据当前搜索、类型、年代、人名/曲风实时生成整页书题 ──
  const livingTitle = useMemo(() => {
    const parts: string[] = [];
    if (state.query) {
      parts.push(`「${state.query}」`);
    } else {
      if (state.filters.type !== FILTER_OPTION_ALL) {
        parts.push(
          state.filters.type === FILTER_OPTION_UNKNOWN
            ? tCommon("unknown")
            : enumLabel(tEnum, "type", state.filters.type),
        );
      }
      if (state.filters.year) {
        if (state.filters.year === "unknown") {
          parts.push("年份未知");
        } else {
          const { newest, oldest } = state.filters.year;
          if (newest !== null && newest === oldest) {
            parts.push(`${newest} 年`);
          } else {
            const left = newest ?? stats.newestYear ?? "";
            const right = oldest ?? stats.oldestYear ?? "未知";
            parts.push(`${left}—${right}`);
          }
        }
      }
      for (const key of FACET_KEYS) {
        const sel = state.filters.facets[key];
        if (sel.mode === "include" && sel.values.length > 0) {
          const first =
            key === "genre"
              ? enumLabel(tEnum, "genre", sel.values[0])
              : sel.values[0];
          parts.push(sel.values.length > 1 ? `${first}等` : first);
          if (parts.length >= 2) break;
        }
      }
    }

    if (parts.length === 0) return "谣歌";
    return parts.join(" · ");
  }, [
    state.query,
    state.filters,
    stats.newestYear,
    stats.oldestYear,
    tCommon,
    tEnum,
  ]);

  const appliedTone = tone ?? INK_TONE;
  const showEditorialPlates = !state.isAnyFilterActive && safePage === 1;

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
        {/* 顶层动态光场：常态淡墨蓝，悬停任意封面时随专辑主色缓缓晕开 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[54rem] transition-opacity duration-1400 ease-out"
          style={{
            opacity: tone ? 1 : 0.55,
            background: `radial-gradient(ellipse 68% 45% at 20% 0%, ${appliedTone.wash}, transparent 72%), radial-gradient(ellipse 52% 40% at 86% 10%, ${appliedTone.wash}, transparent 70%)`,
          }}
        />

        <TopBar
          exit={{
            kind: "logo",
            onClick: handleReset,
            tooltip: "回到卷首",
          }}
          nav={
            <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-ink-meta sm:inline-flex">
              <span aria-hidden>/</span>
              <span>光阴声谱原型</span>
            </span>
          }
        />

        <main className="relative mx-auto max-w-7xl px-6 pb-28 pt-26 md:pt-32">
          {/* ── 1. 活刊头：精炼大气，随检索与筛选实时重写 ── */}
          <header className="pb-4 md:pb-6">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2.5 text-[11px] tracking-[0.35em] text-(--tone) sm:text-xs">
                  <span>河图作品勘鉴</span>
                  {stats.newestYear && stats.oldestYear && (
                    <>
                      <span aria-hidden className="h-px w-4 bg-(--tone)/45" />
                      <span className="font-mono tabular-nums tracking-[0.2em]">
                        {stats.newestYear} — {stats.oldestYear}
                      </span>
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <AnimatePresence mode="wait">
                    <motion.h1
                      key={livingTitle}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                      className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl md:text-[3.5rem]"
                    >
                      {livingTitle}
                    </motion.h1>
                  </AnimatePresence>

                  <span className="font-serif text-sm tracking-[0.18em] text-ink-meta sm:text-base">
                    凡{" "}
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={results.length}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.28 }}
                        className="inline-block font-semibold tabular-nums text-(--tone)"
                      >
                        {results.length}
                      </motion.span>
                    </AnimatePresence>{" "}
                    曲
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <p className="hidden font-kaiti text-sm tracking-wider text-ink-meta lg:block">
                  你一定想知道，戏里讲了什么故事……
                </p>
                <span
                  aria-hidden
                  className="hidden h-3 w-px bg-slate-200 lg:block dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={handleRandomSong}
                  className="group inline-flex items-center gap-1.5 text-xs tracking-[0.22em] text-ink-muted transition-colors hover:text-(--tone) dark:hover:text-(--tone)"
                >
                  <Shuffle
                    size={13}
                    className="transition-transform duration-500 group-hover:rotate-180"
                  />
                  随缘一曲
                </button>
              </div>
            </div>
          </header>

          {/* ── 2. 二十年光阴声谱（左新右旧）：视觉艺术主角 × 年份筛选器 × 检索星图 ── */}
          <ChronologySpectrum
            years={options.years}
            allSongs={songs}
            matchedSongs={results}
            hasNonYearFilter={hasNonYearFilter}
            yearSlider={state.yearSlider}
            onYearChange={state.setYearSlider}
            focusedSong={hoveredSong ?? playingSong}
          />

          {/* ── 3. 联动画册曲库（含留白诗格与三大特辑彩插页） ── */}
          <CatalogGallery
            pageSongs={pageSongs}
            totalCount={results.length}
            types={options.types}
            activeType={state.filters.type}
            onTypeChange={state.setType}
            searchInput={state.searchInput}
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
            onHoverSong={handleHoverSong}
            getLyricsSnippet={getLyricsSnippet}
            approximate={approximate}
            lyricsPending={lyricsPending}
            showEditorialPlates={showEditorialPlates}
            poetryEntry={activePoetry}
            onCyclePoetry={() => setPoetryIdx((i) => i + 1)}
            canCyclePoetry={poetryList.length > 1}
          />

          {/* ── 4. 版记收束（同时保留三大特辑常驻入口，筛选翻页时也随手可达） ── */}
          <footer className="mt-24 border-t border-slate-200/75 pt-8 dark:border-slate-800/75">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <SiteMark />
              <div className="flex flex-wrap items-center gap-6 text-xs tracking-[0.25em] text-ink-meta">
                {FEATURE_PLATES.map((item) => (
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
