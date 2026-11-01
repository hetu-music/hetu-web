"use client";

import TopBar from "@/components/shared/topbar/TopBar";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import { addToast } from "@/components/ui/toast";
import { useFavorites } from "@/context/FavoritesContext";
import { useDeferredCjkFonts } from "@/hooks/library/useDeferredCjkFonts";
import { useLibraryResults } from "@/hooks/library/useLibraryResults";
import { useLibraryState } from "@/hooks/library/useLibraryState";
import { useScrollRestore } from "@/hooks/library/useScrollRestore";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { flushUrlState } from "@/hooks/utils/useUrlState";
import { useRouter } from "@/i18n/navigation";
import { MUSIC_LIBRARY_ITEMS_PER_PAGE } from "@/lib/constants";
import { buildLibraryOptions } from "@/lib/library/filters";
import type { MusicLibraryClientProps } from "@/lib/types";
import { sharePage } from "@/lib/utils/share";
import { cn } from "@/lib/utils/utils";
import { countCatalogSongs } from "@/lib/utils/utils-song";
import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeroSection from "./HeroSection";
import LibraryToolbar from "./LibraryToolbar";
import SongFilters from "./SongFilters";
import SongResults from "./SongResults";

const NAV_DEPTH_KEY = "__hetu_web_nav_depth";

/**
 * 曲库页：把地址栏状态（useLibraryState）、结果（useLibraryResults）接到
 * 卷首、工具栏、筛选面板、列表这几块上。各块只认传进来的值（见 docs/LIBRARY.md 阶段 3）。
 */
export default function MusicLibraryClient({
  initialSongsData,
}: MusicLibraryClientProps) {
  const router = useRouter();
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const { isLoggedIn } = useFavorites();
  const [mounted, setMounted] = useState(false);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const { showScrollTop, scrollToTop } = useScrollTop();
  const listStartRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => buildLibraryOptions(initialSongsData),
    [initialSongsData],
  );
  const state = useLibraryState(options);
  const { results, available, lyricsState, getLyricsSnippet } =
    useLibraryResults(initialSongsData, state.query, state.filters);
  const { isRestoringScroll, notifyDataReady, saveScroll, clearSavedScroll } =
    useScrollRestore();

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
  }, [mounted, results, mountKey, notifyDataReady, state.view]);

  const totalPages = Math.max(
    1,
    Math.ceil(results.length / MUSIC_LIBRARY_ITEMS_PER_PAGE),
  );
  const safePage = Math.min(Math.max(1, state.page), totalPages);
  const { setPage } = state;

  useEffect(() => {
    if (safePage !== state.page) setPage(safePage);
  }, [state.page, safePage, setPage]);

  const pageSongs = useMemo(() => {
    const start = (safePage - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE;
    return results.slice(start, start + MUSIC_LIBRARY_ITEMS_PER_PAGE);
  }, [results, safePage]);

  // 思源字体等首屏封面到了再加载；网格视图等第一张封面，其余情况等页面加载完
  const { deferred: cjkDeferred, release: releaseCjkFonts } =
    useDeferredCjkFonts(state.view === "grid" && pageSongs.length > 0);

  const handleShare = useCallback(async () => {
    // 与卷首那句同一句话，卷首在句末接「……」，这里也一样
    const outcome = await sharePage({
      title: tCommon("site.name"),
      text: `${t("hero.defaultDesc")}……`,
    });
    if (outcome === "copied") addToast("success", t("linkCopied"));
  }, [t, tCommon]);

  const { resetAll } = state;
  const handleTitleReset = useCallback(() => {
    clearSavedScroll();
    resetAll();
    window.scrollTo({ top: 0, behavior: "instant" });
    router.refresh();
  }, [router, resetAll, clearSavedScroll]);

  const handleReset = useCallback(() => {
    resetAll();
    scrollToTop();
  }, [resetAll, scrollToTop]);

  const navigateToSong = useCallback(
    (songId: number) => {
      setActiveSongId(songId);
      saveScroll();

      const navDepth = parseInt(
        sessionStorage.getItem(NAV_DEPTH_KEY) || "0",
        10,
      );
      sessionStorage.setItem(NAV_DEPTH_KEY, String(navDepth + 1));
      // 还没写进地址栏的改动先写进去，返回时才回得到这里
      flushUrlState();
      router.push(`/song/${songId}`);
    },
    [saveScroll, router],
  );

  return (
    <div
      className={cn(
        "min-h-screen bg-[#FAFAFA] transition-colors duration-500 dark:bg-[#0B0F19]",
        cjkDeferred && "cjk-deferred",
      )}
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

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-32">
        <section className="mb-6 md:mb-16">
          <div className="flex items-end justify-between gap-8">
            <HeroSection songCount={countCatalogSongs(results)} />
          </div>
        </section>

        {/* 翻页后停在这里：工具栏刚好吸顶，下一页的第一行露在它下面，
            和读者自己滚过卷首时一样。不能直接滚工具栏，它吸顶后量出的位置不是原位 */}
        <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

        <LibraryToolbar
          types={options.types}
          type={state.filters.type}
          onTypeChange={state.setType}
          isAnyFilterActive={state.isAnyFilterActive}
          onReset={handleReset}
          searchInput={state.searchInput}
          onSearchChange={state.setSearchInput}
          lyricsState={lyricsState}
          advanced={state.advanced}
          onAdvancedChange={state.setAdvanced}
          view={state.view}
          onViewChange={state.setView}
        >
          <SongFilters
            options={options}
            checked={state.checked}
            onFacetChange={state.setFacetChecked}
            available={available}
            yearSlider={state.yearSlider}
            onYearChange={state.setYearSlider}
          />
        </LibraryToolbar>

        <SongResults
          songs={pageSongs}
          isEmpty={results.length === 0}
          view={state.view}
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          scrollTarget={listStartRef}
          remountKey={`page-${safePage}-${mountKey}`}
          activeSongId={activeSongId}
          onSongClick={navigateToSong}
          getLyricsSnippet={getLyricsSnippet}
          onFirstCoverSettled={releaseCjkFonts}
          showFavoriteColumn={isLoggedIn}
          isRestoringScroll={isRestoringScroll}
        />
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}
