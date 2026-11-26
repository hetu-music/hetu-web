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
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  Fragment,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { FoldedStrip, type StripHandle } from "./FoldedStrip";
import {
  type FeatureData,
  HEADER_VARIANTS,
  type HeaderVariant,
  type ScreenPanel,
  SongCount,
  TimeScreen,
  buildPanels,
} from "./TimeScreen";
import YearChapters from "./YearChapters";
import { byDateDesc, creditSummary, groupByYear } from "./timeline";

const NO_FACET_OPTIONS = mapFacets((): FacetOption[] => []);

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ShelfCaptionHandle {
  setReading: (key: string) => void;
  setStripHover: (key: string | null) => void;
}

/**
 * 检目线右栏常态槽位：未启筛选条件时，稳稳托住当前展开屏扇的题跋；
 * 滚动吸顶后切换为正在阅读（或悬停细带）的年份落款。
 * 通过 ref 接收滚动年份更新，滚动时只重渲这一小段，不牵动整页与正文目录。
 */
function ShelfCaption({
  ref,
  variant,
  panels,
  openKey,
  folded,
  onJump,
  onTop,
}: {
  ref: Ref<ShelfCaptionHandle>;
  variant: HeaderVariant;
  panels: ScreenPanel[];
  openKey: string;
  folded: boolean;
  onJump: (year: number | null) => void;
  onTop: () => void;
}) {
  const [readingKey, setReadingKey] = useState(panels[0]?.key ?? "");
  const [stripHoverKey, setStripHoverKey] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      setReading: setReadingKey,
      setStripHover: setStripHoverKey,
    }),
    [],
  );

  const activeKey = folded ? (stripHoverKey ?? readingKey) : openKey;
  const panel = useMemo(
    () => panels.find((p) => p.key === activeKey) ?? panels[0] ?? null,
    [panels, activeKey],
  );

  if (!panel) return null;

  return (
    <div className="flex min-w-0 items-baseline gap-2.5 overflow-hidden">
      {/* 方案一细带全宽收拢，无左栏「二十年」按钮，在此处提供轻巧归顶入口 */}
      {folded && variant === "masthead" && (
        <>
          <button
            type="button"
            onClick={onTop}
            title="回到卷首"
            className="shrink-0 font-serif text-xs font-semibold tracking-[0.25em] text-ink-muted transition-colors hover:text-(--tone)"
          >
            ↑ 二十年
          </button>
          <span aria-hidden className="shrink-0 text-ink-faint">
            ·
          </span>
        </>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key={`${folded ? "f" : "o"}-${panel.key}`}
          type="button"
          onClick={() => onJump(panel.year)}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="group flex min-w-0 items-baseline gap-2 text-left outline-none"
        >
          <span className="shrink-0 font-mono text-[11px] tabular-nums tracking-[0.18em] text-(--tone)">
            {panel.year ?? "未详"}
          </span>
          {panel.ids.size > 0 && (
            <span className="shrink-0 font-mono text-[10px] tabular-nums tracking-wider text-ink-meta">
              {panel.ids.size} 曲
            </span>
          )}
          {panel.song && (
            <>
              <span aria-hidden className="shrink-0 text-ink-faint">
                —
              </span>
              <span className="truncate font-serif text-[14px] text-ink transition-colors group-hover:text-(--tone)">
                《{panel.song.title}》
              </span>
              {creditSummary(panel.song) && (
                <span className="hidden truncate font-kaiti text-xs text-ink-muted xl:inline">
                  {creditSummary(panel.song)}
                </span>
              )}
            </>
          )}
        </motion.button>
      </AnimatePresence>
    </div>
  );
}

/** 底部左下角极简方案切换胶囊：支持点击与数字键 1 / 2 即时对比两套头部设计 */
function HeaderVariantSwitcher({
  value,
  onChange,
}: {
  value: HeaderVariant;
  onChange: (next: HeaderVariant) => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const next = HEADER_VARIANTS[Number(e.key) - 1];
      if (next) onChange(next.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChange]);

  const current = HEADER_VARIANTS.find((v) => v.id === value);

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
        {HEADER_VARIANTS.map((v, idx) => {
          const active = v.id === value;
          return (
            <Fragment key={v.id}>
              {idx > 0 && (
                <span aria-hidden className="mx-0.5 text-[10px] text-ink-faint">
                  ·
                </span>
              )}
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChange(v.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs tracking-wider transition-colors",
                  active
                    ? "font-serif font-semibold text-(--tone)"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <span>{v.code}</span>
                <span className="ml-1">{v.label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 首页原型「二十年」：屏风、时间轴、题字、入口、搜索栏一体化方案对比页。
 * - 卷首支持两套完整架构实时切换：一 · 题眉通屏 / 二 · 素绢引首；
 * - 屏风底部落古琴徽位时间弦，仅疏标首尾、逢五与当前展开年；
 * - 检目线紧承屏底作下槛，左栏严格对齐下方大画幅，右栏常态承载展开扇题跋；
 * - 向下滚过屏风时，吸顶细带从 0 高度顺势抽出，与上方屏风逐扇同构收合。
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

  const [variant, setVariant] = useState<HeaderVariant>("masthead");
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // 细带与书眉落款各自管正在读的年份：滚过年份时只局部更新，不牵动整页
  const stripRef = useRef<StripHandle>(null);
  const captionRef = useRef<ShelfCaptionHandle>(null);
  const setActiveYearKey = useCallback((key: string) => {
    stripRef.current?.setActive(key);
    captionRef.current?.setReading(key);
  }, []);
  const handleStripHoverChange = useCallback((key: string | null) => {
    captionRef.current?.setStripHover(key);
  }, []);

  // 屏风滚出去、检目线吸住顶栏的那一刻，细带从 0 高度平滑抽出
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
  }, [variant]);

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

  const [openPanelKey, setOpenPanelKey] = useState(
    () => panels[0]?.key ?? String(lastYear),
  );
  const resolvedOpenKey = panels.some((p) => p.key === openPanelKey)
    ? openPanelKey
    : (panels[0]?.key ?? "");

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

        <main className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 md:pt-28">
          {/* ── 1. 卷首：题字 · 入口 · 折屏 · 琴徽时间弦 ── */}
          <TimeScreen
            variant={variant}
            panels={panels}
            openKey={resolvedOpenKey}
            firstYear={firstYear}
            lastYear={lastYear}
            matched={matched}
            features={features}
            onOpenChange={setOpenPanelKey}
            onJump={jumpToYear}
          />

          {/* ── 2. 吸顶：合起的屏风（卷首时占高为 0） + 下槛检目线 ── */}
          <div ref={sentinelRef} aria-hidden />
          <div
            ref={stickyRef}
            className="sticky top-(--nav-h) z-30 -mx-6 bg-[#FAFAFA]/95 px-6 backdrop-blur-sm dark:bg-[#0B0F19]/95"
          >
            <FoldedStrip
              ref={stripRef}
              variant={variant}
              panels={panels}
              matched={matched}
              visible={folded}
              onJump={jumpToYear}
              onTop={scrollToTop}
              onHoverKeyChange={handleStripHoverChange}
            />
            <div className="grid items-center gap-x-6 border-b border-slate-200/75 py-2.5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)] dark:border-slate-800/80">
              {/* 左栏（与下方年份 & 大画幅严格左齐）：一枚刻本「寻」字引 + 楷体寻曲底线 */}
              <div className="flex items-center justify-between gap-4">
                <label className="group relative flex min-w-0 flex-1 items-baseline gap-2.5 py-1">
                  <span
                    aria-hidden
                    className="shrink-0 font-calligraphy text-[15px] leading-none text-ink-meta transition-colors duration-300 group-focus-within:text-(--tone)"
                  >
                    寻
                  </span>
                  <input
                    type="text"
                    placeholder="歌名、词人或一句歌词……"
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
                      className="block h-2.5 w-2.5 shrink-0 self-center animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600"
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

                {/* 窄屏把曲数与「筛选 / 重置」紧贴同一行右侧，整条检目线只占一行 */}
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

              {/* 右栏（宽屏，与下方编年目录严格左齐）：常态承接屏扇题跋，筛选时切换为条件注脚 */}
              <div className="hidden min-w-0 items-center justify-between gap-6 lg:flex">
                {activeChips.length > 0 ? (
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
                ) : (
                  <ShelfCaption
                    ref={captionRef}
                    variant={variant}
                    panels={panels}
                    openKey={resolvedOpenKey}
                    folded={folded}
                    onJump={jumpToYear}
                    onTop={scrollToTop}
                  />
                )}

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

          {/* ── 3. 编年目录正文（由近及远，一年一画幅 + 右侧编年行目） ── */}
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

        <HeaderVariantSwitcher value={variant} onChange={setVariant} />

        <FloatingActionButtons
          showScrollTop={showScrollTop}
          onScrollToTop={scrollToTop}
        />
        <div ref={setOverlayHost} />
      </div>
    </OverlayHostContext.Provider>
  );
}
