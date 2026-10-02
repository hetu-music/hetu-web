"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { useFilteredSongs } from "@/hooks/library/useFilteredSongs";
import { extractLyricsSnippetParts } from "@/hooks/library/useLyricsIndex";
import { useMusicLibraryState } from "@/hooks/library/useMusicLibraryState";
import { useReveal } from "@/hooks/ui/useReveal";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
} from "@/lib/constants";
import type { MusicLibraryClientProps, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  buildCorpus,
  featuredByYear,
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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CatalogList } from "./CatalogEntries";
import CoverWall from "./CoverWall";
import GalleryHang from "./GalleryHang";
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
/** 作品少于这个数的年份不设主作 */
const FEATURE_MIN_WORKS = 6;
/** 远观、近赏之间切换时，封面从原位飞到新位的时长与缓动（同全站 ease-page） */
const FLIP_MS = 1000;
const FLIP_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

type Scale = "hall" | "grid" | "list";

/**
 * 主页：一座展厅，两种距离。
 * 近赏（默认）：按年分间，作品挂开、留出空墙，滚到哪一排哪一排才亮灯；
 * 远观：全部封面密排成一面墙，检索与意象只改明暗不删格子，点选一首则同类相认。
 * 一旦检索或点亮意象就自动退到远观看全貌，清空后再走回近赏；两种距离之间封面原地飞过去。
 * 另有文字目录。
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
  const featured = useMemo(
    () => featuredByYear(initialSongsData, corpus, FEATURE_MIN_WORKS),
    [initialSongsData, corpus],
  );

  // ── 距离：近赏 / 远观 / 目录 ──────────────────────────────────────────────
  // 检索或点亮意象时，近赏自动退到远观看全貌；清空后走回近赏
  const scale: Scale = viewMode === "hall" && anyActive ? "grid" : viewMode;
  // 画面上实际排出的那一种比 scale 晚一拍：先在旧排法上量好每张封面的位置，
  // 换了排法再让它们从旧位置飞过去（FLIP）
  const [shown, setShown] = useState<Scale>(scale);
  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  const lastShown = useRef(shown);

  useEffect(() => {
    if (shown === scale) return;
    const container = contentRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (container && !reduce && shown !== "list" && scale !== "list") {
      const rects = new Map<string, DOMRect>();
      container.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          rects.set(el.dataset.flip ?? "", r);
        }
      });
      flipFrom.current = rects;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(scale);
  }, [scale, shown]);

  useLayoutEffect(() => {
    if (lastShown.current === shown) return;
    lastShown.current = shown;
    const container = contentRef.current;
    if (!container) return;

    // 两种排法的页面高度差得很多：已经滚过展厅开头的，回到开头
    const toolbar = toolbarRef.current;
    const stuck = toolbar
      ? parseFloat(getComputedStyle(toolbar).top) + toolbar.offsetHeight
      : 0;
    const top = container.getBoundingClientRect().top + window.scrollY - stuck;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" });

    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from) return;
    let moved = 0;
    container.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      // 近赏的画外面还套着一层「滚到才亮」；飞过来的画直接算亮着
      const reveal = el.closest<HTMLElement>("[data-reveal]");
      if (reveal && reveal.dataset.shown === undefined) {
        reveal.style.transition = "none";
        reveal.dataset.shown = "";
        requestAnimationFrame(() => (reveal.style.transition = ""));
      }
      const before = from.get(el.dataset.flip ?? "");
      if (before) {
        el.animate(
          [
            {
              transformOrigin: "0 0",
              transform: `translate(${before.left - r.left}px, ${before.top - r.top}px) scale(${before.width / r.width})`,
            },
            { transformOrigin: "0 0", transform: "none" },
          ],
          {
            duration: FLIP_MS,
            easing: FLIP_EASE,
            delay: Math.min(moved++ * 5, 250),
            fill: "backwards",
          },
        );
      } else {
        // 原先不在视野里的，等飞过来的落定一半再淡入
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 700,
          delay: FLIP_MS * 0.5,
          easing: "ease-out",
          fill: "backwards",
        });
      }
    });
  }, [shown]);

  useReveal(contentRef, [shown, mountKey]);

  // 意象栏平时收起，点「意象」才展开；已经点亮了意象时一直展开着
  const [imageryOpen, setImageryOpen] = useState(false);
  const imageryShown = imageryOpen || filterImagery.length > 0;

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

  const selectScale = (mode: Scale) => {
    // 近赏只挂全部作品：检索着的时候点「近赏」，等于清空检索、走回展厅
    if (mode === "hall" && anyActive) handleReset();
    setViewMode(mode);
  };

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
        {shown === "grid" && (
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
        {/* 工具栏：一行很淡的小字，界面退到画的后面；意象一行平时收起 */}
        <div
          ref={toolbarRef}
          className="sticky top-(--nav-h) z-40 bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-800/70"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex h-11 items-center gap-4 md:gap-6">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                lyricsState={lyricsState}
                className="min-w-0 flex-1 md:flex-none md:w-64 border-b-0"
              />
              {imagery.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setImageryOpen(!imageryOpen)}
                  aria-expanded={imageryShown}
                  className={cn(
                    TEXT_BUTTON_CLASS,
                    "shrink-0 py-2",
                    imageryShown && "text-(--tone) dark:text-(--tone)",
                  )}
                >
                  {t("wall.imageryLabel")}
                </button>
              )}
              <IndexPanelButton filters={filters} />
              {anyActive && (
                <p className="hidden md:flex shrink-0 items-baseline gap-3 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
              <div className="ml-auto flex shrink-0 items-center">
                <ViewSwitch value={scale} onChange={selectScale} />
              </div>
            </div>
            {imagery.items.length > 0 && (
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-page",
                  imageryShown
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden" inert={!imageryShown}>
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
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          ref={contentRef}
          className={cn(
            "max-w-7xl mx-auto px-4 sm:px-6 pt-6 transition-opacity duration-200",
            isRestoringScroll ? "opacity-0 **:animate-none!" : "opacity-100",
          )}
        >
          {shown === "hall" ? (
            <div key={`hall-${mountKey}`}>
              <Masthead
                songCount={catalogTotal}
                variant="hall"
                className="pt-10 md:pt-16 pb-24 md:pb-36"
              />
              <GalleryHang
                songs={initialSongsData}
                yearSignatures={yearSig}
                featured={featured}
                imageryById={imageryById}
                bySong={corpus.bySong}
                activeSongId={activeSongId}
                onPreview={handlePreview}
                onNavigate={handleNavigate}
              />
            </div>
          ) : shown === "grid" ? (
            <div key={`wall-${mountKey}`}>
              <CoverWall
                songs={initialSongsData}
                masthead={<Masthead songCount={catalogTotal} variant="tile" />}
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
              <Masthead
                songCount={catalogTotal}
                variant="tile"
                className="pt-4 pb-14"
              />
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

/** 「近赏 · 远观 · 目录」：工具栏右侧的文字切换 */
function ViewSwitch({
  value,
  onChange,
}: {
  value: Scale;
  onChange: (mode: Scale) => void;
}) {
  const t = useTranslations("library.view");
  const modes = ["hall", "grid", "list"] as const;
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
