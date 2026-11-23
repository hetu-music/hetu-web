"use client";

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

/** 展开一扇屏的停留时间：鼠标扫过整排时不让屏一扇扇跟着翻 */
const HOVER_INTENT_MS = 90;

const HOVER_NONE = "(hover: none)";
function subscribeHoverNone(onChange: () => void) {
  const mq = window.matchMedia(HOVER_NONE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getHoverNone = () => window.matchMedia(HOVER_NONE).matches;
const getHoverNoneServer = () => false;

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
  onJumpYear: (year: number) => void;
}

/**
 * 方向 E「二十扇屏」：卷首只挂二十幅，一年一扇，由近及远。
 * 一扇展开成整幅封面，其余十九扇只露出各自画面的一道竖条，并排如屏风、如长卷；
 * 指向哪一年那一扇便展开，下方随之出一张说明牌，点下去翻到正文里这一年。
 * 艺术感来自取舍：二十件而不是三百六十一件，一件大、十九件小，标签只有年份。
 */
export function HeaderDemoE({
  firstYear,
  lastYear,
  catalog,
  matched,
  countSlot,
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
  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const hoverOpen = (year: number) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setOpen(year), HOVER_INTENT_MS);
  };

  return (
    <header className="pb-2">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs tracking-[0.35em] text-(--tone)">
            河图作品勘鉴 · {firstYear}—{lastYear}
          </p>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <h1 className="font-serif text-5xl font-semibold leading-[1.1] tracking-tight text-ink md:text-6xl xl:text-7xl">
              二十年
            </h1>
            {countSlot}
          </div>
        </div>
        <p className="font-kaiti text-[15px] text-ink-muted md:pb-2 md:text-right md:text-base">
          你一定想知道，戏里讲了什么故事……
        </p>
      </div>

      {/* 屏：--h 是屏高，也是展开那一扇的宽（封面是正方形） */}
      <div
        role="list"
        aria-label="二十年，一年一幅"
        className="no-scrollbar -mx-6 mt-10 flex gap-0.75 overflow-x-auto px-6 [--h:16.25rem] md:mt-12 md:[--h:22.5rem] lg:overflow-visible xl:[--h:25rem]"
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
                  if (e.pointerType === "mouse") hoverOpen(p.year);
                }}
                onFocus={() => setOpen(p.year)}
                onClick={() => {
                  // 触屏先展开，再点才翻过去；鼠标指向时已经展开了
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
                    // 封面固定为整幅大小、居中裁出：展开只是把窗拉宽，画面本身不缩放
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
    </header>
  );
}
