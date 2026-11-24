"use client";

import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, { Fragment, useEffect, useState } from "react";
import ColorTapestry from "./ColorTapestry";
import { CORE_FEATURES, type FeatureEntranceItem } from "./FeatureEntrances";
import { HeaderDemoE as ScreenHeader } from "./HeaderDemoE";

export type HeaderVariant = "a" | "b" | "c" | "d" | "e";

export const HEADER_VARIANTS: readonly {
  id: HeaderVariant;
  code: string;
  label: string;
  note: string;
}[] = [
  {
    id: "a",
    code: "A",
    label: "别册同架",
    note: "左正面展册、右侧插唱片，同立一条架面",
  },
  {
    id: "b",
    code: "B",
    label: "中式书扉",
    note: "复刻歌曲页竖排刻本基因重构卷首",
  },
  {
    id: "c",
    code: "C",
    label: "唱片顶置",
    note: "开卷即见满架色彩，铭牌退居架下",
  },
  {
    id: "d",
    code: "D",
    label: "升格顶栏",
    note: "特辑进全站一级导航，卷首至纯",
  },
  {
    id: "e",
    code: "E",
    label: "二十扇屏",
    note: "二十扇屏 + 极轻切片横栏，不抢主视觉",
  },
];

const EASE = [0.23, 1, 0.32, 1] as const;

interface SharedHeaderProps {
  firstYear: number;
  lastYear: number;
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
  catalog: Song[];
  onOpenSong: (id: number) => void;
  onJumpYear: (year: number) => void;
}

/** 曲数动态跳变（四个原型复用，保持筛选反馈一致） */
function SongCount({
  shownCount,
  totalCount,
  matched,
  className,
}: {
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-serif text-sm tracking-[0.18em] text-ink-meta sm:text-base",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={shownCount}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.25 }}
          className={cn(
            "inline-block font-semibold tabular-nums",
            matched ? "text-(--tone)" : "text-ink-body",
          )}
        >
          {shownCount}
        </motion.span>
      </AnimatePresence>
      {matched ? ` / ${totalCount}` : ""} 曲
    </span>
  );
}

function accentStyle(item: FeatureEntranceItem): React.CSSProperties {
  return {
    "--ink-accent": item.accentLight,
    "--ink-accent-dark": item.accentDark,
  } as React.CSSProperties;
}

// ── 方向 A：同架分域（左正面展册 · 右侧插唱片） ───────────────────────────────

/**
 * 方向 A：如独立唱片店与藏书阁的「正面展台 + 侧插陈列架」——
 * 严格对齐下方 `20–22rem | 1fr` 两栏中轴线：
 * - 左栏：三册精装布面特辑别册正面朝你并排立于架面，不随唱片滚动、一眼直读题名，
 *   略高于右侧唱片，悬停向上轻抽并微探象牙内笺、顶行浮现完整导语；
 * - 右栏：二十年实体唱片侧插排布，滑过抽碟；
 * - 宽屏下两栏共立于同一条贯通全宽的架面承托细线。
 */
