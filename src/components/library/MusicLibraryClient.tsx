"use client";

import AppNavbar from "@/components/shared/AppNavbar";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import Pagination from "@/components/shared/Pagination";
import { useFavorites } from "@/context/FavoritesContext";
import { useFilteredSongs } from "@/hooks/library/useFilteredSongs";
import { extractLyricsSnippet } from "@/hooks/library/useLyricsIndex";
import { useMusicLibraryState } from "@/hooks/library/useMusicLibraryState";
import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_VIEW_MODES,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import type { MusicLibraryClientProps } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  calculateFilterOptions,
  decodeFilterParam,
  encodeFilterParam,
} from "@/lib/utils/utils-song";
import {
  Disc,
  LayoutGrid,
  List,
  Mic2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import About from "./About";
import GridCard from "./GridCard";
import HeroSection from "./HeroSection";
import ListRow from "./ListRow";
import SongFilters from "./SongFilters";

const VIEW_MODE_ICONS: Record<MusicLibraryViewMode, React.ReactNode> = {
  grid: <LayoutGrid size={18} />,
  list: <List size={18} />,
};

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-all duration-300 select-none",
        active
          ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none"
          : "border-slate-200 bg-transparent text-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:bg-blue-900/10",
      )}
    >
      {label}
    </button>
  );
}

const NAV_DEPTH_KEY = "__hetu_web_nav_depth";

