"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
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
import type { MusicLibraryClientProps, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  buildCorpus,
  kinOf,
  songsWithAll,
  topImagery,
  yearSignatures,
} from "@/lib/utils/utils-imagery-wall";
import {
  calculateFilterOptions,
  countCatalogSongs,
  decodeFilterParam,
  encodeFilterParam,
} from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CatalogList } from "./CatalogEntries";
import CoverWall from "./CoverWall";
import ImageryBar from "./ImageryBar";
import {
  IndexPanelButton,
  type LibraryFilters,
  SearchField,
} from "./LibraryIndex";
import Masthead from "./Masthead";
import WallCaption from "./WallCaption";

/** 意象栏列出的常用意象数 */
const TOP_IMAGERY = 20;
/** 点选一首时亮起的同类作品数 */
const KIN_LIMIT = 24;
/** 每一年字块上写几个代表意象 */
const YEAR_SIGNATURE = 2;
/** 鼠标掠过封面时，停这么久才换题签与色调，免得扫过一片时一路闪 */
const PREVIEW_DELAY = 120;
/** 鼠标离开墙后题签多留一会儿，好移上去点里面的按钮 */
const PREVIEW_LINGER = 320;

/**
 * 主页：千面墙。全部封面从新到旧密排，检索与意象只改明暗不删格子；
 * 点选一首，与它共有意象的作品一同亮起，整页换成它封面的颜色。另有文字目录作第二视图。
 */