export function HeaderDemoA({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onOpenSong,
}: SharedHeaderProps) {
  const [hoveredFolio, setHoveredFolio] = useState<FeatureEntranceItem | null>(
    null,
  );

  return (
    <>
      <header className="pb-5 md:pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            <h1 className="font-serif text-4xl font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-5xl md:text-6xl">
              {lastYear}
              <span className="mx-[0.22em] font-light text-ink-faint">—</span>
              {firstYear}
            </h1>
            <SongCount
              shownCount={shownCount}
              totalCount={totalCount}
              matched={matched}
            />
          </div>

          <p className="hidden font-kaiti text-sm text-ink-muted md:block">
            三册特辑正面展陈，二十年声色侧插成排
          </p>
        </div>
      </header>

      {/* 同架两栏：严格对齐下方书眉检目线与编年目录的 20–22rem | 1fr 中轴 */}
      <div className="relative">
        <div className="grid gap-y-7 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* 左栏：固定特辑展台（正面朝你，不随唱片滚走） */}
          <section
            aria-label="馆藏特辑"
            className="flex min-w-0 flex-col justify-between select-none"
          >
            {/* 顶行耳语区：与右侧唱片架顶行同高对齐 */}
            <div className="mb-1 flex min-h-11 items-center">
              {hoveredFolio ? (
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="truncate font-serif text-[15px] text-ink sm:text-base">
                      《{hoveredFolio.title}》
                    </span>
                    <span
                      style={accentStyle(hoveredFolio)}
                      className="shrink-0 text-[11px] tracking-[0.22em] text-(--ink-accent) dark:text-(--ink-accent-dark)"
                    >
                      {hoveredFolio.tag}
                    </span>
                  </div>
                  <p className="truncate font-kaiti text-xs text-ink-muted">
                    {hoveredFolio.desc}
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[11px] tracking-[0.3em] text-(--tone)">
                    馆藏特辑
                  </span>
                  <span className="font-kaiti text-xs text-ink-meta">
                    三册别录
                  </span>
                </div>
              )}
            </div>

            {/* 正面展册排：底部 pb-6 与右侧唱片完全齐平，高度略高 12px 形成「精装特展」主次 */}
            <div className="relative flex flex-1 items-end pt-8 pb-6 lg:pt-0">
              {/* 展台隔片标识（与右侧 2026 隔片同语汇） */}
              <span
                aria-hidden
                className="pointer-events-none absolute top-1 left-0 flex items-center gap-1 text-[10px] tracking-[0.22em] text-(--tone) lg:top-0.5"
              >
                <span className="inline-block h-2.5 w-px bg-(--tone)/70" />
                特辑
              </span>

              <nav
                aria-label="站点特辑"
                className="grid w-full grid-cols-3 gap-3 xl:gap-3.5"
              >
                {CORE_FEATURES.map((item) => {
                  const isSelf = hoveredFolio?.id === item.id;
                  const isOther = hoveredFolio !== null && !isSelf;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onMouseEnter={() => setHoveredFolio(item)}
                      onMouseLeave={() => setHoveredFolio(null)}
                      onFocus={() => setHoveredFolio(item)}
                      onBlur={() => setHoveredFolio(null)}
                      className={cn(
                        "group relative block h-30 w-full outline-none transition-opacity duration-300 sm:h-33.5 lg:h-32.5",
                        isOther && "opacity-75",
                      )}
                    >
                      <div
                        className={cn(
                          "relative h-full w-full transition-transform duration-400 ease-page",
                          "group-hover:-translate-y-4 group-hover:scale-[1.03] group-focus-visible:-translate-y-4 group-focus-visible:scale-[1.03]",
                        )}
                      >
                        {/* 抽起时封套后方微探一截象牙纸内笺，呼应右侧黑胶边 */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-[12%] -top-[6%] h-[20%] rounded-t-[2px] border border-slate-900/10 bg-[#F3ECE0] opacity-0 transition-all duration-400 ease-page group-hover:-translate-y-1.5 group-hover:opacity-95 group-focus-visible:-translate-y-1.5 group-focus-visible:opacity-95 dark:border-white/15 dark:bg-[#DDD5C5]"
                        />

                        {/* 实体布面/宣纸特辑封套 */}
                        <div
                          className={cn(
                            "relative h-full w-full overflow-hidden rounded-[3px] ring-1 ring-slate-900/15 transition-shadow duration-400 dark:ring-white/15",
                            "shadow-[0_12px_24px_-10px_rgba(15,23,42,0.42)] group-hover:shadow-[0_24px_42px_-12px_rgba(15,23,42,0.58)] dark:shadow-[0_14px_28px_-8px_rgba(0,0,0,0.82)] dark:group-hover:shadow-[0_26px_46px_-10px_rgba(0,0,0,0.94)]",
                          )}
                          style={{
                            background: `linear-gradient(150deg, ${item.spineColor} 0%, ${item.folioBg} 60%, rgba(12,12,18,0.94) 160%)`,
                          }}
                        >
                          {/* 左侧精装布脊压痕与纸边高光 */}
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-2.5 opacity-85"
                            style={{ backgroundColor: item.spineColor }}
                          />
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-2.5 w-px bg-black/28"
                          />
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 w-0.5 bg-white/40"
                          />

                          {/* 细压纹内框 */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-1.5 left-3.5 rounded-[1px] border border-[#F7F2E8]/18 transition-colors duration-300 group-hover:border-[#F7F2E8]/32"
                          />

                          {/* 正面直读：竖排刻本大字 + 左下微印副题 */}
                          <div className="relative flex h-full w-full items-stretch justify-between py-2.5 pl-4.5 pr-2.5 sm:py-3 sm:pr-3">
                            <span className="self-end font-sans text-[9px] tracking-[0.22em] text-[#F6F1E7]/60 [writing-mode:vertical-rl]">
                              {item.tag}
                            </span>
                            <span className="font-calligraphy text-[18px] leading-none tracking-[0.2em] text-[#FAF5EC] [writing-mode:vertical-rl] sm:text-[19px] xl:text-[20px]">
                              {item.title}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* 窄屏专属架面承托线（宽屏改由下方贯通整宽的一根细线承托） */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-3 h-px bg-linear-to-r from-transparent via-slate-300/85 to-transparent lg:hidden dark:via-slate-700/80"
              />
            </div>
          </section>

          {/* 右栏：二十年侧插唱片架（宽屏与下方编年目录右栏严格左齐） */}
          <ColorTapestry
            songs={catalog}
            matched={matched}
            onOpenSong={onOpenSong}
            idleLabel={matched ? "命中唱片" : "二十年架上唱片"}
            bleedLeftDesktop={false}
            hideShelfLineDesktop
          />
        </div>

        {/* 宽屏：一根贯通两栏的架面承托细线 + 中缝微细竖隔，将展台与唱片排连成同一座架 */}
        <div
          aria-hidden
          className="pointer-events-none relative hidden -mt-3 lg:block"
        >
          <span className="block h-px w-full bg-linear-to-r from-transparent via-slate-300/85 to-transparent dark:via-slate-700/80" />
          <span className="absolute -top-28 left-[calc(20rem+2rem)] h-28 w-px bg-linear-to-b from-transparent via-slate-200/80 to-slate-300/75 xl:left-[calc(22rem+2rem)] dark:via-slate-800/80 dark:to-slate-700/75" />
        </div>
      </div>
    </>
  );
}

// ── 方向 B：中式书扉（复刻 SongHero 基因） ─────────────────────────────────────

/**
 * 方向 B：复刻歌曲详情页 SongHero 的书扉构图。
 * 左为眉题 + 中文书题 + 楷体引言（悬停右侧特辑时静静淡换为特辑导语）；
 * 右为无框无特效的竖排刻本错落题签；一道极细书线之下衔接唱片架。
 */
export function HeaderDemoB({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onOpenSong,
}: SharedHeaderProps) {
  const [hovered, setHovered] = useState<FeatureEntranceItem | null>(null);

  return (
    <>
      <header className="pb-9 md:pb-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          {/* 左：书扉主体 */}
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.35em] text-(--tone)">
              河图作品勘鉴 · {firstYear}—{lastYear}
            </p>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <h1 className="font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl md:text-[3.5rem]">
                二十年的颜色
              </h1>
              <SongCount
                shownCount={shownCount}
                totalCount={totalCount}
                matched={matched}
              />
            </div>

            {/* 楷体引言：常态总题记，悬停右侧题签时轻柔切为该特辑导语 */}
            <div className="mt-5 min-h-7">
              <AnimatePresence mode="wait" initial={false}>
                {hovered ? (
                  <motion.p
                    key={hovered.id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    style={accentStyle(hovered)}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  >
                    <span className="font-sans text-[11px] tracking-[0.28em] text-(--ink-accent) dark:text-(--ink-accent-dark)">
                      {hovered.tag}
                    </span>
                    <span className="font-kaiti text-[15px] text-ink-prose md:text-base">
                      {hovered.desc}
                    </span>
                  </motion.p>
                ) : (
                  <motion.p
                    key="default"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="font-kaiti text-[15px] text-ink-muted md:text-base"
                  >
                    你一定想知道，戏里讲了什么故事……
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 右（宽屏）：SongHero 同款竖排刻本题签，无框无特效，仅靠错落与墨色分主次 */}
          <nav
            aria-label="站点特辑"
            className="hidden shrink-0 flex-row-reverse items-start gap-7 pt-1 md:flex"
          >
            <span aria-hidden className="mt-1 h-16 w-px bg-(--tone)/55" />
            {CORE_FEATURES.map((item, i) => {
              const isSelf = hovered?.id === item.id;
              const isDimmed = hovered !== null && !isSelf;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    ...accentStyle(item),
                    marginTop: `${i * 0.95}rem`,
                  }}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(item)}
                  onBlur={() => setHovered(null)}
                  className={cn(
                    "group flex flex-col items-center gap-2.5 outline-none transition-opacity duration-400",
                    isDimmed ? "opacity-35" : "opacity-100",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "w-px transition-all duration-400",
                      isSelf
                        ? "h-4 bg-(--ink-accent) dark:bg-(--ink-accent-dark)"
                        : "h-2 bg-slate-300 group-hover:h-4 dark:bg-slate-700",
                    )}
                  />
                  <span
                    className={cn(
                      "font-calligraphy text-[22px] leading-none tracking-[0.32em] [writing-mode:vertical-rl] transition-colors duration-300",
                      isSelf
                        ? "text-(--ink-accent) dark:text-(--ink-accent-dark)"
                        : "text-ink-prose/90 group-hover:text-(--ink-accent) dark:group-hover:text-(--ink-accent-dark)",
                    )}
                  >
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* 窄屏：横排无框刻本题签，以间隔点分隔 */}
          <nav
            aria-label="站点特辑"
            className="flex flex-wrap items-baseline gap-y-2 border-t border-slate-200/70 pt-4 md:hidden dark:border-slate-800/80"
          >
            <span className="mr-4 text-[11px] tracking-[0.3em] text-ink-meta">
              特辑
            </span>
            {CORE_FEATURES.map((item, idx) => (
              <Fragment key={item.id}>
                {idx > 0 && (
                  <span aria-hidden className="mx-3 text-ink-faint">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  style={accentStyle(item)}
                  className="font-calligraphy text-[19px] tracking-[0.22em] text-ink-prose transition-colors hover:text-(--ink-accent) dark:hover:text-(--ink-accent-dark)"
                >
                  {item.title}
                </Link>
              </Fragment>
            ))}
          </nav>
        </div>
      </header>

      <div className="border-t border-slate-200/70 pt-6 dark:border-slate-800/80">
        <ColorTapestry
          songs={catalog}
          matched={matched}
          onOpenSong={onOpenSong}
        />
      </div>
    </>
  );
}

// ── 方向 C：唱片架顶置 · 架下铭牌 ──────────────────────────────────────────────

/**
 * 方向 C：倒置视觉秩序，顶栏下第一眼就是加大幅面的二十年唱片架；
 * 年代总题、曲数与三大特辑退居承托细线下方，化作安静克制的展柜铭牌。
 */
export function HeaderDemoC({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onOpenSong,
}: SharedHeaderProps) {
  const [hovered, setHovered] = useState<FeatureEntranceItem | null>(null);

  return (
    <>
      <ColorTapestry
        songs={catalog}
        matched={matched}
        onOpenSong={onOpenSong}
        size="large"
        idleLabel="二十年架上唱片 · 悬停抽碟"
      />

      {/* 架下展柜铭牌 */}
      <header className="mt-5 pb-2">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          {/* 左：年代与曲数铭牌 */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-serif text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-4xl">
              {lastYear}
              <span className="mx-[0.2em] font-light text-ink-faint">—</span>
              {firstYear}
            </h1>
            <SongCount
              shownCount={shownCount}
              totalCount={totalCount}
              matched={matched}
            />
          </div>

          {/* 右：纯文字特辑索引 + 底部轻柔楷体耳语 */}
          <div className="flex flex-col gap-1.5 md:items-end">
            <nav
              aria-label="站点特辑"
              className="flex flex-wrap items-center gap-y-1.5"
            >
              <span className="text-[11px] tracking-[0.35em] text-ink-meta">
                特辑
              </span>
              <span
                aria-hidden
                className="mx-3.5 h-3 w-px bg-slate-200 dark:bg-slate-800"
              />
              {CORE_FEATURES.map((item, idx) => (
                <Fragment key={item.id}>
                  {idx > 0 && (
                    <span aria-hidden className="mx-3 text-ink-faint">
                      ·
                    </span>
                  )}
                  <Link
                    href={item.href}
                    style={accentStyle(item)}
                    onMouseEnter={() => setHovered(item)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(item)}
                    onBlur={() => setHovered(null)}
                    className="font-serif text-[15px] tracking-[0.16em] text-ink-body transition-colors hover:text-(--ink-accent) dark:hover:text-(--ink-accent-dark)"
                  >
                    {item.title}
                  </Link>
                </Fragment>
              ))}
            </nav>

            <p className="hidden min-h-4.5 font-kaiti text-xs text-ink-muted md:block">
              {hovered
                ? `${hovered.tag} · ${hovered.desc}`
                : "三处别径，自另一重维度观二十年"}
            </p>
          </div>
        </div>
      </header>
    </>
  );
}

// ── 方向 D：特辑升格进 TopBar，卷首彻底做减法 ──────────────────────────────────

/** 方向 D 的宽屏顶栏一级导航（放进 TopBar 的 nav 插槽） */
export function DemoTopBarNavD({ onReset }: { onReset: () => void }) {
  return (
    <div className="hidden items-center md:inline-flex">
      <span
        aria-hidden
        className="mx-4 h-3.5 w-px bg-slate-200 dark:bg-slate-800"
      />
      <div className="flex items-center text-[13px] font-serif tracking-[0.2em]">
        <button
          type="button"
          onClick={onReset}
          aria-current="page"
          className="text-(--tone) transition-opacity hover:opacity-80"
        >
          编年
        </button>
        {CORE_FEATURES.map((item) => (
          <Fragment key={item.id}>
            <span aria-hidden className="mx-3 font-sans text-ink-faint">
              ·
            </span>
            <Link
              href={item.href}
              className="text-ink-muted transition-colors hover:text-ink"
            >
              {item.title}
            </Link>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** 方向 D 的窄屏顶栏下沿细导航条（放进 TopBar 的 children 插槽） */
export function DemoTopBarMobileStripD({ onReset }: { onReset: () => void }) {
  return (
    <div className="border-t border-slate-200/50 md:hidden dark:border-slate-800/50">
      <div className="no-scrollbar mx-auto flex max-w-7xl items-center overflow-x-auto px-4 py-2 font-serif text-xs tracking-[0.22em] sm:px-6">
        <button
          type="button"
          onClick={onReset}
          aria-current="page"
          className="shrink-0 text-(--tone)"
        >
          编年
        </button>
        {CORE_FEATURES.map((item) => (
          <Fragment key={item.id}>
            <span
              aria-hidden
              className="mx-3 shrink-0 font-sans text-ink-faint"
            >
              ·
            </span>
            <Link
              href={item.href}
              className="shrink-0 text-ink-muted transition-colors hover:text-ink"
            >
              {item.title}
            </Link>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * 方向 D：特辑升格为全站顶栏一级导航后，首页卷首彻底做减法，
 * 只留最安静克制的年代总题、曲数与二十年唱片架。
 */
export function HeaderDemoD({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onOpenSong,
}: SharedHeaderProps) {
  return (
    <>
      <header className="pb-7 md:pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <h1 className="font-serif text-4xl font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-5xl md:text-6xl">
              {lastYear}
              <span className="mx-[0.22em] font-light text-ink-faint">—</span>
              {firstYear}
            </h1>
            <SongCount
              shownCount={shownCount}
              totalCount={totalCount}
              matched={matched}
            />
          </div>

          <p className="font-kaiti text-sm text-ink-muted">
            二十年声色，自近及远
          </p>
        </div>
      </header>

      <ColorTapestry
        songs={catalog}
        matched={matched}
        onOpenSong={onOpenSong}
      />
    </>
  );
}

// ── 方向 E：二十扇屏（特辑同 D 进顶栏） ──────────────────────────────────────

export function HeaderDemoE({
  firstYear,
  lastYear,
  shownCount,
  totalCount,
  matched,
  catalog,
  onJumpYear,
}: SharedHeaderProps) {
  return (
    <ScreenHeader
      firstYear={firstYear}
      lastYear={lastYear}
      catalog={catalog}
      matched={matched}
      onJumpYear={onJumpYear}
      countSlot={
        <SongCount
          shownCount={shownCount}
          totalCount={totalCount}
          matched={matched}
        />
      }
    />
  );
}

// ── 原型切换浮条（左下角极简胶囊，不侵入任何一套头部版式） ──────────────────────

export function HeaderDemoSwitcher({
  value,
  onChange,
}: {
  value: HeaderVariant;
  onChange: (next: HeaderVariant) => void;
}) {
  // 支持键盘 1-4 快速切方案（输入框聚焦时不拦截）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const map: Record<string, HeaderVariant> = {
        "1": "a",
        "2": "b",
        "3": "c",
        "4": "d",
        "5": "e",
      };
      const next = map[e.key];
      if (next) onChange(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChange]);

  const current = HEADER_VARIANTS.find((v) => v.id === value);

  return (
    <div
      role="region"
      aria-label="头部原型切换"
      className="fixed bottom-5 left-4 z-50 flex flex-col items-start gap-1.5 sm:left-6"
    >
      {current && (
        <p className="hidden rounded-full border border-slate-200/75 bg-[#FAFAFA]/95 px-3 py-1 font-kaiti text-xs text-ink-muted shadow-sm sm:block dark:border-slate-800 dark:bg-[#0B0F19]/95">
          方案 {current.code}：{current.note}
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
                <span className="font-mono text-[11px]">{v.code}</span>
                <span className="ml-1 hidden sm:inline">{v.label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
