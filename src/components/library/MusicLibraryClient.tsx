"use client";

import NightScroll from "@/components/scroll/NightScroll";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import TopBar from "@/components/shared/topbar/TopBar";
import { useFilteredSongs } from "@/hooks/library/useFilteredSongs";
import { useMusicLibraryState } from "@/hooks/library/useMusicLibraryState";
import { useReveal } from "@/hooks/ui/useReveal";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import type {
  LibraryImageryItem,
  MusicLibraryClientProps,
  Song,
} from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  buildCorpus,
  featuredByYear,
  songsWithAll,
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
import GalleryHang from "./GalleryHang";
import { countActiveFilters, type LibraryFilters } from "./LibraryIndex";
import Masthead from "./Masthead";
import SeekPanel, { SeekButton } from "./SeekPanel";

/** 每一年展签上写几个代表意象 */
const YEAR_SIGNATURE = 2;
/** 作品少于这个数的年份不设主作 */
const FEATURE_MIN_WORKS = 6;

type View = MusicLibraryViewMode;

/**
 * 主页：一个展，两种看法。
 * 夜展：全部作品挂在一卷横向的夜色里，用来漫游、发现；点卷上的年份大字走进那一年的展室。
 * 近赏：按年分间的展室，用来坐下来细读。
 * 「寻」两边共用：在夜展里是掌灯（命中的亮起），在近赏里是办特展（只挂命中的）。
 * 两种看法共用一条时间轴，切换时对准同一年。
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

  // ── 意象 ────────────────────────────────────────────────────────────────
  const corpus = useMemo(() => buildCorpus(imagery), [imagery]);
  const imageryById = useMemo(
    () => new Map(imagery.items.map((i) => [i.id, i])),
    [imagery.items],
  );
  const yearSig = useMemo(
    () => yearSignatures(initialSongsData, corpus, YEAR_SIGNATURE),
    [initialSongsData, corpus],
  );
  const featured = useMemo(
    () => featuredByYear(initialSongsData, corpus, FEATURE_MIN_WORKS),
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

  // ── 检索结果：再按意象取交集 ───────────────────────────────────────────
  const anyActive = isAnyFilterActive || filterImagery.length > 0;
  const matchedIds = useMemo(() => {
    const withAll =
      filterImagery.length > 0 ? songsWithAll(corpus, filterImagery) : null;
    return new Set(
      filteredSongs
        .filter((s) => !withAll || withAll.has(s.id))
        .map((s) => s.id),
    );
  }, [filteredSongs, filterImagery, corpus]);
  // 夜展里点着的灯；近赏里的特展按编年排（检索结果是按相关度排的）
  const lit = useMemo(
    () => (anyActive ? matchedIds : null),
    [anyActive, matchedIds],
  );
  const hallSongs = useMemo(
    () =>
      anyActive
        ? initialSongsData.filter((s) => matchedIds.has(s.id))
        : initialSongsData,
    [anyActive, initialSongsData, matchedIds],
  );
  const resultCount = useMemo(() => countCatalogSongs(hallSongs), [hallSongs]);

  // ── 两种看法 ────────────────────────────────────────────────────────────
  // 画不了 WebGL 的设备只开近赏
  const [nightUnavailable, setNightUnavailable] = useState(false);
  const view: View = nightUnavailable ? "hall" : viewMode;
  // 两边各自记着此刻在哪一年，切换时带过去
  const nightYear = useRef<number | null | undefined>(undefined);
  const hallYear = useRef<number | null | undefined>(undefined);
  const [arrival, setArrival] = useState<{
    view: View;
    year: number | null | undefined;
  } | null>(null);

  const switchView = useCallback(
    (next: View, year?: number | null) => {
      if (next === view) return;
      const from = view === "night" ? nightYear.current : hallYear.current;
      setArrival({ view: next, year: year !== undefined ? year : from });
      setViewMode(next);
    },
    [view, setViewMode],
  );

  const contentRef = useRef<HTMLElement>(null);

  // 走进近赏：直接停在那一年的展室
  useLayoutEffect(() => {
    if (view !== "hall" || arrival?.view !== "hall") return;
    if (arrival.year === undefined) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const key = arrival.year ?? "unknown";
    const room = document.querySelector<HTMLElement>(
      `[data-room-year="${key}"]`,
    );
    if (room) room.scrollIntoView({ block: "start", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, arrival]);

  // 近赏里滚到哪一年：取视口上部三分之一处的那一间
  useEffect(() => {
    if (view !== "hall") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let current: string | undefined;
      document
        .querySelectorAll<HTMLElement>("[data-room-year]")
        .forEach((room) => {
          if (room.getBoundingClientRect().top <= line)
            current = room.dataset.roomYear;
        });
      hallYear.current =
        current === undefined
          ? undefined
          : current === "unknown"
            ? null
            : Number(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [view, hallSongs]);

  // 从歌曲页回到近赏时恢复滚动位置（夜展的镜头由 NightScroll 自己恢复）
  useEffect(() => {
    if (!mounted || view !== "hall") return;
    const timer = setTimeout(notifyDataReady, 0);
    return () => clearTimeout(timer);
  }, [mounted, filteredSongs, mountKey, notifyDataReady, view]);

  useReveal(contentRef, [view, mountKey, hallSongs]);

  // ── 近赏里的取色：鼠标停在哪幅，整页缓缓换成它的颜色 ───────────────────
  const [previewTone, setPreviewTone] = useState<CoverTone | null>(null);
  const toneCache = useRef(new Map<number, CoverTone | null>());
  const handlePreview = useCallback(
    (song: Song | null, img: HTMLImageElement | null) => {
      if (!song) {
        setPreviewTone(null);
        return;
      }
      let tone = toneCache.current.get(song.id);
      if (tone === undefined && img?.complete && img.naturalWidth > 0) {
        tone = toneFromImage(img);
        toneCache.current.set(song.id, tone);
      }
      setPreviewTone(tone ?? null);
    },
    [],
  );
  const tone = previewTone ?? INK_TONE;

  // ── 寻 ──────────────────────────────────────────────────────────────────
  const [seekOpen, setSeekOpen] = useState(false);
  const closeSeek = useCallback(() => setSeekOpen(false), []);

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
    reset: resetAllFilters,
  };

  const selectedImageryItems = filterImagery
    .map((id) => imageryById.get(id))
    .filter((i): i is LibraryImageryItem => !!i);

  /** 夜展里点着灯时：走进这些作品的特展 */
  const gather = useCallback(() => {
    setSeekOpen(false);
    // 特展从头看起，不对准年份
    setArrival({ view: "hall", year: undefined });
    setViewMode("hall");
  }, [setViewMode]);

  // ── 其他交互 ────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    // 与引首那句同一句话，句末接「……」
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

  // ── 顶栏：出口、两种看法、寻；寻的面板从顶栏下沿展开 ───────────────────
  const topBar = (
    <TopBar
      exit={{
        kind: "logo",
        onClick: handleTitleReset,
        tooltip: t("titleTooltip"),
      }}
      nav={
        nightUnavailable ? undefined : (
          <ViewSwitch value={view} onChange={(v) => switchView(v)} />
        )
      }
      pinned={
        <SeekButton
          open={seekOpen}
          active={anyActive}
          onClick={() => setSeekOpen(!seekOpen)}
        />
      }
      actions={[
        {
          key: "share",
          icon: Share2,
          label: tCommon("nav.share"),
          onClick: handleShare,
        },
      ]}
    >
      <SeekPanel
        open={seekOpen}
        onClose={closeSeek}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        lyricsState={lyricsState}
        imageryItems={imagery.items}
        selectedImagery={filterImagery}
        toggleImagery={toggleImagery}
        filters={filters}
        onGather={view === "night" ? gather : undefined}
      />
    </TopBar>
  );

  if (view === "night") {
    return (
      <NightScroll
        key={`night-${mountKey}`}
        songs={initialSongsData}
        imagery={imagery}
        lit={lit}
        topBar={topBar}
        lampLine={
          anyActive ? (
            <LampLine
              query={searchQueryForFiltering}
              imagery={selectedImageryItems}
              detailCount={countActiveFilters(filters)}
              count={resultCount}
              onRemoveImagery={toggleImagery}
              onGather={gather}
              onReset={resetAllFilters}
            />
          ) : null
        }
        initialYear={arrival?.view === "night" ? arrival.year : undefined}
        onYearChange={(year) => (nightYear.current = year)}
        onEnterYear={(year) => switchView("hall", year)}
        onUnavailable={() => setNightUnavailable(true)}
      />
    );
  }

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
      {/* 取色铺底：停在哪幅，颜色缓缓转过去 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[80vh] transition-[background-color] duration-1200 ease-out mask-[radial-gradient(ellipse_75%_60%_at_20%_0%,black,transparent_75%)]"
        style={{ backgroundColor: tone.wash }}
      />

      {topBar}

      <main
        ref={contentRef}
        key={`hall-${mountKey}`}
        className={cn(
          "relative mx-auto max-w-7xl px-4 sm:px-6 pt-(--nav-h) pb-32 animate-in fade-in duration-700 transition-opacity",
          isRestoringScroll ? "opacity-0 **:animate-none!" : "opacity-100",
        )}
      >
        {anyActive ? (
          <ExhibitionHeader
            query={searchQueryForFiltering}
            imagery={selectedImageryItems}
            count={resultCount}
            onReset={resetAllFilters}
            onBackToNight={
              nightUnavailable ? undefined : () => switchView("night")
            }
          />
        ) : (
          <Masthead
            songCount={countCatalogSongs(initialSongsData)}
            variant="hall"
            className="pt-10 md:pt-16 pb-24 md:pb-36"
          />
        )}

        {hallSongs.length === 0 ? (
          <p className="py-20 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
            {t("noFilteredSongs")}
          </p>
        ) : (
          <GalleryHang
            songs={hallSongs}
            yearSignatures={yearSig}
            featured={anyActive ? new Map() : featured}
            imageryById={imageryById}
            bySong={corpus.bySong}
            activeSongId={activeSongId}
            onPreview={handlePreview}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}

/** 「夜展 · 近赏」：顶栏里的两种看法 */
function ViewSwitch({
  value,
  onChange,
}: {
  value: View;
  onChange: (view: View) => void;
}) {
  const t = useTranslations("library.view");
  const views: View[] = ["night", "hall"];
  return (
    <div className="flex items-baseline gap-3 px-2">
      {views.map((v, i) => (
        <React.Fragment key={v}>
          {i > 0 && (
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={cn(
              "font-serif text-[15px] tracking-[0.2em] transition-colors",
              value === v
                ? "text-slate-900 dark:text-slate-50"
                : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
            )}
          >
            {t(v)}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/** 灯的名目：搜的词、点亮的意象（点一下熄掉）、细检的项数 */
function Lamps({
  query,
  imagery,
  onRemoveImagery,
}: {
  query: string;
  imagery: LibraryImageryItem[];
  onRemoveImagery?: (id: number) => void;
}) {
  return (
    <>
      {query && (
        <span className="font-serif text-base tracking-wider text-slate-800 dark:text-slate-100">
          「{query}」
        </span>
      )}
      {imagery.map((item) =>
        onRemoveImagery ? (
          <button
            key={item.id}
            type="button"
            onClick={() => onRemoveImagery(item.id)}
            className="font-calligraphy text-xl leading-none transition-opacity hover:opacity-60"
            style={{ color: item.accent }}
          >
            {item.name}
          </button>
        ) : (
          <span
            key={item.id}
            className="font-calligraphy leading-none"
            style={{ color: item.accent }}
          >
            {item.name}
          </span>
        ),
      )}
    </>
  );
}

/** 夜展底部：点着的灯，得几首，走进特展，复原 */
function LampLine({
  query,
  imagery,
  detailCount,
  count,
  onRemoveImagery,
  onGather,
  onReset,
}: {
  query: string;
  imagery: LibraryImageryItem[];
  detailCount: number;
  count: number;
  onRemoveImagery: (id: number) => void;
  onGather: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("library");
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2 text-xs tracking-[0.2em] text-slate-400">
      <Lamps
        query={query}
        imagery={imagery}
        onRemoveImagery={onRemoveImagery}
      />
      {detailCount > 0 && (
        <span>{t("seek.detailActive", { count: detailCount })}</span>
      )}
      <span className="tabular-nums">{t("catalog.result", { count })}</span>
      {count > 0 && (
        <button
          type="button"
          onClick={onGather}
          className={PRIMARY_BUTTON_CLASS}
        >
          {t("seek.gather", { count })}
        </button>
      )}
      <button type="button" onClick={onReset} className={TEXT_BUTTON_CLASS}>
        {t("catalog.reset")}
      </button>
    </div>
  );
}

/** 近赏的特展：检索时只挂命中的作品，题头写明这一场的灯 */
function ExhibitionHeader({
  query,
  imagery,
  count,
  onReset,
  onBackToNight,
}: {
  query: string;
  imagery: LibraryImageryItem[];
  count: number;
  onReset: () => void;
  onBackToNight?: () => void;
}) {
  const t = useTranslations("library");
  const hasLamps = !!query || imagery.length > 0;
  return (
    <header className="pt-10 md:pt-16 pb-20 md:pb-28 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-page">
      <p className="text-xs tracking-[0.35em] text-(--tone)">
        {t("hall.special")}
      </p>
      <h2 className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3 font-serif text-5xl md:text-7xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
        {hasLamps ? (
          <span className="flex flex-wrap items-baseline gap-x-6 gap-y-3 [&_.font-calligraphy]:text-[1.1em]">
            <Lamps query={query} imagery={imagery} />
          </span>
        ) : (
          t("hall.detailOnly")
        )}
      </h2>
      <p className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
        <span className="tabular-nums">{t("catalog.result", { count })}</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={onReset} className={TEXT_BUTTON_CLASS}>
          {t("catalog.reset")}
        </button>
        {onBackToNight && (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onBackToNight}
              className={PRIMARY_BUTTON_CLASS}
            >
              {t("hall.backToNight")}
            </button>
          </>
        )}
      </p>
    </header>
  );
}
