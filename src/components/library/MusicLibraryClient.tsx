"use client";

import TopBar from "@/components/shared/topbar/TopBar";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
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
  countCatalogSongs,
  decodeFilterParam,
  encodeFilterParam,
} from "@/lib/utils/utils-song";
import {
  LayoutGrid,
  List,
  Mic2,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import GridCard from "./GridCard";
import HeroSection from "./HeroSection";
import ListRow from "./ListRow";
import SongFilters from "./SongFilters";

const VIEW_MODE_ICONS: Record<MusicLibraryViewMode, React.ReactNode> = {
  grid: <LayoutGrid size={18} />,
  list: <List size={18} />,
};

/** 类型标签：文字切换，当前项下方一道强调色短线（同个人中心的目录） */
const TYPE_TAB_CLASS =
  "relative flex h-full shrink-0 items-center whitespace-nowrap font-serif text-[15px] tracking-wider transition-colors select-none";

function TypeTab({
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        TYPE_TAB_CLASS,
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
}

/** 工具栏的图标按钮：同顶栏，选中只变色 */
function toolButtonClass(active: boolean) {
  return cn(
    NAV_BUTTON_CLASS,
    "shrink-0",
    active && "text-(--tone) dark:text-(--tone)",
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
    // 与卷首那句同一句话，卷首在句末接「……」，这里也一样
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

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <section className="mb-6 md:mb-16">
          <div className="flex items-end justify-between gap-8">
            <HeroSection songCount={countCatalogSongs(filteredSongs)} />
          </div>
        </section>

        {/* 曲目工具栏：吸顶，底下只有一道细线。标签、搜索、按钮都放在等高的
            一行里竖直居中，当前标签与聚焦的搜索框在细线上亮一段强调色。
            窄屏分两行：上面搜索与按钮，下面类型标签，两行各有一道细线分开；
            标签行右缘淡出，提示还能横向滑动 */}
        <section className="sticky top-(--nav-h) z-40 -mx-6 mb-10 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-sm dark:bg-[#0B0F19]/95">
          <div className="flex flex-col-reverse border-b border-slate-200/70 dark:border-slate-800 md:h-12 md:flex-row md:gap-8">
            <div
              ref={containerRef}
              {...dragHandlers}
              className="no-scrollbar flex h-12 min-w-0 cursor-grab gap-6 overflow-x-auto mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)] active:cursor-grabbing md:h-full md:mask-none"
            >
              {filterOptions.allTypes.map((type) => {
                if (type === FILTER_OPTION_ALL && isAnyFilterActive) {
                  return (
                    <button
                      key="reset"
                      type="button"
                      onClick={(event) => {
                        if (hasDraggedRef.current) {
                          event.preventDefault();
                          return;
                        }
                        resetAllFilters();
                        scrollToTop();
                      }}
                      className={cn(
                        TYPE_TAB_CLASS,
                        "gap-1.5 text-(--tone) hover:opacity-75",
                      )}
                    >
                      <RotateCcw size={13} />
                      {t("reset")}
                    </button>
                  );
                }

                const tabLabel = (() => {
                  if (type === FILTER_OPTION_ALL) return tCommon("all");
                  if (type === FILTER_OPTION_UNKNOWN) return tCommon("unknown");
                  return tEnum.has(`type.${type}`)
                    ? tEnum(`type.${type}`)
                    : type;
                })();

                return (
                  <TypeTab
                    key={type}
                    label={tabLabel}
                    active={filterType === type}
                    onClick={() => {
                      if (hasDraggedRef.current) return;
                      setFilterType(type);
                    }}
                  />
                );
              })}
            </div>

            <div className="flex h-11 items-center gap-1 border-b border-slate-200/70 dark:border-slate-800 md:ml-auto md:h-full md:border-0">
              {/* 搜索：平时没有边框，只靠放大镜与占位字辨认；聚焦时细线上亮一段强调色 */}
              <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-60 md:flex-none">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    lyricsState === "ready"
                      ? t("search.placeholderWithLyrics")
                      : t("search.placeholderNoLyrics")
                  }
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="shrink-0 p-1 text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                  >
                    <XCircle size={14} />
                  </button>
                ) : lyricsState === "loading" ? (
                  <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600" />
                ) : lyricsState === "ready" ? (
                  <Mic2
                    size={13}
                    className="shrink-0 text-(--tone) opacity-50"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
                />
              </label>

              {/* 搜索与按钮之间一道竖线，分开「找」与「怎么看」 */}
              <span
                aria-hidden
                className="mx-2 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
              />

              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                aria-pressed={showAdvancedFilters}
                className={toolButtonClass(showAdvancedFilters)}
                title={t("advancedFilter")}
              >
                {showAdvancedFilters ? (
                  <X size={18} />
                ) : (
                  <SlidersHorizontal size={18} />
                )}
              </button>
              {MUSIC_LIBRARY_VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={toolButtonClass(viewMode === mode)}
                  title={mode === "grid" ? t("view.grid") : t("view.list")}
                >
                  {VIEW_MODE_ICONS[mode]}
                </button>
              ))}
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/70 pb-6 pt-5 duration-300 dark:border-slate-800">
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
                  <div className="mb-2 hidden px-4 py-2 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500 md:flex">
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
            <p className="py-20 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {t("noFilteredSongs")}
            </p>
          )}
        </section>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}
