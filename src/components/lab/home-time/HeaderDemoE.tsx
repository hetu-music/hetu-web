"use client";

import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { Link } from "@/i18n/navigation";
import { GRAY_PALETTE, PALETTE_FULL } from "@/lib/imagery/palette";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import Image from "next/image";
import React, {
    Fragment,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
  } from "react";
import type { FeatureData } from "./FeatureBand";
import { CORE_FEATURES, type FeatureEntranceItem } from "./FeatureEntrances";
import { creditSummary, pickChapterFocal } from "./timeline";

/** 展开一扇屏的停留时间：鼠标扫过整排时不让屏一扇扇跟着翻 */
const HOVER_INTENT_MS = 90;
/** 从卷首题签移向下方「借屏显影」画幅时的宽限时间，让用户能顺畅点进词云或选项 */
const STAGE_LEAVE_MS = 220;
const EASE = [0.23, 1, 0.32, 1] as const;
const OPTION_MARKS = ["甲", "乙", "丙", "丁"];

const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

function stageMotifSize(count: number, max: number): string {
  const r = count / max;
  if (r > 0.66) return "text-[2.25rem] xl:text-[2.75rem]";
  if (r > 0.4) return "text-[1.75rem] xl:text-[2.1rem]";
  return "text-[1.35rem] xl:text-[1.55rem]";
}

function accentStyle(item: FeatureEntranceItem): React.CSSProperties {
  return {
    "--ink-accent": item.accentLight,
    "--ink-accent-dark": item.accentDark,
  } as React.CSSProperties;
}

