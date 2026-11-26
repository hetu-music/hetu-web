"use client";

import { Link } from "@/i18n/navigation";
import { GRAY_PALETTE, PALETTE_FULL } from "@/lib/imagery/palette";
import type { QuizQuestionView } from "@/lib/quiz/views";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { creditSummary, pickChapterFocal, stripeColor } from "./timeline";

export type HeaderVariant = "masthead" | "frontispiece";

export const HEADER_VARIANTS: readonly {
  id: HeaderVariant;
  code: string;
  label: string;
  note: string;
}[] = [
  {
    id: "masthead",
    code: "一",
    label: "题眉通屏",
    note: "卷首题眉一左一右呼应，二十一扇通栏铺展，检目线承接屏底落款",
  },
  {
    id: "frontispiece",
    code: "二",
    label: "素绢引首",
    note: "左栏 22rem 素绢引首与正文书脊同轴，特展原地显影不借时间扇",
  },
];

/** 特展入口各取自己内容的一小片 */
export interface FeatureData {
  motifs: { id: number; name: string; palette: number; songCount: number }[];
  motifCount: number;
  question: QuizQuestionView | null;
  questionCount: number;
}

/** 屏风上的一扇：一年一扇，最后可能还有一扇「未详」 */
export interface ScreenPanel {
  /** 与正文章节的 data-year-key 一致："2026" … "unknown" */
  key: string;
  year: number | null;
  ids: ReadonlySet<number>;
  /** 这一扇挂出来的一首；这一年一首歌都没有时为 null */
  song: Song | null;
  /** 有没有自己的封面。没有就是素屏，只竖题歌名 */
  art: boolean;
}

/**
 * 每年挑一幅挂上屏。不用下方章节的焦点作品（pickChapterFocal），
 * 否则 2026 这一扇和紧接着的 2026 章大画幅是同一张，一屏之内重复。
 * 只挑有自己封面的：共用的占位图挂二十扇里会一再出现。
 * 同一张专辑的歌往往共用一张封面（如 2008、2009 的《唱给你的歌》），
 * 别的年份挂过的专辑不再挂，免得相邻两扇一模一样。
 */
function pickPanel(
  songs: Song[],
  usedAlbums: Set<string>,
): Pick<ScreenPanel, "song" | "art"> {
  const withCover = songs.filter((s) => s.hascover === true);
  if (withCover.length === 0) {
    return { song: pickChapterFocal(songs), art: false };
  }
  const focal = pickChapterFocal(songs);
  const fresh = withCover.filter((s) => !s.album || !usedAlbums.has(s.album));
  const pool = fresh.length > 0 ? fresh : withCover;
  const rest = pool.filter((s) => s.id !== focal?.id);
  const song = pickChapterFocal(rest.length > 0 ? rest : pool);
  if (song?.album) usedAlbums.add(song.album);
  return { song, art: true };
}

/** 展开的屏与合起的细带用同一份挑选，合起来时每一道切片仍是上面那一扇的画面 */
export function buildPanels(
  catalog: Song[],
  firstYear: number,
  lastYear: number,
): ScreenPanel[] {
  const byYear = new Map<number | null, Song[]>();
  for (const s of catalog) {
    const y = s.year ?? null;
    const list = byYear.get(y);
    if (list) list.push(s);
    else byYear.set(y, [s]);
  }
  const years: (number | null)[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);
  if (byYear.has(null)) years.push(null);

  const usedAlbums = new Set<string>();
  return years.map((year) => {
    const songs = byYear.get(year) ?? [];
    return {
      key: String(year ?? "unknown"),
      year,
      ids: new Set(songs.map((s) => s.id)),
      // 未详这一扇不挂画：它不是一个年份，只是一个去处
      ...(year === null
        ? { song: null, art: false }
        : pickPanel(songs, usedAlbums)),
    };
  });
}

export function panelLit(
  panel: ScreenPanel,
  matched: ReadonlySet<number> | null,
): boolean {
  if (matched === null) return true;
  for (const id of panel.ids) if (matched.has(id)) return true;
  return false;
}

const HANZI_DIGITS = "零一二三四五六七八九";
const HANZI_UNITS = ["千", "百", "十", ""];

