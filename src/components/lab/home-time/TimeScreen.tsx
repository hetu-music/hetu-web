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
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { creditSummary, pickChapterFocal } from "./timeline";

/** 特展入口各取自己内容的一小片，指向时借屏风展开的那一扇展示 */
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

const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

type FeatureKey = "qjtx" | "imagery" | "quiz";

interface Preview {
  art: ReactNode;
  /** 说明牌第一行，占年份的位置 */
  label: string;
  title: string;
  note: string;
}

function paletteText(palette: number): string {
  return palette >= 0
    ? PALETTE_FULL[palette % PALETTE_FULL.length].text
    : GRAY_PALETTE.text;
}

function usePreviews(features: FeatureData): Record<FeatureKey, Preview> {
  return useMemo(() => {
    const motifs = features.motifs.slice(0, 5);
    return {
      qjtx: {
        art: (
          <Image
            src="/story/qjtx/31.avif"
            alt=""
            fill
            sizes="400px"
            className="object-cover"
          />
        ),
        label: "特展",
        title: "《倾尽天下》",
        note: "互动长卷 · 一曲长歌，随乐声缓步展开",
      },
      imagery: {
        art: (
          <div className="flex h-full w-full flex-row-reverse items-center justify-center gap-5 bg-slate-100 px-6 dark:bg-slate-900">
            {motifs.map((m, i) => (
              <span
                key={m.id}
                className={cn(
                  "font-calligraphy leading-none [writing-mode:vertical-rl]",
                  paletteText(m.palette),
                  i === 0 ? "text-6xl md:text-7xl" : "text-2xl md:text-3xl",
                )}
              >
                {m.name}
              </span>
            ))}
          </div>
        ),
        label: "意象",
        title:
          motifs.length > 0
            ? `${motifs
                .slice(0, 3)
                .map((m) => m.name)
                .join("、")}……`
            : "词中意象",
        note:
          features.motifCount > 0
            ? `${features.motifCount} 个母题，从词里一个个读出来`
            : "从词里一个个读出来",
      },
      quiz: {
        art: (
          <div className="flex h-full w-full justify-center bg-slate-100 px-8 py-9 dark:bg-slate-900">
            <p className="font-serif text-lg leading-loose tracking-[0.2em] text-ink [writing-mode:vertical-rl] md:text-xl">
              {features.question?.stem ?? "十二个问题，寻一首懂你的歌"}
            </p>
          </div>
        ),
        label: "寻曲",
        title: "第一问",
        note:
          features.questionCount > 0
            ? `共 ${features.questionCount} 问，答完得一首歌`
            : "答完得一首歌",
      },
    };
  }, [features]);
}

interface TimeScreenProps {
  panels: ScreenPanel[];
  firstYear: number;
  lastYear: number;
  totalCount: number;
  matched: ReadonlySet<number> | null;
  features: FeatureData;
  onJump: (year: number | null) => void;
}

/**
 * 卷首「屏风」展开的样子：最左一扇是序屏（题头与三处特展），其后一年一扇，由近及远，末尾一扇未详。
 * 屏风永远只开一扇：指向哪一年开哪一年；指向序屏里的特展，开着的那一扇借给特展。
 * 往下读时它合成吸顶的细带（FoldedStrip），开的那一扇换成正在读的那一年。
 */