interface Panel {
  year: number;
  count: number;
  /** 这一年挂出来的一首；这一年一首歌都没有时为 null */
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
): Pick<Panel, "song" | "art"> {
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

interface HeaderDemoEProps {
  firstYear: number;
  lastYear: number;
  catalog: Song[];
  matched: ReadonlySet<number> | null;
  countSlot: ReactNode;
  features: FeatureData;
  onJumpYear: (year: number) => void;
}

/**
 * 方向 E（定稿整合：纯二十扇屏 + 卷首题签「借屏显影」+ 检目收进顶栏）：
 * - 屏风严格保持纯 20 扇，一年一幅，比例丝毫不受挤压；
 * - 三大特辑以无框竖排刻本题签落在卷首右上角（复刻 SongHero 基因），不另辟独立区块；
 * - 宽屏悬停右上角任一特辑时，左侧楷体淡换为导语，下方二十扇屏化作临时展窗
 *   （借屏显影：雪中长卷帧 / 真实可点母题词云 / 寻曲第一问直答），指针移下可直接交互，移开静静退回二十年；
 * - 屏风之下不再有独立特展块或横贯工具栏，直接进入 2026 编年正文。
 */
export function HeaderDemoE({
  firstYear,
  lastYear,
  catalog,
  matched,
  countSlot,
  features,
  onJumpYear,
}: HeaderDemoEProps) {
  const isTouch = useSyncExternalStore(
    subscribeHoverNone,
    getHoverNone,
    getHoverNoneServer,
  );

  const panels = useMemo<Panel[]>(() => {
    const byYear = new Map<number, Song[]>();
    for (const s of catalog) {
      if (!s.year) continue;
      const list = byYear.get(s.year);
      if (list) list.push(s);
      else byYear.set(s.year, [s]);
    }
    const out: Panel[] = [];
    const usedAlbums = new Set<string>();
    for (let y = lastYear; y >= firstYear; y--) {
      const songs = byYear.get(y) ?? [];
      out.push({
        year: y,
        count: songs.length,
        ...pickPanel(songs, usedAlbums),
      });
    }
    return out;
  }, [catalog, firstYear, lastYear]);

  const [open, setOpen] = useState(lastYear);
  const [stageFeature, setStageFeature] = useState<FeatureEntranceItem | null>(
    null,
  );

  const intent = useRef(0);
  const leaveTimer = useRef(0);

    useEffect(() => {
      return () => {
        window.clearTimeout(intent.current);
        window.clearTimeout(leaveTimer.current);
      };
    }, []);

    // 按 Esc 立即退回二十年扇面
    useEffect(() => {
      if (!stageFeature) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setStageFeature(null);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [stageFeature]);

    const hoverOpenYear = (year: number) => {
      window.clearTimeout(intent.current);
      intent.current = window.setTimeout(() => setOpen(year), HOVER_INTENT_MS);
    };

    const enterFeature = useCallback((item: FeatureEntranceItem) => {
      window.clearTimeout(leaveTimer.current);
      setStageFeature(item);
    }, []);

    const scheduleLeaveFeature = useCallback(() => {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(
        () => setStageFeature(null),
        STAGE_LEAVE_MS,
      );
    }, []);

    const keepStageOpen = useCallback(() => {
      window.clearTimeout(leaveTimer.current);
    }, []);

    const maxMotifCount = features.motifs[0]?.songCount ?? 1;

    return (
            <header className="pb-4 md:pb-6">
              {/* ── 卷首上眉：左题记 + 右竖排刻本题签（零卡片、零额外区块） ── */}
              <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-[0.35em] text-(--tone)">
                    河图作品勘鉴 · {firstYear}—{lastYear}
                  </p>
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                      <h1 className="font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-ink md:text-6xl xl:text-7xl">
                        二十年
                      </h1>
                      {countSlot}
                  </div>

                  {/* 楷体引言：悬停右侧题签时轻柔切为该特辑导语 */}
                  <div className="mt-4 min-h-6">
                    <AnimatePresence mode="wait" initial={false}>
                      {stageFeature ? (
                        <motion.p
                          key={stageFeature.id}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.24, ease: EASE }}
                          style={accentStyle(stageFeature)}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                        >
                          <span className="font-sans text-[11px] tracking-[0.28em] text-(--ink-accent) dark:text-(--ink-accent-dark)">
                            {stageFeature.tag}
                          </span>
                          <span className="font-kaiti text-[15px] text-ink-prose">
                            {stageFeature.desc}
                          </span>
                        </motion.p>
                      ) : (
                        <motion.p
                          key="default"
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.24, ease: EASE }}
                          className="font-kaiti text-[15px] text-ink-muted"
                        >
                          你一定想知道，戏里讲了什么故事……
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                        {/* 宽屏右侧：无框竖排刻本题签（悬停触发下方「借屏显影」，点击直达对应页面） */}
        <nav
                        aria-label="站点特辑"
                        onPointerLeave={scheduleLeaveFeature}
                        className="hidden shrink-0 flex-row-reverse items-start gap-7 pt-1 md:flex"
                      >
                        <span aria-hidden className="mt-1 h-15 w-px bg-(--tone)/50" />
                        {CORE_FEATURES.map((item, i) => {
                          const isSelf = stageFeature?.id === item.id;
                          const isDimmed = stageFeature !== null && !isSelf;
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              style={{
                                ...accentStyle(item),
                                marginTop: `${i * 0.7}rem`,
                              }}
                              onPointerEnter={(e) => {
                                if (e.pointerType === "mouse") enterFeature(item);
                              }}
                                onFocus = {() => enterFeature(item)}
                        onBlur={scheduleLeaveFeature}
                        className={cn(
                          "group flex flex-col items-center gap-2 outline-none transition-opacity duration-400",
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
                            "font-calligraphy text-[21px] leading-none tracking-[0.3em] [writing-mode:vertical-rl] transition-colors duration-300",
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

        {/* 窄屏：横排无框刻本题签，紧贴卷首下方 */ }
                  <nav
                    aria-label="站点特辑"
                    className="flex flex-wrap items-baseline gap-y-2 border-t border-slate-200/70 pt-3.5 md:hidden dark:border-slate-800/80"
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
                          className="font-calligraphy text-[19px] tracking-[0.2em] text-ink-prose transition-colors hover:text-(--ink-accent) dark:hover:text-(--ink-accent-dark)"
                        >
                          {item.title}
                        </Link>
                      </Fragment>
                    ))}
                  </nav>
      </div>

              {/* ── 中幅：纯二十扇屏 + 「借屏显影」层（共享同一 --h 画幅，零布局跳动） ── */}
              <div className="relative mt-9 [--h:16.25rem] md:mt-11 md:[--h:22.5rem] xl:[--h:25rem]">
                {/* 底层：原汁原味的纯二十扇屏 */}
                <div
                  role="list"
                  aria-label="二十年，一年一幅"
                  className={cn(
                    "no-scrollbar -mx-6 flex gap-0.75 overflow-x-auto px-6 transition-opacity duration-500 ease-page lg:overflow-visible",
                    stageFeature ? "opacity-10 pointer-events-none" : "opacity-100",
                  )}
                  onPointerLeave={() => window.clearTimeout(intent.current)}
                >
                  {panels.map((p) => {
                    const isOpen = p.year === open;
                    const lit =
                      matched === null ||
                      catalog.some((s) => s.year === p.year && matched.has(s.id));
                    return (
              <div
                key={p.year}
                role="listitem"
                className="min-w-7.5 transition-[flex-grow,flex-basis,opacity] duration-700 ease-page"
                style={{
                  flex: isOpen ? "0 0 var(--h)" : "1 1 0%",
                  opacity: lit ? 1 : 0.22,
                }}
              >
                <button
                  type="button"
                  aria-label={`${p.year} 年${p.song ? `，《${p.song.title}》` : ""}`}
                  aria-expanded={isOpen}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") hoverOpenYear(p.year);
                  }}
                  onFocus={() => setOpen(p.year)}
                  onClick={() => {
                    if (isTouch && !isOpen) setOpen(p.year);
                    else onJumpYear(p.year);
                  }}
                  className="group relative block h-(--h) w-full overflow-hidden rounded-[2px] bg-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-(--tone) dark:bg-slate-800"
                >
                  {p.song && !p.art && (
                    <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-sm tracking-[0.4em] text-ink-meta [writing-mode:vertical-rl]">
                      {p.song.title}
                    </span>
                  )}
                  {p.song && p.art && (
                    <Image
                      src={getCoverUrl(p.song)}
                      alt=""
                      width={400}
                      height={400}
                      sizes="400px"
                      draggable={false}
                      className={cn(
                        "absolute top-0 left-1/2 h-(--h) w-(--h) max-w-none -translate-x-1/2 object-cover transition-[filter] duration-700",
                        isOpen
                          ? "grayscale-0"
                          : "brightness-[0.92] grayscale-[35%] group-hover:grayscale-0",
                      )}
                    />
                  )}
                </button>

                {/* 说明牌：年份常在；展开的那一扇多出作品名与词曲 */}
                <div className="h-18 overflow-hidden pt-3">
                  <p
                    className={cn(
                      "whitespace-nowrap font-mono text-[10px] tabular-nums tracking-wider transition-colors duration-500",
                      isOpen ? "text-(--tone)" : "text-ink-meta",
                    )}
                  >
                    {p.year}
                    {isOpen && p.count > 0 && (
                      <span className="text-ink-meta"> · {p.count} 曲</span>
                    )}
                  </p>
                  <AnimatePresence initial={false}>
                    {isOpen && p.song && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { delay: 0.25, duration: 0.5 },
                        }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="mt-1.5 min-w-0"
                      >
                        <p className="truncate font-serif text-[15px] text-ink">
                          《{p.song.title}》
                        </p>
                        <p className="mt-0.5 truncate font-kaiti text-xs text-ink-muted">
                          {creditSummary(p.song)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              );
          })}
          </div>

                {/* 借屏显影层（仅宽屏悬停右上角题签时轻柔浮现，严格占满同一 --h 区域，可移下直接交互） */ }
                <AnimatePresence>
          { stageFeature && (
                  <motion.div
                    key="feature-stage"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    onPointerEnter={keepStageOpen}
                    onPointerLeave={scheduleLeaveFeature}
                    className="absolute inset-0 z-10 hidden flex-col md:flex"
                  >
                    {/* 与二十扇屏严格等高的展幅区 */}
                    <div className="relative h-(--h) w-full bg-[#FAFAFA]/92 backdrop-blur-[2px] dark:bg-[#0B0F19]/92">
                      <AnimatePresence mode="wait" initial={false}>
                        {stageFeature.id === "qjtx" && (
                          <motion.div
                            key="stage-qjtx"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="flex h-full items-stretch gap-10 border-y border-slate-200/75 py-5 dark:border-slate-800/80"
                          >
                            <Link
                              href="/story/qjtx"
                              className="group relative aspect-[5/3] h-full shrink-0 overflow-hidden rounded-[3px] ring-1 ring-slate-900/6 dark:ring-white/10"
                            >
                              <Image
                                src="/story/qjtx/31.avif"
                                alt="倾尽天下长卷：雪中二人，一线朱砂"
                                fill
                                sizes="620px"
                                className="object-cover transition-transform duration-700 ease-page group-hover:scale-[1.03]"
                              />
                            </Link>

                            <div className="flex min-w-0 flex-1 flex-col justify-between py-2">
                              <div>
                                <p className="text-xs tracking-[0.35em] text-(--tone)">
                                  特展 · 互动长卷
                                </p>
                                <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-ink xl:text-4xl">
                                  <Link
                                    href="/story/qjtx"
                                    className="transition-colors hover:text-(--tone)"
                                  >
                                    倾尽天下
                                  </Link>
                                </h2>
                                <p className="mt-4 max-w-md font-kaiti text-base leading-[2] text-ink-prose">
                                  一曲长歌，随乐声缓步展开江山旧梦。雪落宫墙，旧事一帧一帧在指间推移。
                                </p>
                              </div>

                              <div>
                                <Link
                                  href="/story/qjtx"
                                  className="inline-flex items-center gap-2 text-xs tracking-[0.3em] text-(--tone) transition-opacity hover:opacity-75"
                                >
                                  入卷观览 →
                                </Link>
                              </div>
                            </div>
                          </motion.div>
                        )}

                          {
                            stageFeature.id === "imagery" && (
                              <motion.div
                                key="stage-imagery"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.3, ease: EASE }}
                                className="flex h-full flex-col justify-between border-y border-slate-200/75 py-7 dark:border-slate-800/80"
                              >
                                  <div className="flex items-baseline justify-between gap-4">
                                    <div className="flex items-baseline gap-4">
                                      <span className="text-xs tracking-[0.35em] text-(--tone)">
                                        特展 · 词中万象
                                      </span>
                                      <span className="font-kaiti text-sm text-ink-muted">
                                        二十年里，最常写到的是这些——点任一字直入该意象
                                      </span>
                                    </div>
                                    <Link
                                      href="/imagery"
                                      className="shrink-0 text-xs tracking-[0.26em] text-(--tone) transition-opacity hover:opacity-75"
                                    >
                                      {features.motifCount > 0
                                        ? `全部 ${features.motifCount} 个母题`
                                        : "入词云"}{" "}
                                      →
                                    </Link>
                                  </div>

                                  <div className="my-auto flex flex-wrap items-baseline gap-x-9 gap-y-4 py-4">
                                    {features.motifs.map((m) => (
                                      <Link
                                        key={m.id}
                                        href={`/imagery/${m.id}`}
                                        title={`${m.songCount} 首作品写到`}
                                        className={cn(
                                          "font-calligraphy leading-[1.2] transition-opacity duration-300 hover:opacity-65",
                                          stageMotifSize(m.songCount, maxMotifCount),
                                          paletteText(m.palette),
                                        )}
                                      >
                                        {m.name}
                                      </Link>
                                    ))}
                                  </div>

                                  <p className="font-kaiti text-xs text-ink-meta">
                                    按意象门类着矿色，收录二十年词作共现谱系
                                  </p>
                              </motion.div>
                            )
                          }

                  {stageFeature.id === "quiz" && (
                          <motion.div
                            key="stage-quiz"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="flex h-full flex-col justify-between border-y border-slate-200/75 py-7 dark:border-slate-800/80"
                          >
                            {features.question ? (
                              <>
                                <div>
                                  <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-xs tracking-[0.35em] text-(--tone)">
                                      特展 · {features.questionCount} 问之一 ·{" "}
                                      {features.question.title}
                                    </span>
                                    <Link
                                      href="/quiz"
                                      className="shrink-0 text-xs tracking-[0.26em] text-(--tone) transition-opacity hover:opacity-75"
                                    >
                                      直接启程 →
                                    </Link>
                                  </div>
                                  <h2 className="mt-5 font-serif text-2xl font-semibold text-ink xl:text-[1.75rem]">
                                    {features.question.stem}
                                  </h2>
                                </div>

                                <ol className="my-auto grid grid-cols-2 gap-x-12 gap-y-3">
                                  {features.question.options.map((text, i) => (
                                    <li key={i}>
                                      <Link
                                        href={`/quiz?q1=${i}`}
                                        className="group flex items-baseline gap-3.5 border-b border-slate-200/60 py-2.5 font-kaiti text-[15px] leading-relaxed text-ink-prose transition-colors hover:border-(--tone)/45 hover:text-(--tone) dark:border-slate-800/75"
                                      >
                                        <span className="shrink-0 font-serif text-xs text-ink-meta transition-colors group-hover:text-(--tone)">
                                          {OPTION_MARKS[i] ?? i + 1}
                                        </span>
                                        <span>{text}</span>
                                      </Link>
                                    </li>
                                  ))}
                                </ol>

                                <p className="font-kaiti text-xs text-ink-meta">
                                  点任一选项，即带着这一答进入十二问寻曲
                                </p>
                              </>
                            ) : (
                              <div className="my-auto flex flex-col items-start gap-3">
                                <span className="text-xs tracking-[0.35em] text-(--tone)">
                                  特展 · 十二问寻歌
                                </span>
                                <p className="font-kaiti text-base text-ink-prose">
                                  十二个问题，一段旅程，寻一首懂你的歌。
                                </p>
                                <Link
                                  href="/quiz"
                                  className="text-xs tracking-[0.28em] text-(--tone)"
                                >
                                  启程寻曲 →
                                </Link>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

            {/* 与下方说明牌同高（h-18）的静默提示行 */}
            <div className="flex h-18 items-start justify-between pt-3">
              <span className="font-kaiti text-xs text-ink-meta">
                移开指针即返二十年屏风
              </span>
              <button
                type="button"
                onClick={() => setStageFeature(null)}
                className="text-[11px] tracking-[0.24em] text-ink-meta transition-colors hover:text-(--tone)"
              >
                退回二十年
              </button>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header >
  );
}

// ── 方案 2：搜索与筛选全程收进 TopBar ──────────────────────────────────────────

export interface TopBarSearchChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** 放进 TopBar 的 pinned 插槽：极简寻曲与筛选触发按钮（宽窄屏皆常驻，零冗余输入框） */
export function TopBarSearchTrigger({
  open,
  activeCount,
  hasQuery,
  onClick,
}: {
  open: boolean;
  activeCount: number;
  hasQuery: boolean;
  onClick: () => void;
}) {
  const active = open || activeCount > 0 || hasQuery;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label="寻曲与筛选"
      title="寻曲与筛选（快捷键 /）"
      className={cn(
        NAV_BUTTON_CLASS,
        "relative inline-flex items-center gap-2 sm:px-3",
        active && "text-(--tone) dark:text-(--tone)",
      )}
    >
      <Search size={18} />
      <span className="hidden font-serif text-xs tracking-[0.22em] sm:inline">
        {open
          ? "收起"
          : activeCount > 0
            ? `筛选 · ${activeCount}`
            : hasQuery
              ? "检索中"
              : "寻曲"}
      </span>
      {/* 窄屏用极小强调色微点表示当前有搜索或筛选生效 */}
      {!open && (activeCount > 0 || hasQuery) && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-(--tone) sm:hidden"
        />
      )}
    </button>
  );
}

/**
 * 放进 TopBar 的 children 插槽：
 * - 宽屏展开时：从顶栏下沿柔和滑出书卷式检目面板（楷体寻曲底线 + 完整多维筛选）；
 * - 收起但有生效搜索/筛选时：仅留一行极轻的注脚条（随时撤回单项或重置）；
 * - 常态闲置时：完全隐形，整页零多余横条。
 */
export function TopBarSearchTray({
  open,
  onClose,
  isDesktop,
  searchInput,
  onSearchChange,
  onSearchFocus,
  lyricsState,
  activeChips,
  isAnyFilterActive,
  onReset,
  shownCount,
  totalCount,
  fullFilterContent,
}: {
  open: boolean;
  onClose: () => void;
  isDesktop: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  lyricsState: LyricsSearchState;
  activeChips: TopBarSearchChip[];
  isAnyFilterActive: boolean;
  onReset: () => void;
  shownCount: number;
  totalCount: number;
  fullFilterContent: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && isDesktop) {
      inputRef.current?.focus();
    }
  }, [open, isDesktop]);

  const hasActiveSummary = searchInput.trim() !== "" || activeChips.length > 0;

  if (open && isDesktop) {
    return (
      <div className="animate-in slide-in-from-top-2 fade-in border-t border-slate-200/70 bg-[#FAFAFA]/98 shadow-[0_24px_56px_-24px_rgba(15,23,42,0.18)] duration-300 dark:border-slate-800/80 dark:bg-[#0B0F19]/98 dark:shadow-[0_28px_64px_-20px_rgba(0,0,0,0.75)]">
        <div className="mx-auto max-w-7xl px-6 py-6">
          {/* 顶部楷体寻曲底线 */}
          <div className="group relative flex items-center gap-4 border-b border-slate-200/80 pb-3 dark:border-slate-800">
            <Search size={16} className="shrink-0 text-ink-meta" />
            <input
              ref={inputRef}
              type="text"
              placeholder="寻歌、词人或一句歌词……"
              value={searchInput}
              onFocus={onSearchFocus}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full min-w-0 bg-transparent font-kaiti text-base text-ink-body outline-none placeholder:text-ink-meta"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="shrink-0 text-xs tracking-[0.2em] text-ink-meta transition-colors hover:text-ink-body"
              >
                清空
              </button>
            ) : lyricsState === "loading" ? (
              <span
                aria-label="歌词检索准备中"
                className="block h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600"
              />
            ) : lyricsState === "ready" ? (
              <span className="shrink-0 text-[11px] tracking-[0.2em] text-(--tone)/70">
                含词检索
              </span>
            ) : null}

            <span
              aria-hidden
              className="h-3.5 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
            />

            <span className="shrink-0 font-mono text-xs tabular-nums text-ink-meta">
              {hasActiveSummary ? `${shownCount} / ${totalCount} 曲` : `${totalCount} 曲`}
            </span>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={onReset}
                className="shrink-0 text-xs tracking-[0.22em] text-(--tone) transition-opacity hover:opacity-75"
              >
                重置
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-xs tracking-[0.22em] text-ink-muted transition-colors hover:text-ink"
            >
              收起
            </button>

            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-px h-[1.5px] bg-(--tone) opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
            />
          </div>

          {/* 完整筛选（类型 + 年份滑轨 + 五维多选） */}
          <div className="mt-6">{fullFilterContent}</div>
        </div>
      </div>
    );
  }

  // 收起但有生效搜索或筛选时：在顶栏下沿静显一行极轻注脚，随时单撤或重置
  if (!open && hasActiveSummary) {
    return (
      <div className="border-t border-slate-200/60 bg-[#FAFAFA]/95 dark:border-slate-800/70 dark:bg-[#0B0F19]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="no-scrollbar flex min-w-0 items-baseline gap-y-1 overflow-x-auto text-xs">
            {searchInput.trim() !== "" && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                title="点击清空搜索词"
                className="group inline-flex shrink-0 items-baseline gap-1 font-kaiti text-[13px] text-ink-prose transition-colors hover:text-(--tone)"
              >
                <span>「{searchInput.trim()}」</span>
                <span className="font-sans text-[11px] text-ink-meta group-hover:text-(--tone)">
                  ×
                </span>
              </button>
            )}
            {activeChips.map((chip, idx) => (
              <Fragment key={chip.key}>
                {(idx > 0 || searchInput.trim() !== "") && (
                  <span aria-hidden className="mx-2 shrink-0 text-ink-faint">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  title="点击撤回此项筛选"
                  className="group inline-flex shrink-0 items-baseline gap-1 font-kaiti text-[13px] text-ink-prose transition-colors hover:text-(--tone)"
                >
                  <span>{chip.label}</span>
                  <span className="font-sans text-[11px] text-ink-meta group-hover:text-(--tone)">
                    ×
                  </span>
                </button>
              </Fragment>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-xs tracking-[0.2em]">
            <span className="font-mono text-[11px] tabular-nums tracking-normal text-(--tone)">
              {shownCount} 曲
            </span>
            <button
              type="button"
              onClick={onReset}
              className="text-ink-muted transition-colors hover:text-(--tone)"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