export default function MusicLibraryClient({
  initialSongsData,
  imagery,
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
    filterImagery,
    setFilterImagery,
    viewMode,
    setViewMode,
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

  // ── 意象 ────────────────────────────────────────────────────────────────
  const corpus = useMemo(() => buildCorpus(imagery), [imagery]);
  const imageryById = useMemo(
    () => new Map(imagery.items.map((i) => [i.id, i])),
    [imagery.items],
  );
  const topItems = useMemo(
    () => topImagery(imagery.items, TOP_IMAGERY),
    [imagery.items],
  );
  const yearSig = useMemo(
    () => yearSignatures(initialSongsData, corpus, YEAR_SIGNATURE),
    [initialSongsData, corpus],
  );

  const toggleImagery = useCallback(
    (id: number) => {
      setFilterImagery(
        filterImagery.includes(id)
          ? filterImagery.filter((x) => x !== id)
          : [...filterImagery, id],
      );
    },
    [filterImagery, setFilterImagery],
  );

  // 检索结果再按意象取交集
  const matched = useMemo(() => {
    if (filterImagery.length === 0) return filteredSongs;
    const withAll = songsWithAll(corpus, filterImagery);
    return filteredSongs.filter((s) => withAll.has(s.id));
  }, [filteredSongs, filterImagery, corpus]);
  const anyActive = isAnyFilterActive || filterImagery.length > 0;

  // ── 点选与停留 ──────────────────────────────────────────────────────────
  // 点选只对当时的检索结果有效：检索一变，选中自然作废，墙回到按检索点灯
  const [pin, setPin] = useState<{ song: Song; within: Song[] } | null>(null);
  const pinned = pin && pin.within === matched ? pin.song : null;
  const [preview, setPreview] = useState<Song | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const captionHovered = useRef(false);

  // 封面取色：第一次停留或点选时从已加载的缩略图上取，之后记住
  const [toneById, setToneById] = useState<Map<number, CoverTone | null>>(
    () => new Map(),
  );
  const rememberTone = useCallback(
    (song: Song, img: HTMLImageElement | null) => {
      if (toneById.has(song.id)) return;
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const tone = toneFromImage(img);
      setToneById((prev) => new Map(prev).set(song.id, tone));
    },
    [toneById],
  );

  const handlePreview = useCallback(
    (song: Song | null, img: HTMLImageElement | null) => {
      clearTimeout(previewTimer.current);
      if (song) {
        previewTimer.current = setTimeout(() => {
          setPreview(song);
          rememberTone(song, img);
        }, PREVIEW_DELAY);
      } else {
        previewTimer.current = setTimeout(() => {
          if (!captionHovered.current) setPreview(null);
        }, PREVIEW_LINGER);
      }
    },
    [rememberTone],
  );
  useEffect(() => () => clearTimeout(previewTimer.current), []);

  const handlePin = useCallback(
    (song: Song, img: HTMLImageElement | null) => {
      clearTimeout(previewTimer.current);
      setPreview(null);
      setPin({ song, within: matched });
      rememberTone(song, img);
    },
    [matched, rememberTone],
  );
  const unpin = useCallback(() => setPin(null), []);

  const kin = useMemo(
    () => (pinned ? kinOf(corpus, pinned.id, KIN_LIMIT) : []),
    [pinned, corpus],
  );

  // 亮着的作品：点选时是它与同类；否则是检索结果；什么都没选就全亮
  const lit = useMemo(() => {
    if (pinned) return new Set([pinned.id, ...kin]);
    if (anyActive) return new Set(matched.map((s) => s.id));
    return null;
  }, [pinned, kin, anyActive, matched]);

  const captionSong = pinned ?? preview;
  const captionMarks = useMemo(() => {
    if (!captionSong) return [];
    return [...(corpus.bySong.get(captionSong.id) ?? [])]
      .map((id) => imageryById.get(id))
      .filter((i): i is NonNullable<typeof i> => !!i)
      .sort((a, b) => a.songCount - b.songCount || a.id - b.id);
  }, [captionSong, corpus, imageryById]);

  // 整页的强调色：点选的那首优先，其次是鼠标停着的那首，都没有就用墨蓝
  const tone = (captionSong && toneById.get(captionSong.id)) || INK_TONE;

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
  const resultCount = countCatalogSongs(matched);

  // ── 其他交互 ────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    // 与刊头那句同一句话，刊头在句末接「……」，这里也一样
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

  const handleReset = useCallback(() => {
    setPin(null);
    resetAllFilters();
  }, [resetAllFilters]);

  const handleTitleReset = useCallback(() => {
    sessionStorage.removeItem("music_library_scrollY");
    handleReset();
    window.scrollTo({ top: 0, behavior: "instant" });
    router.refresh();
  }, [router, handleReset]);

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
    resultCount,
    isAnyActive: anyActive,
    reset: handleReset,
  };

  const masthead = <Masthead songCount={catalogTotal} />;

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": tone.light,
          "--tone-dark": tone.dark,
        } as React.CSSProperties
      }
    >
      {/* 取色铺底：换一首，颜色缓缓转过去 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] transition-[background-color] duration-1200 ease-out mask-[radial-gradient(ellipse_75%_60%_at_20%_0%,black,transparent_75%)]"
        style={{ backgroundColor: tone.wash }}
      />

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
      >
        {viewMode === "grid" && (
          <WallCaption
            song={captionSong}
            pinned={!!pinned}
            marks={captionMarks}
            selectedImagery={filterImagery}
            kinCount={kin.length}
            snippet={captionSong ? getSnippet(captionSong.id) : null}
            onSelectImagery={(id) => {
              setPin(null);
              setPreview(null);
              toggleImagery(id);
            }}
            onNavigate={handleNavigate}
            onClose={unpin}
            onHoverChange={(hovering) => {
              captionHovered.current = hovering;
              if (!hovering) handlePreview(null, null);
            }}
          />
        )}
      </TopBar>

      <main className="relative pt-(--nav-h) pb-32">
        {/* 工具栏：搜索、结果、筛选、视图一行，下面一行意象 */}
        <div className="sticky top-(--nav-h) z-40 bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm border-b border-slate-200/70 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex h-12 items-center gap-4 md:gap-6">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                lyricsState={lyricsState}
                className="min-w-0 flex-1 md:flex-none md:w-72 border-b-0"
              />
              {anyActive && (
                <p className="flex shrink-0 items-baseline gap-3 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  <span className="tabular-nums">
                    {t("catalog.result", { count: resultCount })}
                  </span>
                  <span
                    aria-hidden
                    className="hidden md:inline text-slate-300 dark:text-slate-600"
                  >
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={cn(
                      PRIMARY_BUTTON_CLASS,
                      "hidden md:inline-flex",
                    )}
                  >
                    {t("catalog.reset")}
                  </button>
                </p>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-5">
                <IndexPanelButton filters={filters} />
                <ViewSwitch value={viewMode} onChange={setViewMode} />
              </div>
            </div>
            {imagery.items.length > 0 && (
              <div className="border-t border-slate-200/50 dark:border-slate-800/60">
                <ImageryBar
                  top={topItems}
                  all={imagery.items}
                  selected={filterImagery}
                  onToggle={(id) => {
                    setPin(null);
                    toggleImagery(id);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "max-w-7xl mx-auto px-4 sm:px-6 pt-6 transition-opacity duration-200",
            isRestoringScroll ? "opacity-0 **:animate-none!" : "opacity-100",
          )}
        >
          {viewMode === "grid" ? (
            <div
              key={`wall-${mountKey}`}
              className="animate-in fade-in duration-700"
            >
              <CoverWall
                songs={initialSongsData}
                masthead={masthead}
                lit={lit}
                pinnedId={pinned?.id ?? null}
                yearSignatures={yearSig}
                imageryById={imageryById}
                onPreview={handlePreview}
                onPin={handlePin}
                onUnpin={unpin}
                onNavigate={handleNavigate}
              />
            </div>
          ) : (
            <div
              key={`list-${mountKey}`}
              className="max-w-4xl animate-in fade-in duration-500"
            >
              <div className="pt-4 pb-14">{masthead}</div>
              {matched.length === 0 ? (
                <p className="py-20 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
                  {t("noFilteredSongs")}
                </p>
              ) : (
                <CatalogList
                  songs={matched}
                  grouped={!searchQueryForFiltering}
                  activeSongId={activeSongId}
                  onNavigate={handleNavigate}
                  getSnippet={getSnippet}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}

/** 「封面 · 目录」：工具栏右侧的文字切换 */
function ViewSwitch({
  value,
  onChange,
}: {
  value: MusicLibraryViewMode;
  onChange: (mode: MusicLibraryViewMode) => void;
}) {
  const t = useTranslations("library.view");
  const modes = ["grid", "list"] as const;
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
