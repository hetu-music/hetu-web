"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import SiteMark from "@/components/shared/SiteMark";
import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import TopBar from "@/components/shared/topbar/TopBar";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { OverlayHostContext } from "@/components/ui/overlay-host";
import { useLibraryDeferred } from "@/hooks/library/useLibraryDeferred";
import { useLibraryResults } from "@/hooks/library/useLibraryResults";
import { useLibraryState } from "@/hooks/library/useLibraryState";
import { useLyricsLines } from "@/hooks/library/useLyricsLines";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { flushUrlState, useUrlState } from "@/hooks/utils/useUrlState";
import { useRouter } from "@/i18n/navigation";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import {
  buildBaseOptions,
  FACET_KEYS,
  type FacetKey,
  type FacetOption,
  isSelectionActive,
  mapFacets,
} from "@/lib/library/filters";
import { needsDeferred } from "@/lib/library/url-state";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import { cn } from "@/lib/utils/utils";
import { enumLabel } from "@/lib/utils/utils-song";
import { useLocale, useTranslations } from "next-intl";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FolioHero, ForeEdgeRail } from "./HeaderFolio";
import { PaperFoldingScreen, PaperStickyBar } from "./HeaderPaperScreen";
import { ChronicleString, StringHero } from "./HeaderString";
import YearChapters from "./YearChapters";
import {
  type ActiveChip,
  type FeatureData,
  HEADER_SCHEMES,
  type HeaderScheme,
  SearchInputLine,
  SongCount,
  type YearRailHandle,
  buildPanels,
} from "./header-shared";
import { byDateDesc, groupByYear } from "./timeline";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

