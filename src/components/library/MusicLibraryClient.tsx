"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import TopBar from "@/components/shared/topbar/TopBar";
import { useFilteredSongs } from "@/hooks/library/useFilteredSongs";
import { extractLyricsSnippetParts } from "@/hooks/library/useLyricsIndex";
import { useMusicLibraryState } from "@/hooks/library/useMusicLibraryState";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import type { MusicLibraryClientProps } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  calculateFilterOptions,
  countCatalogSongs,
  decodeFilterParam,
  encodeFilterParam,
} from "@/lib/utils/utils-song";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogGrid, CatalogList, FolioPager } from "./CatalogEntries";
import HeroSection from "./HeroSection";
import LibraryIndex, {
  IndexDrawerButton,
  type LibraryFilters,
  SearchField,
} from "./LibraryIndex";

/**
 * 主页：一部集子的扉页与总目。
 * 宽屏两栏同歌曲页：左栏检索，右栏总目；窄屏检索收进吸顶栏与底部面板。
 */
export default function MusicLibraryClient({
  initialSongsData,
}: MusicLibraryClientProps) {
  const router = useRouter();
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const { showScrollTop, scrollToTop } = useScrollTop();

  const filterOptions = useMemo(
    () => calculateFilterOptions(initialSongsData),
    [initialSongsData],
  );
  const sliderYears = useMemo(
    () => filterOptions.allYears.slice(1),
    [filterOptions.allYears],
  );

  const {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    yearRangeIndices,
    setYearRangeIndices,
    filterGenre: rawFilterGenre,
    setFilterGenre: setRawFilterGenre,
    filterLyricist: rawFilterLyricist,
    setFilterLyricist: setRawFilterLyricist,
    filterComposer: rawFilterComposer,
    setFilterComposer: setRawFilterComposer,
    filterArranger: rawFilterArranger,
    setFilterArranger: setRawFilterArranger,
    filterArtist: rawFilterArtist,
    setFilterArtist: setRawFilterArtist,
    viewMode,
    setViewMode,
    currentPage,
    setPaginationPage,
    resetAllFilters,
    handleSongClick,
    isRestoringScroll,
    notifyDataReady,
  } = useMusicLibraryState(sliderYears.length, DEFAULT_MUSIC_LIBRARY_VIEW_MODE);

  // 解码 URL 中的压缩/排除参数为完整选项数组
  const filterGenre = useMemo(
    () => decodeFilterParam(rawFilterGenre, filterOptions.allGenres),
    [rawFilterGenre, filterOptions.allGenres],
  );
  const setFilterGenre = useCallback(
    (genres: string[]) => {
      setRawFilterGenre(encodeFilterParam(genres, filterOptions.allGenres));
    },
    [setRawFilterGenre, filterOptions.allGenres],
  );

  const filterLyricist = useMemo(
    () => decodeFilterParam(rawFilterLyricist, filterOptions.allLyricists),
    [rawFilterLyricist, filterOptions.allLyricists],
  );
  const setFilterLyricist = useCallback(
    (lyricists: string[]) => {
      setRawFilterLyricist(
        encodeFilterParam(lyricists, filterOptions.allLyricists),
      );
    },
    [setRawFilterLyricist, filterOptions.allLyricists],
  );

  const filterComposer = useMemo(
    () => decodeFilterParam(rawFilterComposer, filterOptions.allComposers),
    [rawFilterComposer, filterOptions.allComposers],
  );
  const setFilterComposer = useCallback(
    (composers: string[]) => {
      setRawFilterComposer(
        encodeFilterParam(composers, filterOptions.allComposers),
      );
    },
    [setRawFilterComposer, filterOptions.allComposers],
  );

  const filterArranger = useMemo(
    () => decodeFilterParam(rawFilterArranger, filterOptions.allArrangers),
    [rawFilterArranger, filterOptions.allArrangers],
  );
  const setFilterArranger = useCallback(
    (arrangers: string[]) => {
      setRawFilterArranger(
        encodeFilterParam(arrangers, filterOptions.allArrangers),
      );
    },
    [setRawFilterArranger, filterOptions.allArrangers],
  );

  const filterArtist = useMemo(
    () => decodeFilterParam(rawFilterArtist, filterOptions.allArtists),
    [rawFilterArtist, filterOptions.allArtists],
  );
  const setFilterArtist = useCallback(
    (artists: string[]) => {
      setRawFilterArtist(encodeFilterParam(artists, filterOptions.allArtists));
    },
    [setRawFilterArtist, filterOptions.allArtists],
  );

  const {
    filteredSongs,
    lyricsMap,
    lyricMatchesById,
    lyricsState,
    searchQueryForFiltering,
    isAnyFilterActive,
    itemsPerPage,
  } = useFilteredSongs({
    songs: initialSongsData,
    filterOptions,
    sliderYears,
    searchQuery,
    filterType,
    yearRangeIndices,
    filterGenre,
    filterLyricist,
    filterComposer,
    filterArranger,
    filterArtist,
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setActiveSongId(null);
        setMountKey((previous) => previous + 1);
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const timer = setTimeout(notifyDataReady, 0);
    return () => clearTimeout(timer);
  }, [mounted, filteredSongs, mountKey, notifyDataReady, viewMode]);

  // ── 计数 ────────────────────────────────────────────────────────────────
  // 存疑的歌照常列出，但不计入首数（同 countCatalogSongs）
  const catalogTotal = useMemo(
    () => countCatalogSongs(initialSongsData),
    [initialSongsData],
  );
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const type of filterOptions.allTypes) {
      const songs =
        type === FILTER_OPTION_ALL
          ? initialSongsData
          : type === FILTER_OPTION_UNKNOWN
            ? initialSongsData.filter((s) => !s.type || s.type.length === 0)
            : initialSongsData.filter((s) => s.type?.includes(type));
      counts.set(type, countCatalogSongs(songs));
    }
    return counts;
  }, [filterOptions.allTypes, initialSongsData]);

  // ── 图录分页（目录不分页，一页列完） ─────────────────────────────────────
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredSongs.length / itemsPerPage)),
    [filteredSongs.length, itemsPerPage],
  );

  const safePage = useMemo(
    () => Math.min(Math.max(1, currentPage), totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    if (safePage !== currentPage) {
      setPaginationPage(safePage);
    }
  }, [currentPage, safePage, setPaginationPage]);

  const paginatedSongs = useMemo(() => {
    const startIndex = (safePage - 1) * itemsPerPage;
    return filteredSongs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSongs, itemsPerPage, safePage]);

  // 翻页后回到总目开头，不回页顶的扉页
  const turnPage = useCallback(
    (page: number) => {
      setPaginationPage(page);
      document
        .getElementById("catalog")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    },
    [setPaginationPage],
  );

  // ── 其他交互 ────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    // 与扉页那句同一句话，扉页在句末接「……」，这里也一样
    const shareData = {
      title: tCommon("site.name"),
      text: `${t("hero.defaultDesc")}……`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share cancelled.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      alert(t("linkCopied"));
    } catch {
      // Clipboard unavailable.
    }
  }, [t, tCommon]);

  const handleTitleReset = useCallback(() => {
    sessionStorage.removeItem("music_library_scrollY");
    resetAllFilters();
    window.scrollTo({ top: 0, behavior: "instant" });
    router.refresh();
  }, [router, resetAllFilters]);

  const handleNavigate = useCallback(
    (songId: number) => {
      setActiveSongId(songId);
      handleSongClick();
    },
    [handleSongClick],
  );

  const getSnippet = useCallback(
    (songId: number) => {
      if (!searchQueryForFiltering || lyricsState !== "ready") return null;

      // 只有命中确实发生在歌词字段上才展示片段——靠标题/专辑命中的歌
      // 不会在这个 Map 里，避免展示一段与命中无关的歌词。
      return extractLyricsSnippetParts(
        lyricsMap.get(songId) || "",
        lyricMatchesById.get(songId),
      );
    },
    [lyricsMap, lyricMatchesById, lyricsState, searchQueryForFiltering],
  );

  const filters: LibraryFilters = {
    options: filterOptions,
    typeCounts,
    type: filterType,
    setType: setFilterType,
    sliderYears,
    yearRange: yearRangeIndices,
    setYearRange: setYearRangeIndices,
    genre: filterGenre,
    setGenre: setFilterGenre,
    artist: filterArtist,
    setArtist: setFilterArtist,
    lyricist: filterLyricist,
    setLyricist: setFilterLyricist,
    composer: filterComposer,
    setComposer: setFilterComposer,
    arranger: filterArranger,
    setArranger: setFilterArranger,
    resultCount: countCatalogSongs(filteredSongs),
    isAnyActive: isAnyFilterActive,
    reset: resetAllFilters,
  };

  const entriesProps = {
    activeSongId,
    onNavigate: handleNavigate,
    getSnippet,
  };

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": INK_TONE.light,
          "--tone-dark": INK_TONE.dark,
        } as React.CSSProperties
      }
    >
      <TopBar
        exit={{
          kind: "logo",
          onClick: handleTitleReset,
          tooltip: t("titleTooltip"),
        }}
        actions={[
          {
            key: "share",
            icon: Share2,
            label: tCommon("nav.share"),
            onClick: handleShare,
          },
        ]}
      />

      <main className="relative pt-32 md:pt-40 pb-32 max-w-6xl mx-auto px-6 animate-in fade-in duration-700">
        <HeroSection songCount={catalogTotal} />

        <section id="catalog" className="scroll-mt-[calc(var(--nav-h)+1.5rem)]">
          <SectionHeading label={t("catalog.heading")}>
            <ViewSwitch
              value={viewMode}
              onChange={(mode) => setViewMode(mode)}
            />
          </SectionHeading>

          <div className="mt-12 grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
            {/* 宽屏左栏：检索。比视口高时自己滚，不随正文滚走 */}
            <aside className="hidden lg:block lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:self-start lg:max-h-[calc(100dvh-var(--nav-h)-3rem)] overflow-y-auto thin-scrollbar pr-2">
              <h2 className="sr-only">{t("catalog.index")}</h2>
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                lyricsState={lyricsState}
                className="mb-10"
              />
              <LibraryIndex filters={filters} layout="aside" />
            </aside>

            <div className="min-w-0">
              {/* 窄屏：搜索与「筛选」吸顶，其余检索项在底部面板里 */}
              <div className="lg:hidden sticky top-(--nav-h) z-40 -mx-6 mb-10 px-6 bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-5">
                  <SearchField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    lyricsState={lyricsState}
                    className="min-w-0 flex-1 border-b-0"
                  />
                  <IndexDrawerButton filters={filters} />
                </div>
              </div>

              <div
                className={cn(
                  "min-h-[50vh] transition-opacity duration-200",
                  isRestoringScroll
                    ? "opacity-0 **:animate-none!"
                    : "opacity-100",
                )}
              >
                {filteredSongs.length === 0 ? (
                  <p className="py-20 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
                    {t("noFilteredSongs")}
                  </p>
                ) : viewMode === "list" ? (
                  <div
                    key={`list-${mountKey}`}
                    className="animate-in fade-in duration-500"
                  >
                    <CatalogList
                      songs={filteredSongs}
                      grouped={!searchQueryForFiltering}
                      {...entriesProps}
                    />
                  </div>
                ) : (
                  <div
                    key={`grid-${safePage}-${mountKey}`}
                    className="animate-in fade-in duration-500"
                  >
                    <CatalogGrid songs={paginatedSongs} {...entriesProps} />
                    <FolioPager
                      page={safePage}
                      total={totalPages}
                      onChange={turnPage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}

/** 「目录 · 图录」：放在总目题头右侧的文字切换 */
function ViewSwitch({
  value,
  onChange,
}: {
  value: MusicLibraryViewMode;
  onChange: (mode: MusicLibraryViewMode) => void;
}) {
  const t = useTranslations("library.view");
  // 目录在前：先文字后图，与书的次序一致
  const modes = ["list", "grid"] as const;
  return (
    <div className="flex shrink-0 items-baseline gap-3">
      {modes.map((mode, i) => (
        <React.Fragment key={mode}>
          {i > 0 && (
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={value === mode}
            className={cn(
              "text-xs tracking-widest transition-colors",
              value === mode
                ? "text-(--tone)"
                : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
            )}
          >
            {t(mode)}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