export function TimeScreen({
  panels,
  firstYear,
  lastYear,
  totalCount,
  matched,
  features,
  onJump,
}: TimeScreenProps) {
  const isTouch = useSyncExternalStore(
    subscribeHoverNone,
    getHoverNone,
    getHoverNoneServer,
  );
  const previews = usePreviews(features);

  const [open, setOpen] = useState(panels[0]?.key ?? "");
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const preview = feature ? previews[feature] : null;
  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const hoverOpen = (key: string) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setOpen(key), HOVER_INTENT_MS);
  };

  const entrance = (
    key: FeatureKey,
    href: string,
    name: string,
    sub: string,
  ) => (
    <Link
      href={href}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setFeature(key);
      }}
      onPointerLeave={() => setFeature(null)}
      onFocus={() => setFeature(key)}
      onBlur={() => setFeature(null)}
      className="group outline-none [writing-mode:vertical-rl]"
    >
      <span
        className={cn(
          "font-serif text-[15px] tracking-[0.35em] transition-colors duration-300 md:text-base",
          feature === key
            ? "text-(--tone)"
            : "text-ink-body group-hover:text-(--tone) group-focus-visible:text-(--tone)",
        )}
      >
        {name}
      </span>
      <span className="ms-2.5 font-kaiti text-[11px] tracking-[0.2em] text-ink-meta">
        {sub}
      </span>
    </Link>
  );

  return (
    <header>
      {/* 屏：--h 是屏高，也是展开那一扇的宽（封面是正方形） */}
      <div
        role="list"
        aria-label="二十年，一年一扇"
        className="no-scrollbar -mx-6 flex gap-0.75 overflow-x-auto px-6 [--h:16.25rem] md:[--h:22.5rem] lg:overflow-visible xl:[--h:25rem]"
        onPointerLeave={() => window.clearTimeout(intent.current)}
      >
        {/* 序屏：不开合，与年份的屏隔开一段 */}
        <div role="listitem" className="mr-4 w-36 shrink-0 md:mr-6 md:w-44">
          <div className="flex h-(--h) flex-row-reverse justify-between">
            <h1 className="self-start font-serif text-4xl font-semibold leading-none tracking-[0.3em] text-ink [writing-mode:vertical-rl] md:text-5xl xl:text-6xl">
              二十年
            </h1>
            <nav
              aria-label="特展"
              className="flex flex-row-reverse gap-3.5 self-end md:gap-4"
            >
              {entrance("qjtx", "/story/qjtx", "倾尽天下", "互动长卷")}
              {entrance("imagery", "/imagery", "意象", "词中万象")}
              {entrance(
                "quiz",
                "/quiz",
                "寻曲",
                features.questionCount > 0
                  ? `${hanzi(features.questionCount)}问`
                  : "问答寻歌",
              )}
            </nav>
          </div>
          <div className="h-18 pt-3">
            <p className="whitespace-nowrap font-mono text-[10px] tabular-nums tracking-wider text-ink-meta">
              {lastYear}—{firstYear}
            </p>
            <p className="mt-1.5 font-kaiti text-xs text-ink-muted">
              {totalCount} 曲，由近及远
            </p>
          </div>
        </div>

        {panels.map((p) => {
          const isOpen = p.key === open;
          const showPreview = isOpen && preview !== null;
          const lit = panelLit(p, matched);
          return (
            <div
              key={p.key}
              role="listitem"
              className="min-w-7.5 transition-[flex-grow,flex-basis,opacity] duration-700 ease-page"
              style={{
                flex: isOpen ? "0 0 var(--h)" : "1 1 0%",
                opacity: lit || showPreview ? 1 : 0.22,
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
                onFocus={() => setOpen(p.key)}
                onClick={() => {
                  // 触屏先展开，再点才翻过去；鼠标指向时已经展开了
                  if (isTouch && !isOpen) setOpen(p.key);
                  else onJump(p.year);
                }}
                className="group relative block h-(--h) w-full overflow-hidden rounded-[2px] bg-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-(--tone) dark:bg-slate-800"
              >
                {p.year === null && (
                  <span className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-sm tracking-[0.4em] text-ink-meta [writing-mode:vertical-rl]">
                    未详
                  </span>
                )}
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
                    // 封面固定为整幅大小、居中裁出：展开只是把窗拉宽，画面本身不缩放
                    className={cn(
                      "absolute top-0 left-1/2 h-(--h) w-(--h) max-w-none -translate-x-1/2 object-cover transition-[filter] duration-700",
                      isOpen
                        ? "grayscale-0"
                        : "brightness-[0.92] grayscale-[35%] group-hover:grayscale-0",
                    )}
                  />
                )}
                <AnimatePresence>
                  {showPreview && (
                    <motion.div
                      key={feature}
                      aria-hidden
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.45 } }}
                      exit={{ opacity: 0, transition: { duration: 0.3 } }}
                      className="absolute inset-0"
                    >
                      {preview.art}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* 说明牌：年份常在；展开的那一扇多出作品名与词曲 */}
              <div className="h-18 overflow-hidden pt-3">
                <p
                  className={cn(
                    "whitespace-nowrap font-mono text-[10px] tabular-nums tracking-wider transition-colors duration-500",
                    isOpen ? "text-(--tone)" : "text-ink-meta",
                  )}
                >
                  {showPreview ? preview.label : (p.year ?? "未详")}
                  {isOpen && !showPreview && p.ids.size > 0 && (
                    <span className="text-ink-meta"> · {p.ids.size} 曲</span>
                  )}
                </p>
                <AnimatePresence initial={false} mode="wait">
                  {isOpen && (showPreview || p.song) && (
                    <motion.div
                      key={showPreview ? feature : p.key}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        transition: {
                          delay: showPreview ? 0.05 : 0.25,
                          duration: 0.4,
                        },
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="mt-1.5 min-w-0"
                    >
                      <p className="truncate font-serif text-[15px] text-ink">
                        {showPreview ? preview.title : `《${p.song?.title}》`}
                      </p>
                      <p className="mt-0.5 truncate font-kaiti text-xs text-ink-muted">
                        {showPreview
                          ? preview.note
                          : p.song && creditSummary(p.song)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
