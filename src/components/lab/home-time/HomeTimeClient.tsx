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
import { FoldedStrip, type StripHandle } from "./FoldedStrip";
import {
  type FeatureData,
  SongCount,
  TimeScreen,
  buildPanels,
} from "./TimeScreen";
import YearChapters from "./YearChapters";
import { byDateDesc, groupByYear } from "./timeline";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * 首页原型「二十年」：屏风即时间轴。
 * - 卷首：一架屏风（TimeScreen）。最左序屏是题头与三处特展，其后一年一扇、由近及远，末尾未详；
 * - 往下读时屏风合成吸顶细带（FoldedStrip），开着的那一扇跟着正在读的年份走，取代右侧年份标尺；
 * - 检目线始终贴在屏风 / 细带下沿：搜索与筛选让屏扇、切片原地明暗；
 * - 正文：编年目录，一章一画幅 + 右栏行目。
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

  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  // 细带自己管正在读的年份：滚过年份时只重渲细带，不牵动整页
  const stripRef = useRef<StripHandle>(null);
  const setActiveYearKey = useCallback(
    (key: string) => stripRef.current?.setActive(key),
    [],
  );

  // 屏风滚出去、检目线吸住顶栏的那一刻，细带出现
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
  }, []);

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

  // 将当前激活的筛选条件整理成书眉上的轻柔文字注脚，点任意一项可直接单项撤回
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

  return (
    <OverlayHostContext.Provider value={overlayHost}>
      <div className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] transition-colors duration-500 dark:bg-[#0B0F19]">
        <TopBar
          exit={{ kind: "logo", onClick: handleReset, tooltip: "回到卷首" }}
          nav={
            <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-ink-meta sm:inline-flex">
              <span aria-hidden>/</span>
              <span>二十年的颜色</span>
            </span>
          }
        />

        <main className="relative mx-auto max-w-7xl px-6 pt-26 pb-28 md:pt-32">
          {/* ── 1. 卷首：屏风展开 ── */}
          <TimeScreen
            panels={panels}
            firstYear={firstYear}
            lastYear={lastYear}
            totalCount={catalog.length}
            matched={matched}
            features={features}
            onJump={jumpToYear}
          />

          {/* ── 2. 吸顶：合起的屏风 + 检目线。卷首时细带隐去，只留出一段空白 ── */}
          <div ref={sentinelRef} aria-hidden />
          <div
            ref={stickyRef}
            className="sticky top-(--nav-h) z-30 -mx-6 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-sm dark:bg-[#0B0F19]/95"
          >
            <FoldedStrip
              ref={stripRef}
              panels={panels}
              matched={matched}
              visible={folded}
              onJump={jumpToYear}
              onTop={scrollToTop}
            />
            <div className="grid items-center gap-x-6 border-b border-slate-200/75 py-2.5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)] dark:border-slate-800/80">
              {/* 左栏（与下方年份 & 大画幅严格左齐）：一根楷体寻曲底线，无图标堆砌 */}
              <div className="flex items-center justify-between gap-4">
                <label className="group relative flex min-w-0 flex-1 items-center gap-2 py-1">
                  <input
                    type="text"
                    placeholder="寻歌、词人或一句歌词……"
                    value={state.searchInput}
                    onFocus={handleSearchFocus}
                    onChange={(e) => state.setSearchInput(e.target.value)}
                    className="w-full min-w-0 bg-transparent font-kaiti text-[15px] text-ink-body outline-none placeholder:text-ink-meta"
                  />
                  {state.searchInput ? (
                    <button
                      type="button"
                      onClick={() => state.setSearchInput("")}
                      className="shrink-0 text-[11px] tracking-[0.2em] text-ink-meta transition-colors hover:text-ink-body"
                    >
                      清空
                    </button>
                  ) : lyrics.state === "loading" ? (
                    <span
                      aria-label="歌词检索准备中"
                      className="block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600"
                    />
                  ) : lyrics.state === "ready" ? (
                    <span className="shrink-0 text-[10px] tracking-[0.2em] text-(--tone)/65">
                      含词
                    </span>
                  ) : null}

                  {/* 聚焦时细底线才缓缓亮起强调色 */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -bottom-2.5 h-[1.5px] bg-(--tone) opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
                  />
                </label>

                {/* 窄屏把「筛选 / 重置」紧贴同一行右侧，整条检目线只占一行 */}
                <div className="flex shrink-0 items-center gap-3 lg:hidden">
                  <SongCount
                    shownCount={shownCount}
                    totalCount={catalog.length}
                    matched={matched}
                  />
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
                    onClick={() => state.setAdvanced(!state.advanced)}
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

              {/* 右栏（宽屏，与下方编年目录严格左齐）：已选条件轻注脚 + 「筛选」纯文字开关 */}
              <div className="hidden items-center justify-between gap-6 lg:flex">
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
                  <SongCount
                    shownCount={shownCount}
                    totalCount={catalog.length}
                    matched={matched}
                  />
                  <span aria-hidden className="text-ink-faint">
                    ·
                  </span>
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
                    onClick={() => state.setAdvanced(!state.advanced)}
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

            {/* 窄屏已选筛选注脚行：仅在真的有筛选条件时才轻轻露出一行 */}
            {activeChips.length > 0 && (
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
              <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/75 pb-7 pt-6 duration-300 dark:border-slate-800">
                {fullFilterContent}
              </div>
            )}
          </div>

          {/* 移动端底部抽屉承载完整筛选（类型 + 年份滑轨 + 5 维多选） */}
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

          {/* ── 4. 编年目录正文（由近及远，一年一画幅 + 右侧编年行目） ── */}
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

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