export default function MusicLibraryClient({
  initialSongsData,
}: MusicLibraryClientProps) {
  const router = useRouter();
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const { isLoggedIn } = useFavorites();
  const [mounted, setMounted] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const { showScrollTop, scrollToTop } = useScrollTop();
  const { containerRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

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
    showAdvancedFilters,
    setShowAdvancedFilters,
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

  // 歌词由 player-store 订阅 currentTrack 变化后自动按需 fetch，此处无需处理

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

  const handleShare = useCallback(async () => {
    const shareData = {
      title: "河图作品勘鉴",
      text: "你一定想知道，戏里讲了什么故事。",
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
  }, [t]);

  const handleTitleReset = useCallback(() => {
    sessionStorage.removeItem("music_library_scrollY");
    resetAllFilters();
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "instant" });
    router.refresh();
  }, [router, resetAllFilters, setSearchQuery]);

  const navigateToSong = useCallback(
    (songId: number) => {
      setActiveSongId(songId);
      handleSongClick();

      const navDepth = parseInt(
        sessionStorage.getItem(NAV_DEPTH_KEY) || "0",
        10,
      );
      sessionStorage.setItem(NAV_DEPTH_KEY, String(navDepth + 1));
      router.push(`/song/${songId}`);
    },
    [handleSongClick, router],
  );

  const getLyricsSnippet = useCallback(
    (songId: number) => {
      if (!searchQueryForFiltering || lyricsState !== "ready") {
        return undefined;
      }

      // 只有命中确实发生在歌词字段上才展示片段——靠标题/专辑命中的歌
      // 不会在这个 Map 里，避免展示一段与命中无关的歌词。
      return extractLyricsSnippet(
        lyricsMap.get(songId) || "",
        lyricMatchesById.get(songId),
      );
    },
    [lyricsMap, lyricMatchesById, lyricsState, searchQueryForFiltering],
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] transition-colors duration-500 dark:bg-[#0B0F19]">
      <AppNavbar
        title={
          <>
            {t("logo.part1")}
            <span className="mx-2 h-5 w-0.5 translate-y-[1.5px] rounded-full bg-blue-600" />
            {t("logo.part2")}
          </>
        }
        onTitleClick={handleTitleReset}
        onAboutClick={() => setShowAbout(true)}
        titleTooltip={t("titleTooltip")}
      />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <section className="mb-6 md:mb-16">
          <div className="flex items-end justify-between gap-8">
            <HeroSection songCount={filteredSongs.length} />
          </div>
        </section>

        <section className="sticky top-20 z-40 -mx-6 mb-8 border-y border-transparent bg-[#FAFAFA]/95 px-6 py-4 backdrop-blur-sm dark:bg-[#0B0F19]/95 data-[scrolled=true]:border-slate-100">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col-reverse justify-between gap-4 md:flex-row md:items-center">
              {/*
                overflow-x-auto 会让 overflow-y 从 visible 计算成 auto，
                即这一行在垂直方向同样会裁切（裁在 padding box 上）。
                原先桌面端 md:pb-0 让胶囊的 border box 与内容盒严丝合缝，
                裁切线正好落在圆角边框的抗锯齿像素上，Chrome 把合成滚动层的
                裁切矩形对齐到整数设备像素后就会削掉底部一行 —— 位置取决于
                元素落在设备像素网格的哪一档，所以 sticky 吸顶前后表现不同。
                这里上下都留出余量，再用负 margin 抵掉，视觉盒尺寸保持不变。
              */}
              <div
                ref={containerRef}
                {...dragHandlers}
                className="no-scrollbar -my-1 flex w-full cursor-grab items-center gap-2 overflow-x-auto pt-1 pb-3 active:cursor-grabbing md:w-auto md:pb-1"
              >
                {filterOptions.allTypes.map((type) => {
                  if (type === FILTER_OPTION_ALL && isAnyFilterActive) {
                    return (
                      <button
                        key="reset"
                        onClick={(event) => {
                          if (hasDraggedRef.current) {
                            event.preventDefault();
                            return;
                          }
                          resetAllFilters();
                          scrollToTop();
                        }}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-600 transition-all duration-300 hover:border-red-300 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400"
                      >
                        <RotateCcw size={12} />
                        {t("reset")}
                      </button>
                    );
                  }

                  const pillLabel = (() => {
                    if (type === FILTER_OPTION_ALL) return tCommon("all");
                    if (type === FILTER_OPTION_UNKNOWN)
                      return tCommon("unknown");
                    return tEnum.has(`type.${type}`)
                      ? tEnum(`type.${type}`)
                      : type;
                  })();

                  return (
                    <FilterPill
                      key={type}
                      label={pillLabel}
                      active={filterType === type}
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        setFilterType(type);
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex w-full items-center gap-2 md:w-auto">
                <div className="group relative flex-1 md:w-64">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder={
                      lyricsState === "ready"
                        ? t("search.placeholderWithLyrics")
                        : t("search.placeholderNoLyrics")
                    }
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                    >
                      <XCircle size={14} />
                    </button>
                  ) : lyricsState === "loading" ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="block h-3 w-3 animate-spin rounded-full border border-indigo-400/60 border-t-indigo-500" />
                    </span>
                  ) : lyricsState === "ready" ? (
                    <Mic2
                      size={13}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400/60"
                    />
                  ) : null}
                </div>

                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={cn(
                    "shrink-0 rounded-lg border p-2 transition-all duration-300",
                    showAdvancedFilters
                      ? "border-blue-600 bg-blue-600 text-white shadow-md"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-blue-400 dark:hover:bg-blue-900/10",
                  )}
                  title={t("advancedFilter")}
                >
                  {showAdvancedFilters ? (
                    <X size={16} />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}
                </button>

                <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 md:block" />

                <div className="flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/50">
                  {MUSIC_LIBRARY_VIEW_MODES.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        "rounded-md p-1.5 transition-all",
                        viewMode === mode
                          ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
                          : "text-slate-400 hover:text-slate-600",
                      )}
                      title={mode === "grid" ? t("view.grid") : t("view.list")}
                    >
                      {VIEW_MODE_ICONS[mode]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                <SongFilters
                  yearRangeIndices={yearRangeIndices}
                  setYearRangeIndices={setYearRangeIndices}
                  sliderYears={sliderYears}
                  selectedGenre={filterGenre}
                  setSelectedGenre={setFilterGenre}
                  selectedArtist={filterArtist}
                  setSelectedArtist={setFilterArtist}
                  selectedLyricist={filterLyricist}
                  setSelectedLyricist={setFilterLyricist}
                  selectedComposer={filterComposer}
                  setSelectedComposer={setFilterComposer}
                  selectedArranger={filterArranger}
                  setSelectedArranger={setFilterArranger}
                  filterOptions={filterOptions}
                />
              </div>
            )}
          </div>
        </section>

        <section
          className={cn(
            "min-h-[50vh] transition-opacity duration-200",
            isRestoringScroll ? "opacity-0 **:animate-none!" : "opacity-100",
          )}
        >
          {filteredSongs.length > 0 ? (
            <>
              {viewMode === "grid" ? (
                <div
                  key={`grid-page-${safePage}-${mountKey}`}
                  className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                >
                  {paginatedSongs.map((song, index) => (
                    <GridCard
                      key={song.id}
                      song={song}
                      isActive={activeSongId === song.id}
                      lyricsSnippet={getLyricsSnippet(song.id)}
                      onClick={() => navigateToSong(song.id)}
                      className="animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-both"
                      style={{
                        animationDelay: `${(index % 8) * 40}ms`,
                        animationFillMode: "both",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  key={`list-page-${safePage}-${mountKey}`}
                  className="flex flex-col gap-2"
                >
                  <div className="mb-2 hidden border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 md:flex">
                    <div className="mr-6 w-16">{t("listHeader.cover")}</div>
                    <div className="grow">{t("listHeader.title")}</div>
                    <div className="ml-8 w-8" />
                    <div className="ml-8 w-8" />
                    {isLoggedIn && <div className="ml-8 w-8" />}
                    <div className="ml-8 w-24 text-center">
                      {t("listHeader.type")}
                    </div>
                    <div className="ml-8 w-24 text-center">
                      {t("listHeader.genre")}
                    </div>
                    <div className="ml-8 w-16">{t("listHeader.year")}</div>
                    <div className="ml-8 w-16">{t("listHeader.time")}</div>
                  </div>
                  {paginatedSongs.map((song, index) => (
                    <ListRow
                      key={song.id}
                      song={song}
                      isActive={activeSongId === song.id}
                      lyricsSnippet={getLyricsSnippet(song.id)}
                      onClick={() => navigateToSong(song.id)}
                      className="animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-both"
                      style={{
                        animationDelay: `${(index % 8) * 40}ms`,
                        animationFillMode: "both",
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="mt-12 flex justify-center">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={setPaginationPage}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Disc size={48} className="mb-4 opacity-20" />
              <p className="font-light">{t("noFilteredSongs")}</p>
            </div>
          )}
        </section>
      </main>

      {showAbout && <About onClose={() => setShowAbout(false)} />}

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
        onShare={handleShare}
      />
    </div>
  );
}