/** 一万以内的数写成汉字：361 → 三百六十一，12 → 十二，305 → 三百零五 */
export function hanzi(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n >= 10000) return String(n);
  const s = String(n).padStart(4, "0");
  let out = "";
  let zero = false;
  for (let i = 0; i < 4; i++) {
    const k = Number(s[i]);
    if (k === 0) {
      if (out) zero = true;
      continue;
    }
    if (zero) {
      out += "零";
      zero = false;
    }
    out += HANZI_DIGITS[k] + HANZI_UNITS[i];
  }
  return n >= 10 && n < 20 ? out.slice(1) : out;
}

/** 曲数动态跳变：筛选时数字换成命中数 */
export function SongCount({
  shownCount,
  totalCount,
  matched,
}: {
  shownCount: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
}) {
  return (
    <span className="font-serif text-xs tracking-[0.2em] text-ink-meta">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={shownCount}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
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

/** 展开一扇屏的停留时间：鼠标扫过整排时不让屏一扇扇跟着翻 */
export const HOVER_INTENT_MS = 90;

const EASE = [0.23, 1, 0.32, 1] as const;

const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

type FeatureKey = "qjtx" | "imagery" | "quiz";

const ENTRANCE_DEFS: readonly {
  key: FeatureKey;
  href: string;
  name: string;
}[] = [
  { key: "qjtx", href: "/story/qjtx", name: "倾尽天下" },
  { key: "imagery", href: "/imagery", name: "意象" },
  { key: "quiz", href: "/quiz", name: "寻曲" },
];

function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

/**
 * 决定时间弦上哪些刻度标出年份文字：
 * 只标首、尾、逢五之年及当前展开扇，避免二十个四位数在窄扇下挤成条形码；
 * 若某刻度恰好紧贴在展开扇左侧一格，则让位给展开扇，防止窄扇上的四位数顶撞展开扇字头。
 */
function shouldShowTickLabel(
  panels: ScreenPanel[],
  idx: number,
  openIdx: number,
): boolean {
  if (idx === openIdx) return true;
  if (idx === openIdx - 1) return false;
  if (idx === 0 || idx === panels.length - 1) return true;
  const y = panels[idx]?.year;
  if (typeof y === "number" && y % 5 === 0) {
    return idx >= 2 && idx <= panels.length - 3;
  }
  return false;
}

/** 菱形小印入口：纯墨色，悬停或聚焦时菱印旋开着实并转为强调色 */
function SealEntrance({
  href,
  name,
  active,
  onEnter,
  onLeave,
  className,
}: {
  href: string;
  name: string;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") onEnter();
      }}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cn(
        "group inline-flex items-center gap-2 outline-none transition-colors duration-300",
        active
          ? "text-(--tone)"
          : "text-ink-prose hover:text-(--tone) focus-visible:text-(--tone)",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 border border-current transition-all duration-500 ease-page",
          active
            ? "rotate-135 bg-current"
            : "rotate-45 bg-transparent group-hover:rotate-135 group-hover:bg-current group-focus-visible:rotate-135 group-focus-visible:bg-current",
        )}
      />
      <span className="font-calligraphy leading-none tracking-[0.2em]">
        {name}
      </span>
    </Link>
  );
}

/**
 * 共享的二十一扇经折装屏风 + 屏底古琴徽位时间弦。
 * 两种头部方案共用同一套折屏结构与交互，只在外围骨架与屏高/宽比例上区分。
 */