/** 底部左下角极简方案切换胶囊：支持点击与数字键 1 / 2 / 3 即时对比三套重新设计的方案 */
function HeaderSchemeSwitcher({
  value,
  onChange,
}: {
  value: HeaderScheme;
  onChange: (next: HeaderScheme) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const next = HEADER_SCHEMES[Number(e.key) - 1];
      if (next) onChange(next.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChange]);

  const current = HEADER_SCHEMES.find((s) => s.id === value);

  return (
    <div
      role="region"
      aria-label="头部方案切换"
      className="fixed bottom-5 left-4 z-50 flex flex-col items-start gap-1.5 sm:left-6"
    >
      {current && (
        <p className="hidden rounded-full border border-slate-200/75 bg-[#FAFAFA]/95 px-3 py-1 font-kaiti text-xs text-ink-muted shadow-sm sm:block dark:border-slate-800 dark:bg-[#0B0F19]/95">
          方案{current.code}：{current.note}
        </p>
      )}
      <div className="flex items-center rounded-full border border-slate-200/80 bg-[#FAFAFA]/95 px-1.5 py-1 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-[#0B0F19]/95 dark:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.65)]">
        <span className="hidden pl-2.5 pr-2 text-[10px] tracking-[0.24em] text-ink-meta sm:inline">
          卷首
        </span>
        {HEADER_SCHEMES.map((s, idx) => {
          const active = s.id === value;
          return (
            <Fragment key={s.id}>
              {idx > 0 && (
                <span aria-hidden className="mx-0.5 text-[10px] text-ink-faint">
                  ·
                </span>
              )}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(s.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs tracking-wider transition-colors",
                  active
                    ? "font-serif font-semibold text-(--tone)"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <span>{s.code}</span>
                <span className="ml-1 hidden sm:inline">{s.label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 首页原型「二十年」：三套去繁就简的卷首方案对比页。
 * - 方案一（folio · 总目开篇）：零图留白刊头 + 右侧竖排刻本三径 + 视口右缘书口色签；
 * - 方案二（string · 素卷琴弦）：居中素白开篇 + 吸顶不变形的 3px 色丝琴弦（悬停轻浮单帧小画笺）；
 * - 方案三（paper-screen · 素骨折屏）：屏外零杂物，左扉页收题字/入口/寻曲，右侧二十一扇素纸藏锋、唯独一扇显画。
 */
export default function HomeTimeClient({
  songs,
  features,
}: {
  songs: Song[];
  features: FeatureData;
}) {
  const router = useRouter();
  const locale = useLocale();
  const tLib = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const isDesktop = useIsDesktop();
  const { showScrollTop, scrollToTop } = useScrollTop();

  const [scheme, setScheme] = useState<HeaderScheme>("folio");
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // 年份指示器（书口色签 / 色丝琴弦 / 素屏吸顶尺）各自局部维护当前年份，滚过正文不重渲整页
  const railRef = useRef<YearRailHandle>(null);
  const setActiveYearKey = useCallback((key: string) => {
    railRef.current?.setActive(key);
  }, []);

  // 判断卷首是否已滚过吸顶线（供方案二翻转悬浮画笺方向、方案三抽出吸顶条）
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const sentinel = sentinelRef.current;
      const sticky = stickyRef.current;
      if (!sentinel || !sticky) return;
      setFolded(
        sentinel.getBoundingClientRect().top <
          sticky.getBoundingClientRect().top - 1,
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [scheme]);

  const handleSearchFocus = useCallback(() => setSearchFocused(true), []);

  // ── 完整曲库检索与筛选状态（复用正式首页全部能力） ──
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
  const { results, available, getLyricsSnippet, approximate, lyricsPending } =
    useLibraryResults({
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

  // ── 二十年时间脉络：固定由近及远（2026 → 2007 → 未详） ──
  const catalog = useMemo(
    () =>
      songs
        .filter((s) => !s.dispute_note)
        .slice()
        .sort(byDateDesc),
    [songs],
  );

  const { firstYear, lastYear } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of songs) {
      if (s.year && !s.dispute_note) {
        if (s.year < min) min = s.year;
        if (s.year > max) max = s.year;
      }
    }
    return {
      firstYear: Number.isFinite(min) ? min : 2007,
      lastYear: Number.isFinite(max) ? max : 2026,
    };
  }, [songs]);

  const panels = useMemo(
    () => buildPanels(catalog, firstYear, lastYear),
    [catalog, firstYear, lastYear],
  );

  const chapters = useMemo(() => {
    const years: (number | null)[] = [];
    for (let y = lastYear; y >= firstYear; y--) years.push(y);
    if (songs.some((s) => !s.year && !s.dispute_note)) years.push(null);
    return groupByYear(
      songs.filter((s) => !s.dispute_note),
      years,
      true,
    );
  }, [songs, firstYear, lastYear]);

  const shownCount = matched
    ? results.filter((s) => !s.dispute_note).length
    : catalog.length;

  const { setType, setYearSlider, setFacetChecked, resetAll } = state;

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (state.filters.type !== FILTER_OPTION_ALL) {
      const label =
        state.filters.type === FILTER_OPTION_UNKNOWN
          ? tCommon("unknown")
          : enumLabel(tEnum, "type", state.filters.type);
      chips.push({
        key: "type",
        label,
        onRemove: () => setType(FILTER_OPTION_ALL),
      });
    }

    if (state.filters.year) {
      const y = state.filters.year;
      const label =
        y === "unknown"
          ? "年份未详"
          : y.newest !== null && y.newest === y.oldest
            ? `${y.newest} 年`
            : `${y.newest ?? lastYear}—${y.oldest ?? firstYear}`;
      chips.push({
        key: "year",
        label,
        onRemove: () =>
          setYearSlider([0, Math.max(0, options.years.length - 1)]),
      });
    }

    for (const key of FACET_KEYS) {
      const sel = state.filters.facets[key];
      if (!isSelectionActive(sel)) continue;
      const formatVal = (v: string) =>
        v === FILTER_OPTION_UNKNOWN
          ? tCommon("unknown")
          : key === "genre"
            ? enumLabel(tEnum, "genre", v)
            : v;
      const prefix = tLib(`filter.${key}`);
      const summary =
        sel.mode === "exclude"
          ? `除${formatVal(sel.values[0])}${sel.values.length > 1 ? "等" : ""}`
          : `${formatVal(sel.values[0])}${sel.values.length > 1 ? ` 等${sel.values.length}项` : ""}`;
      chips.push({
        key: `facet-${key}`,
        label: `${prefix} · ${summary}`,
        onRemove: () => setFacetChecked(key as FacetKey, []),
      });
    }

    return chips;
  }, [
    state.filters,
    options.years.length,
    firstYear,
    lastYear,
    tCommon,
    tEnum,
    tLib,
    setType,
    setYearSlider,
    setFacetChecked,
  ]);

  const handleOpenSong = useCallback(
    (songId: number) => {
      bumpNavDepth();
      flushUrlState();
      router.push(`/song/${songId}`);
    },
    [router],
  );

  const jumpToYear = useCallback((year: number | null) => {
    const key = String(year ?? "unknown");
    document
      .getElementById(`y${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleReset = useCallback(() => {
    resetAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resetAll]);

  const toggleAdvanced = useCallback(() => {
    state.setAdvanced(!state.advanced);
  }, [state]);

  // 完整筛选面板：将「类型」作为第一行纯文字书卷选项，与年份滑轨及 5 维筛选浑然一体
  const fullFilterContent = (
    <div className="space-y-6">
      <div className="grid gap-y-2.5 border-b border-slate-200/70 pb-5 lg:grid-cols-[auto_1fr] lg:items-baseline lg:gap-x-8 dark:border-slate-800">
        <span className={FIELD_LABEL_CLASS}>{tLib("filter.type")}</span>
        <div className="flex flex-wrap items-baseline gap-y-2">
          {options.types.map((opt, idx) => {
            const active = state.filters.type === opt;
            const label =
              opt === FILTER_OPTION_ALL
                ? tCommon("all")
                : opt === FILTER_OPTION_UNKNOWN
                  ? tCommon("unknown")
                  : enumLabel(tEnum, "type", opt);
            return (
              <Fragment key={opt}>
                {idx > 0 && (
                  <span aria-hidden className="mx-2.5 text-ink-faint">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => state.setType(opt)}
                  className={cn(
                    "font-serif text-sm tracking-wider transition-colors",
                    active ? "text-(--tone)" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      {SongFilters ? (
        <SongFilters
          options={options}
          checked={state.checked}
          onFacetChange={state.setFacetChecked}
          available={available}
          yearSlider={state.yearSlider}
          onYearChange={state.setYearSlider}
        />
      ) : (
        <div aria-hidden className="h-56 lg:h-24" />
      )}
    </div>
  );

  // 方案一与方案二共用的极净检目行：常态右栏大片留白，只在筛选或输入时才显命中数与条件注脚
  const quietSearchBar = (
    <div className="grid items-center gap-x-6 border-b border-slate-200/75 py-2.5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)] dark:border-slate-800/80">
      <div className="flex items-center justify-between gap-4">
        <SearchInputLine
          value={state.searchInput}
          onChange={state.setSearchInput}
          onFocus={handleSearchFocus}
          lyricsState={lyrics.state}
        />

        <div className="flex shrink-0 items-center gap-3 lg:hidden">
          {matched && (
            <SongCount
              shownCount={shownCount}
              totalCount={catalog.length}
              matched={matched}
            />
          )}
          {state.isAnyFilterActive && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs tracking-[0.22em] text-(--tone) transition-opacity hover:opacity-75"
            >
              重置
            </button>
          )}
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-pressed={state.advanced}
            className={cn(
              "text-xs tracking-[0.25em] transition-colors",
              state.advanced || activeChips.length > 0
                ? "text-(--tone)"
                : "text-ink-muted hover:text-ink",
            )}
          >
            筛选
            {activeChips.length > 0 && (
              <span className="ml-1 font-mono tabular-nums">
                · {activeChips.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="hidden min-w-0 items-center justify-between gap-6 lg:flex">
        <div className="flex min-w-0 flex-wrap items-baseline gap-y-1 text-xs">
          {activeChips.map((chip, idx) => (
            <Fragment key={chip.key}>
              {idx > 0 && (
                <span aria-hidden className="mx-2.5 text-ink-faint">
                  ·
                </span>
              )}
              <button
                type="button"
                onClick={chip.onRemove}
                title="点击撤回此项筛选"
                className="group inline-flex items-baseline gap-1 font-kaiti text-[13px] text-ink-prose transition-colors hover:text-(--tone)"
              >
                <span>{chip.label}</span>
                <span className="font-sans text-[11px] text-ink-meta transition-colors group-hover:text-(--tone)">
                  ×
                </span>
              </button>
            </Fragment>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-4 text-xs tracking-[0.28em]">
          {matched && (
            <>
              <SongCount
                shownCount={shownCount}
                totalCount={catalog.length}
                matched={matched}
              />
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
            </>
          )}
          {state.isAnyFilterActive && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="text-(--tone) transition-opacity hover:opacity-75"
              >
                重置
              </button>
              <span aria-hidden className="text-ink-faint">
                ·
              </span>
            </>
          )}
          <button
            type="button"
            onClick={toggleAdvanced}
            aria-pressed={state.advanced}
            className={cn(
              "transition-colors",
              state.advanced || activeChips.length > 0
                ? "text-(--tone)"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {state.advanced
              ? "收起筛选"
              : activeChips.length > 0
                ? `筛选 · ${activeChips.length}`
                : "筛选"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <OverlayHostContext.Provider value={overlayHost}>
      <div className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] transition-colors duration-500 dark:bg-[#0B0F19]">
        <TopBar
          exit={{ kind: "logo", onClick: handleReset, tooltip: "回到卷首" }}
          nav={
            <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-ink-meta sm:inline-flex">
              <span aria-hidden>/</span>
              <span>二十年</span>
            </span>
          }
        />

        <main className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 md:pt-28">
          {/* ── 1. 卷首：三套彻底解耦的构图 ── */}
          {scheme === "folio" && (
            <FolioHero
              firstYear={firstYear}
              lastYear={lastYear}
              totalCount={catalog.length}
              features={features}
            />
          )}

          {scheme === "string" && (
            <StringHero
              firstYear={firstYear}
              lastYear={lastYear}
              features={features}
            />
          )}

          {scheme === "paper-screen" && (
            <PaperFoldingScreen
              panels={panels}
              firstYear={firstYear}
              lastYear={lastYear}
              matched={matched}
              features={features}
              searchInput={state.searchInput}
              onSearchChange={state.setSearchInput}
              onSearchFocus={handleSearchFocus}
              lyricsState={lyrics.state}
              advanced={state.advanced}
              onToggleAdvanced={toggleAdvanced}
              activeChips={activeChips}
              isAnyFilterActive={state.isAnyFilterActive}
              onReset={handleReset}
              shownCount={shownCount}
              totalCount={catalog.length}
              onJump={jumpToYear}
            />
          )}

          {/* ── 2. 吸顶层：随所选方案呈现各自最干净的形态 ── */}
          <div ref={sentinelRef} aria-hidden />
          <div
            ref={stickyRef}
            className="sticky top-(--nav-h) z-30 -mx-6 bg-[#FAFAFA]/95 px-6 backdrop-blur-sm dark:bg-[#0B0F19]/95"
          >
            {scheme === "folio" && quietSearchBar}

            {scheme === "string" && (
              <>
                <ChronicleString
                  ref={railRef}
                  panels={panels}
                  matched={matched}
                  folded={folded}
                  onJump={jumpToYear}
                />
                {quietSearchBar}
              </>
            )}

            {scheme === "paper-screen" && (
              <PaperStickyBar
                ref={railRef}
                visible={folded}
                panels={panels}
                matched={matched}
                searchInput={state.searchInput}
                onSearchChange={state.setSearchInput}
                onSearchFocus={handleSearchFocus}
                lyricsState={lyrics.state}
                advanced={state.advanced}
                onToggleAdvanced={toggleAdvanced}
                activeChips={activeChips}
                isAnyFilterActive={state.isAnyFilterActive}
                onReset={handleReset}
                shownCount={shownCount}
                totalCount={catalog.length}
                onJump={jumpToYear}
                onTop={scrollToTop}
              />
            )}

            {/* 窄屏已选筛选注脚行（方案三在卷首已内嵌进扉页，吸顶后才在此展示） */}
            {activeChips.length > 0 &&
              (scheme !== "paper-screen" || folded) && (
                <div className="flex flex-wrap items-baseline gap-y-1 border-b border-slate-200/60 py-2 text-xs lg:hidden dark:border-slate-800/70">
                  {activeChips.map((chip, idx) => (
                    <Fragment key={chip.key}>
                      {idx > 0 && (
                        <span aria-hidden className="mx-2 text-ink-faint">
                          ·
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={chip.onRemove}
                        className="inline-flex items-baseline gap-1 font-kaiti text-xs text-ink-prose"
                      >
                        <span>{chip.label}</span>
                        <span className="font-sans text-[10px] text-ink-meta">
                          ×
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              )}

            {/* 宽屏内联展开完整筛选（类型 + 年份滑轨 + 5 维多选） */}
            {state.advanced && isDesktop && (
              <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/75 pt-6 pb-7 duration-300 dark:border-slate-800">
                {fullFilterContent}
              </div>
            )}
          </div>

          {/* 方案一专属：视口右缘「书口色签」 */}
          {scheme === "folio" && (
            <ForeEdgeRail
              ref={railRef}
              panels={panels}
              matched={matched}
              onJump={jumpToYear}
            />
          )}

          {/* 移动端底部抽屉承载完整筛选 */}
          {!isDesktop && (
            <Drawer open={state.advanced} onOpenChange={state.setAdvanced}>
              <DrawerContent title={tLib("advancedFilter")}>
                <div className="pt-2">{fullFilterContent}</div>
                <div className="mt-8 flex items-center justify-between border-t border-slate-200/75 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!state.isAnyFilterActive}
                    className="text-xs tracking-widest text-ink-meta transition-colors hover:text-ink-prose disabled:opacity-40"
                  >
                    {tLib("filter.clearAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => state.setAdvanced(false)}
                    className="rounded-full bg-(--tone) px-5 py-2 text-xs tracking-[0.2em] text-white dark:text-slate-950"
                  >
                    查看 {shownCount} 首
                  </button>
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {approximate && (
            <p className="mt-6 font-kaiti text-[15px] text-ink-meta">
              {tLib("search.approximate")}
            </p>
          )}

          {/* ── 3. 编年目录正文 ── */}
          <div className={cn(scheme === "paper-screen" && "mt-4 md:mt-6")}>
            {shownCount === 0 ? (
              <p className="py-24 text-center font-kaiti text-[15px] text-ink-meta">
                {lyricsPending
                  ? tLib("search.lyricsPending")
                  : tLib("noFilteredSongs")}
              </p>
            ) : (
              <YearChapters
                chapters={chapters}
                matched={matched}
                onOpenSong={handleOpenSong}
                getLyricsSnippet={getLyricsSnippet}
                onActiveYearChange={setActiveYearKey}
              />
            )}
          </div>

          {lyricsPending && shownCount > 0 && (
            <p className="mt-8 font-kaiti text-[15px] text-ink-meta">
              {tLib("search.lyricsPending")}
            </p>
          )}

          <footer className="mt-14 flex flex-wrap items-baseline justify-between gap-4 border-t border-slate-200/75 pt-8 dark:border-slate-800">
            <SiteMark />
            <p className="font-kaiti text-sm text-ink-meta">未完。</p>
          </footer>
        </main>

        <HeaderSchemeSwitcher value={scheme} onChange={setScheme} />

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
