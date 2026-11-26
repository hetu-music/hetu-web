"use client";

import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Fragment,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type ActiveChip,
  EASE,
  ENTRANCE_DEFS,
  type FeatureData,
  FeatureEpigraph,
  type FeatureKey,
  HOVER_INTENT_MS,
  type ScreenPanel,
  SearchInputLine,
  SongCount,
  type YearRailHandle,
  panelLit,
} from "./header-shared";
import { creditSummary, stripeColor } from "./timeline";

const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

/**
 * 方案三 · 素骨折屏：整块卷首只有这一架折屏，屏外不叠标题栏也不另起工具栏。
 * - 最左首扇（宽 20/22rem，与正文左栏同轴）是素白扉页：收齐题名、活题字、三径入口与寻曲底线；
 * - 右侧二十一扇默认退为素纸折骨（不放花哨裁切封面），只有展开的那唯一一扇才显出完整画作。
 */
export function PaperFoldingScreen({
  panels,
  firstYear,
  lastYear,
  matched,
  features,
  searchInput,
  onSearchChange,
  onSearchFocus,
  lyricsState,
  advanced,
  onToggleAdvanced,
  activeChips,
  isAnyFilterActive,
  onReset,
  shownCount,
  totalCount,
  onJump,
}: {
  panels: ScreenPanel[];
  firstYear: number;
  lastYear: number;
  matched: ReadonlySet<number> | null;
  features: FeatureData;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  lyricsState: LyricsSearchState;
  advanced: boolean;
  onToggleAdvanced: () => void;
  activeChips: ActiveChip[];
  isAnyFilterActive: boolean;
  onReset: () => void;
  shownCount: number;
  totalCount: number;
  onJump: (year: number | null) => void;
}) {
  const isTouch = useSyncExternalStore(
    subscribeHoverNone,
    getHoverNone,
    getHoverNoneServer,
  );
  const [openKey, setOpenKey] = useState(panels[0]?.key ?? "");
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const resolvedOpenKey = panels.some((p) => p.key === openKey)
    ? openKey
    : (panels[0]?.key ?? "");

  const hoverOpen = (key: string) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setOpenKey(key), HOVER_INTENT_MS);
  };

  return (
    <header className="pt-2 pb-2 md:pt-4">
      <div className="flex flex-col gap-3 lg:h-[21rem] lg:flex-row lg:items-stretch lg:gap-3 xl:h-[23rem]">
        {/* ── 首扇素白扉页（严格同轴 20/22rem）：题字 · 入口 · 寻曲全收于一扇留白中 ── */}
        <div className="flex w-full shrink-0 flex-col justify-between rounded-[2px] border border-slate-200/80 bg-[#FAFAFA] px-6 py-6 lg:w-[20rem] xl:w-[22rem] xl:px-7 xl:py-7 dark:border-slate-800/85 dark:bg-[#0B0F19]">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="font-serif text-4xl font-semibold leading-none tracking-[0.06em] text-ink xl:text-[2.65rem]">
                二十年
              </h1>
              <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-ink-meta">
                {lastYear}—{firstYear}
              </span>
            </div>

            <FeatureEpigraph
              feature={feature}
              features={features}
              className="mt-4 text-[14px] leading-relaxed xl:text-[15px]"
            />

            <nav
              aria-label="特展"
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 xl:mt-7 xl:gap-x-6"
            >
              {ENTRANCE_DEFS.map((item, idx) => {
                const active = feature === item.key;
                return (
                  <Fragment key={item.key}>
                    {idx > 0 && (
                      <span aria-hidden className="text-ink-faint">
                        ·
                      </span>
                    )}
                    <Link
                      href={item.href}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") setFeature(item.key);
                      }}
                      onPointerLeave={() => setFeature(null)}
                      onFocus={() => setFeature(item.key)}
                      onBlur={() => setFeature(null)}
                      className={cn(
                        "font-calligraphy text-[18px] leading-none tracking-[0.2em] outline-none transition-colors duration-300 xl:text-[19px]",
                        active
                          ? "text-(--tone)"
                          : "text-ink-prose hover:text-(--tone) focus-visible:text-(--tone)",
                      )}
                    >
                      {item.name}
                    </Link>
                  </Fragment>
                );
              })}
            </nav>
          </div>

          {/* 扉页下沿直接安放寻曲底线与筛选开关：屏外零多余工具条 */}
          <div className="mt-6 border-t border-slate-200/75 pt-3 lg:mt-0 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <SearchInputLine
                value={searchInput}
                onChange={onSearchChange}
                onFocus={onSearchFocus}
                lyricsState={lyricsState}
                underlineOffset="-bottom-1"
              />
              <button
                type="button"
                onClick={onToggleAdvanced}
                aria-pressed={advanced}
                className={cn(
                  "shrink-0 text-xs tracking-[0.24em] transition-colors",
                  advanced || activeChips.length > 0
                    ? "text-(--tone)"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {advanced
                  ? "收起"
                  : activeChips.length > 0
                    ? `筛选·${activeChips.length}`
                    : "筛选"}
              </button>
            </div>

            {(isAnyFilterActive || activeChips.length > 0) && (
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <SongCount
                    shownCount={shownCount}
                    totalCount={totalCount}
                    matched={matched}
                  />
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="font-kaiti text-xs text-ink-prose transition-colors hover:text-(--tone)"
                    >
                      {chip.label} ×
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onReset}
                  className="shrink-0 text-[11px] tracking-[0.2em] text-(--tone) hover:opacity-75"
                >
                  重置
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 右侧二十一扇素骨折屏：闭合扇为纯素纸折骨，仅展开的唯一一扇显画 ── */}
        <div
          role="list"
          aria-label="二十年素骨折屏"
          className="no-scrollbar -mx-6 flex h-72 min-w-0 flex-1 gap-[2px] overflow-x-auto px-6 lg:mx-0 lg:h-full lg:overflow-visible lg:px-0 [--open-w:15.5rem] md:[--open-w:17.5rem] lg:[--open-w:17rem] xl:[--open-w:20.5rem]"
          onPointerLeave={() => window.clearTimeout(intent.current)}
        >
          {panels.map((p, idx) => {
            const isOpen = p.key === resolvedOpenKey;
            const lit = panelLit(p, matched);
            const dotColor = p.song ? stripeColor(p.song) : undefined;
            const shortYear = p.year !== null ? String(p.year) : "未详";

            return (
              <div
                key={p.key}
                role="listitem"
                className="min-w-7 transition-[flex-grow,flex-basis,opacity] duration-700 ease-page lg:min-w-0"
                style={{
                  flex: isOpen ? "0 0 var(--open-w)" : "1 1 0%",
                  opacity: lit ? 1 : 0.22,
                }}
              >
                <button
                  type="button"
                  aria-label={
                    p.year === null
                      ? "年份未详"
                      : `${p.year} 年${p.song ? `，《${p.song.title}》` : ""}`
                  }
                  aria-expanded={isOpen}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") hoverOpen(p.key);
                  }}
                  onFocus={() => setOpenKey(p.key)}
                  onClick={() => {
                    if (isTouch && !isOpen) setOpenKey(p.key);
                    else onJump(p.year);
                  }}
                  className={cn(
                    "group relative flex h-full w-full flex-col overflow-hidden rounded-[2px] text-left ring-1 ring-inset ring-slate-900/[0.06] outline-none transition-colors duration-500 focus-visible:ring-2 focus-visible:ring-(--tone) dark:ring-white/[0.08]",
                    isOpen
                      ? "bg-[#FAFAFA] dark:bg-[#0B0F19]"
                      : idx % 2 === 0
                        ? "bg-slate-100/80 hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-900"
                        : "bg-slate-200/45 hover:bg-slate-100 dark:bg-slate-800/55 dark:hover:bg-slate-900",
                  )}
                >
                  {/* 闭合素纸折骨：零裁切封面，只留一粒当年主色微点与竖排淡墨年份 */}
                  {!isOpen && (
                    <div className="flex h-full w-full flex-col items-center justify-between py-4">
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-transform duration-300 group-hover:scale-125",
                          !dotColor && "bg-slate-400/70 dark:bg-slate-500/70",
                        )}
                        style={
                          dotColor ? { backgroundColor: dotColor } : undefined
                        }
                      />
                      <span className="font-mono text-[9px] leading-none tabular-nums tracking-[0.18em] text-ink-meta/70 transition-colors duration-300 [writing-mode:vertical-rl] group-hover:text-ink-prose">
                        {shortYear}
                      </span>
                    </div>
                  )}

                  {/* 唯一展开的那一扇：完整画作 + 极素底签，画面不缩放不抖动 */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        key={p.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        className="flex h-full w-full flex-col"
                      >
                        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
                          {p.song && p.art ? (
                            <Image
                              src={getCoverUrl(p.song)}
                              alt=""
                              fill
                              sizes="360px"
                              draggable={false}
                              className="object-cover transition-transform duration-700 ease-page group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="font-serif text-base tracking-[0.4em] text-ink-meta [writing-mode:vertical-rl]">
                                {p.song ? p.song.title : "年份未详"}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 border-t border-slate-200/75 bg-[#FAFAFA] px-4 py-2.5 dark:border-slate-800/80 dark:bg-[#0B0F19]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-(--tone)">
                              {p.year ?? "未详"}
                            </span>
                            {p.ids.size > 0 && (
                              <span className="font-mono text-[10px] tabular-nums tracking-wider text-ink-meta">
                                {p.ids.size} 曲
                              </span>
                            )}
                          </div>
                          {p.song && (
                            <p className="mt-1 truncate font-serif text-sm text-ink">
                              《{p.song.title}》
                            </p>
                          )}
                          {p.song && creditSummary(p.song) && (
                            <p className="mt-0.5 truncate font-kaiti text-[11px] text-ink-muted">
                              {creditSummary(p.song)}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

/**
 * 方案三吸顶条：卷首折屏在视口内时占高为 0（屏外零多余横栏）；
 * 向下读进编年正文后，顺势滑出一道极薄的「寻曲 + 疏朗纪年尺」吸顶线。
 */
export function PaperStickyBar({
  ref,
  visible,
  panels,
  matched,
  searchInput,
  onSearchChange,
  onSearchFocus,
  lyricsState,
  advanced,
  onToggleAdvanced,
  activeChips,
  isAnyFilterActive,
  onReset,
  shownCount,
  totalCount,
  onJump,
  onTop,
}: {
  ref: Ref<YearRailHandle>;
  visible: boolean;
  panels: ScreenPanel[];
  matched: ReadonlySet<number> | null;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  lyricsState: LyricsSearchState;
  advanced: boolean;
  onToggleAdvanced: () => void;
  activeChips: ActiveChip[];
  isAnyFilterActive: boolean;
  onReset: () => void;
  shownCount: number;
  totalCount: number;
  onJump: (year: number | null) => void;
  onTop: () => void;
}) {
  const [activeKey, setActiveKey] = useState(panels[0]?.key ?? "");
  useImperativeHandle(ref, () => ({ setActive: setActiveKey }), []);

  // 只列逢五节点 + 首尾 + 当前正在阅读的年份，保持一行极度疏朗
  const landmarkPanels = panels.filter((p, idx) => {
    if (p.key === activeKey) return true;
    if (idx === 0 || idx === panels.length - 1) return true;
    return typeof p.year === "number" && p.year % 5 === 0;
  });

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-400 ease-page",
        visible
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <div
          inert={!visible}
          className="grid items-center gap-x-6 border-b border-slate-200/75 py-2.5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)] dark:border-slate-800/80"
        >
          <div className="flex items-center justify-between gap-4">
            <SearchInputLine
              value={searchInput}
              onChange={onSearchChange}
              onFocus={onSearchFocus}
              lyricsState={lyricsState}
            />
            <div className="flex shrink-0 items-center gap-3 lg:hidden">
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs tracking-[0.2em] text-(--tone)"
                >
                  重置
                </button>
              )}
              <button
                type="button"
                onClick={onToggleAdvanced}
                className={cn(
                  "text-xs tracking-[0.24em]",
                  advanced || activeChips.length > 0
                    ? "text-(--tone)"
                    : "text-ink-muted",
                )}
              >
                筛选
              </button>
            </div>
          </div>

          <div className="hidden min-w-0 items-center justify-between gap-6 lg:flex">
            <div className="flex min-w-0 items-center gap-4 overflow-hidden">
              <button
                type="button"
                onClick={onTop}
                title="回到卷首"
                className="shrink-0 font-serif text-xs font-semibold tracking-[0.28em] text-ink transition-colors hover:text-(--tone)"
              >
                二十年
              </button>
              <span
                aria-hidden
                className="h-3 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
              />
              <nav
                aria-label="年份跳转"
                className="flex items-baseline gap-3.5"
              >
                {landmarkPanels.map((p) => {
                  const isCurrent = p.key === activeKey;
                  const lit = panelLit(p, matched);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => onJump(p.year)}
                      className={cn(
                        "font-mono text-[11px] tabular-nums tracking-wider transition-colors",
                        isCurrent
                          ? "font-medium text-(--tone)"
                          : "text-ink-meta hover:text-ink-body",
                        !lit && "opacity-25",
                      )}
                    >
                      {p.year ?? "未详"}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-4 text-xs tracking-[0.26em]">
              {matched && (
                <>
                  <SongCount
                    shownCount={shownCount}
                    totalCount={totalCount}
                    matched={matched}
                  />
                  <span aria-hidden className="text-ink-faint">
                    ·
                  </span>
                </>
              )}
              {isAnyFilterActive && (
                <>
                  <button
                    type="button"
                    onClick={onReset}
                    className="text-(--tone) hover:opacity-75"
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
                onClick={onToggleAdvanced}
                aria-pressed={advanced}
                className={cn(
                  "transition-colors",
                  advanced || activeChips.length > 0
                    ? "text-(--tone)"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {advanced
                  ? "收起筛选"
                  : activeChips.length > 0
                    ? `筛选 · ${activeChips.length}`
                    : "筛选"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