function FoldingPanels({
  panels,
  openKey,
  matched,
  isTouch,
  compactGaps,
  onHoverOpen,
  onImmediateOpen,
  onCancelIntent,
  onJump,
  className,
}: {
  panels: ScreenPanel[];
  openKey: string;
  matched: ReadonlySet<number> | null;
  isTouch: boolean;
  /** 方案二右栏在 lg 屏宽度较紧，用更细的折缝让二十扇如密骨折扇般清朗 */
  compactGaps?: boolean;
  onHoverOpen: (key: string) => void;
  onImmediateOpen: (key: string) => void;
  onCancelIntent: () => void;
  onJump: (year: number | null) => void;
  className?: string;
}) {
  const openIdx = Math.max(
    0,
    panels.findIndex((p) => p.key === openKey),
  );
  const openPanel = panels[openIdx] ?? panels[0];

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="list"
        aria-label="二十年，一年一扇"
        className={cn(
          "no-scrollbar -mx-6 flex overflow-x-auto px-6 lg:mx-0 lg:overflow-visible lg:px-0",
          compactGaps ? "gap-0.5 xl:gap-0.75" : "gap-0.75",
        )}
        onPointerLeave={onCancelIntent}
      >
        {panels.map((p, idx) => {
          const isOpen = p.key === openKey;
          const lit = panelLit(p, matched);
          const showTick = shouldShowTickLabel(panels, idx, openIdx);
          const isLast = idx === panels.length - 1;
          const accentColor = p.song ? stripeColor(p.song) : null;

          return (
            <div
              key={p.key}
              role="listitem"
              className={cn(
                "transition-[flex-grow,flex-basis,opacity] duration-700 ease-page",
                compactGaps ? "min-w-7 lg:min-w-0" : "min-w-7.5 lg:min-w-0",
              )}
              style={{
                flex: isOpen ? "0 0 var(--open-w, var(--h))" : "1 1 0%",
                opacity: lit ? 1 : 0.2,
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
                  if (e.pointerType === "mouse") onHoverOpen(p.key);
                }}
                onFocus={() => onImmediateOpen(p.key)}
                onClick={() => {
                  // 触屏先展开，再点才翻过去；鼠标指向时已经展开了
                  if (isTouch && !isOpen) onImmediateOpen(p.key);
                  else onJump(p.year);
                }}
                className="group relative block h-(--h) w-full overflow-hidden rounded-[2px] bg-slate-200/85 ring-1 ring-inset ring-slate-900/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-(--tone) dark:bg-slate-800/90 dark:ring-white/[0.08]"
              >
                {p.year === null && (
                  <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-sm tracking-[0.4em] text-ink-meta [writing-mode:vertical-rl]">
                    未详
                  </span>
                )}
                {p.song && !p.art && (
                  <>
                    {accentColor && (
                      <span
                        aria-hidden
                        className="absolute top-3 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full opacity-70"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <span className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-sm tracking-[0.35em] text-ink-prose/80 [writing-mode:vertical-rl]">
                      {p.song.title}
                    </span>
                  </>
                )}
                {p.song && p.art && (
                  <Image
                    src={getCoverUrl(p.song)}
                    alt=""
                    width={400}
                    height={400}
                    sizes="400px"
                    draggable={false}
                    // 封面固定为整幅大小、居中裁出：展开只是把窗拉宽，画面本身不缩放
                    className={cn(
                      "absolute top-0 left-1/2 h-(--h) w-(--h) max-w-none -translate-x-1/2 object-cover transition-[filter] duration-700",
                      isOpen
                        ? "grayscale-0"
                        : "brightness-[0.92] grayscale-[35%] group-hover:grayscale-0",
                    )}
                  />
                )}
                {/* 奇偶闭合扇叠一层极淡墨翳，做出经折装折页的明暗韵律而不借浮夸 3D */}
                {!isOpen && idx % 2 === 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-slate-950/[0.05] transition-opacity duration-500 group-hover:opacity-0 dark:bg-black/25"
                  />
                )}
              </button>

              {/* 屏脚古琴徽位时间弦：细弦紧贴屏底，只疏标首尾、逢五与当前展开年 */}
              <div className="relative mt-2 border-t border-slate-200/80 pt-1.5 pb-1 dark:border-slate-800/80">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 block transition-all duration-500 ease-page",
                    isOpen
                      ? "inset-x-0 h-[1.5px] bg-(--tone)"
                      : "left-1/2 h-1 w-px -translate-x-1/2 bg-slate-300/90 dark:bg-slate-700",
                  )}
                />
                <div className="h-4 overflow-visible">
                  {showTick && (
                    <span
                      className={cn(
                        "block whitespace-nowrap font-mono text-[10px] leading-4 tabular-nums tracking-wider transition-colors duration-500",
                        isOpen
                          ? "font-medium text-(--tone)"
                          : "text-ink-meta/85",
                        isLast && !isOpen && "text-right",
                      )}
                    >
                      {p.year ?? "未详"}
                      {isOpen && p.ids.size > 0 && (
                        <span className="ml-1.5 font-normal text-ink-meta">
                          · {p.ids.size} 曲
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 窄屏无右栏书眉槽位，在此轻附一行展开扇题跋；宽屏题跋收进下方检目线右栏 */}
      {openPanel && (
        <div className="mt-1.5 flex min-h-5 items-baseline justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => onJump(openPanel.year)}
            className="flex min-w-0 items-baseline gap-2 text-left"
          >
            <span className="truncate font-serif text-sm text-ink">
              {openPanel.song ? `《${openPanel.song.title}》` : "年份未详"}
            </span>
            {openPanel.song && (
              <span className="truncate font-kaiti text-xs text-ink-muted">
                {creditSummary(openPanel.song)}
              </span>
            )}
          </button>
          <span className="shrink-0 font-kaiti text-[11px] text-ink-meta">
            再点入章
          </span>
        </div>
      )}
    </div>
  );
}

interface TimeScreenProps {
  variant: HeaderVariant;
  panels: ScreenPanel[];
  openKey: string;
  firstYear: number;
  lastYear: number;
  matched: ReadonlySet<number> | null;
  features: FeatureData;
  onOpenChange: (key: string) => void;
  onJump: (year: number | null) => void;
}

/**
 * 卷首「屏风」双方案：
 * - masthead（题眉通屏）：上方一左一右放题字与三枚刻本入口，悬停入口原地化开活题字；下方二十一扇通栏铺满。
 * - frontispiece（素绢引首）：严格沿用下方 20/22rem | 1fr 书脊，左上素绢引首承题字与三径并原地显影，右侧展开二十一扇。
 */
export function TimeScreen({
  variant,
  panels,
  openKey,
  firstYear,
  lastYear,
  matched,
  features,
  onOpenChange,
  onJump,
}: TimeScreenProps) {
  const isTouch = useSyncExternalStore(
    subscribeHoverNone,
    getHoverNone,
    getHoverNoneServer,
  );
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const hoverOpen = (key: string) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(
      () => onOpenChange(key),
      HOVER_INTENT_MS,
    );
  };

  const cancelIntent = () => window.clearTimeout(intent.current);

  const topMotifs = useMemo(() => features.motifs.slice(0, 5), [features]);

  if (variant === "frontispiece") {
    return (
      <header className="pb-2">
        <div className="grid items-stretch gap-y-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ── 左栏（20/22rem，与下方搜索栏与大画幅严格同轴）：素绢引首 ── */}
          <div className="flex flex-col">
            <div className="flex flex-col overflow-hidden rounded-[2px] bg-slate-100/65 ring-1 ring-slate-900/[0.06] lg:h-[18.5rem] xl:h-[21.5rem] dark:bg-slate-900/50 dark:ring-white/[0.08]">
              {/* 上画窗：常态为竖排「二十年」+ 细线 + 楷体题字；悬停下方入口时原地显影特展 */}
              <div className="relative min-h-44 flex-1 overflow-hidden px-6 py-5 lg:min-h-0 xl:px-7 xl:py-6">
                <AnimatePresence mode="wait" initial={false}>
                  {feature === null ? (
                    <motion.div
                      key="default"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="flex h-full flex-row-reverse items-start justify-between gap-4"
                    >
                      <div className="flex flex-row-reverse items-start gap-4 xl:gap-5">
                        <h1 className="font-serif text-4xl font-semibold leading-none tracking-[0.28em] text-ink [writing-mode:vertical-rl] xl:text-[2.75rem]">
                          二十年
                        </h1>
                        <span
                          aria-hidden
                          className="mt-1 h-14 w-px shrink-0 bg-(--tone)/45 xl:h-16"
                        />
                        <div className="flex flex-row-reverse items-start gap-2.5 pt-1 font-kaiti text-[14px] leading-none tracking-[0.24em] text-ink-prose/90 xl:gap-3 xl:text-[15px]">
                          <span className="[writing-mode:vertical-rl]">
                            你一定想知道
                          </span>
                          <span className="mt-5 [writing-mode:vertical-rl] text-ink-muted xl:mt-6">
                            戏里讲了什么故事
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 self-end pb-0.5">
                        <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-ink-meta">
                          {lastYear}—{firstYear}
                        </span>
                        <span className="font-kaiti text-[11px] tracking-[0.18em] text-ink-meta/85">
                          河图 · 编年
                        </span>
                      </div>
                    </motion.div>
                  ) : feature === "qjtx" ? (
                    <motion.div
                      key="qjtx"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="absolute inset-0"
                    >
                      <Image
                        src="/story/qjtx/31.avif"
                        alt=""
                        fill
                        sizes="360px"
                        className="object-cover"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"
                      />
                      <div className="absolute inset-x-5 bottom-4 text-white">
                        <p className="text-[10px] tracking-[0.35em] text-white/75">
                          特展 · 互动长卷
                        </p>
                        <p className="mt-1 font-serif text-lg tracking-wider">
                          《倾尽天下》
                        </p>
                        <p className="mt-0.5 font-kaiti text-xs text-white/80">
                          一曲长歌，随乐声缓步展开
                        </p>
                      </div>
                    </motion.div>
                  ) : feature === "imagery" ? (
                    <motion.div
                      key="imagery"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex h-full flex-col justify-between"
                    >
                      <div className="flex flex-1 flex-row-reverse items-center justify-center gap-4">
                        {topMotifs.map((m, i) => (
                          <span
                            key={m.id}
                            className={cn(
                              "font-calligraphy leading-none [writing-mode:vertical-rl]",
                              paletteText(m.palette),
                              i === 0
                                ? "text-5xl xl:text-6xl"
                                : "text-xl xl:text-2xl",
                            )}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                      <p className="font-kaiti text-xs text-ink-muted">
                        {features.motifCount > 0
                          ? `词中万象 · ${features.motifCount} 个母题，从词里一个个读出来`
                          : "词中万象 · 从词里一个个读出来"}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="quiz"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex h-full flex-col justify-between"
                    >
                      <div className="flex flex-1 items-center justify-center py-1">
                        <p className="max-h-full overflow-hidden font-serif text-base leading-loose tracking-[0.2em] text-ink [writing-mode:vertical-rl] xl:text-lg">
                          {features.question?.stem ??
                            "十二个问题，寻一首懂你的歌"}
                        </p>
                      </div>
                      <p className="font-kaiti text-xs text-ink-muted">
                        {features.questionCount > 0
                          ? `寻曲 · 第一问（共${hanzi(features.questionCount)}问，答完得一首歌）`
                          : "寻曲 · 答完得一首歌"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 引首下座：三枚刻本入口常驻于此，悬停即照亮上方画窗，绝不抖动也不抢占时间扇 */}
              <nav
                aria-label="特展"
                className="flex items-center justify-between gap-3 border-t border-slate-200/75 bg-[#FAFAFA]/65 px-5 py-3 dark:border-slate-800/80 dark:bg-[#0B0F19]/45"
              >
                {ENTRANCE_DEFS.map((item) => (
                  <SealEntrance
                    key={item.key}
                    href={item.href}
                    name={item.name}
                    active={feature === item.key}
                    onEnter={() => setFeature(item.key)}
                    onLeave={() => setFeature(null)}
                    className="text-[17px] xl:text-[18px]"
                  />
                ))}
              </nav>
            </div>

            {/* 与右侧时间弦完全齐平的左栏细弦底线 */}
            <div className="mt-2 hidden items-baseline justify-between border-t border-slate-200/80 pt-1.5 pb-1 lg:flex dark:border-slate-800/80">
              <span className="font-mono text-[10px] leading-4 tracking-[0.22em] text-ink-meta">
                引首 · 特展
              </span>
              <span className="font-kaiti text-[11px] leading-4 text-ink-meta">
                一年一扇，点扇入章
              </span>
            </div>
          </div>

          {/* ── 右栏（1fr）：二十一扇折屏 + 古琴徽位时间弦 ── */}
          <FoldingPanels
            panels={panels}
            openKey={openKey}
            matched={matched}
            isTouch={isTouch}
            compactGaps
            onHoverOpen={hoverOpen}
            onImmediateOpen={onOpenChange}
            onCancelIntent={cancelIntent}
            onJump={onJump}
            className="[--h:15.5rem] md:[--h:19rem] lg:[--h:18.5rem] lg:[--open-w:16.5rem] xl:[--h:21.5rem] xl:[--open-w:21.5rem]"
          />
        </div>
      </header>
    );
  }

  // ── 方案一：题眉通屏 ──────────────────────────────────────────────────────────
  return (
    <header className="pb-2">
      {/* 1. 卷首题眉：左置题名与活题字，右置三枚刻本入口 */}
      <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3.5">
            <h1 className="font-serif text-4xl font-semibold leading-none tracking-[0.06em] text-ink md:text-[2.75rem]">
              二十年
            </h1>
            <span
              aria-hidden
              className="h-3.5 w-px self-center bg-slate-300/90 dark:bg-slate-700"
            />
            <span className="font-mono text-[11px] tabular-nums tracking-[0.24em] text-ink-meta">
              {lastYear}—{firstYear}
            </span>
          </div>

          {/* 活题字：常态为卷首题记，悬停右侧入口时原地化作该特展的一句引语 */}
          <div className="mt-2.5 flex min-h-6 items-baseline gap-2.5">
            <span
              aria-hidden
              className={cn(
                "shrink-0 font-mono text-xs transition-colors duration-300",
                feature ? "text-(--tone)" : "text-(--tone)/70",
              )}
            >
              —
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={feature ?? "default"}
                initial={{ opacity: 0, y: 3, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -3, filter: "blur(4px)" }}
                transition={{ duration: 0.32, ease: EASE }}
                className="min-w-0 truncate font-kaiti text-[15px] text-ink-muted md:text-base"
              >
                {feature === null ? (
                  "你一定想知道，戏里讲了什么故事……"
                ) : feature === "qjtx" ? (
                  <>
                    <span className="text-(--tone)">互动长卷</span>
                    <span aria-hidden className="mx-2 text-ink-faint">
                      ·
                    </span>
                    一曲长歌，随乐声缓步展开江山旧梦
                  </>
                ) : feature === "imagery" ? (
                  <>
                    <span className="text-(--tone)">
                      {features.motifCount > 0
                        ? `${features.motifCount} 个词中母题`
                        : "词中万象"}
                    </span>
                    {topMotifs.length > 0 && (
                      <>
                        <span aria-hidden className="mx-2 text-ink-faint">
                          ·
                        </span>
                        {topMotifs.slice(0, 4).map((m, idx) => (
                          <Fragment key={m.id}>
                            {idx > 0 && (
                              <span className="text-ink-faint">、</span>
                            )}
                            <span
                              className={cn(
                                "font-calligraphy text-[17px]",
                                paletteText(m.palette),
                              )}
                            >
                              {m.name}
                            </span>
                          </Fragment>
                        ))}
                        <span className="text-ink-meta">……</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-(--tone)">
                      {features.questionCount > 0
                        ? `${hanzi(features.questionCount)}问寻歌`
                        : "问答寻歌"}
                    </span>
                    <span aria-hidden className="mx-2 text-ink-faint">
                      ·
                    </span>
                    {features.question?.stem
                      ? `「${features.question.stem}」`
                      : "十二个问题，寻一首懂你的歌"}
                  </>
                )}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* 右侧三处特辑入口：刻本小印，不抢屏风主角 */}
        <nav
          aria-label="特展"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 md:shrink-0 md:gap-x-7 md:pb-0.5"
        >
          {ENTRANCE_DEFS.map((item, idx) => (
            <Fragment key={item.key}>
              {idx > 0 && (
                <span
                  aria-hidden
                  className="hidden h-3 w-px bg-slate-200/90 md:inline-block dark:bg-slate-800"
                />
              )}
              <SealEntrance
                href={item.href}
                name={item.name}
                active={feature === item.key}
                onEnter={() => setFeature(item.key)}
                onLeave={() => setFeature(null)}
                className="text-[18px] md:text-[20px]"
              />
            </Fragment>
          ))}
        </nav>
      </div>

      {/* 2. 二十一扇通栏折屏 + 古琴徽位时间弦 */}
      <FoldingPanels
        panels={panels}
        openKey={openKey}
        matched={matched}
        isTouch={isTouch}
        onHoverOpen={hoverOpen}
        onImmediateOpen={onOpenChange}
        onCancelIntent={cancelIntent}
        onJump={onJump}
        className="[--h:15.5rem] md:[--h:20.5rem] xl:[--h:22.5rem]"
      />
    </header>
  );
}
