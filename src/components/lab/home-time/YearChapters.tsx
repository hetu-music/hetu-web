"use client";

import CoverArt from "@/components/library/CoverArt";
import LyricsSnippet from "@/components/library/LyricsSnippet";
import SongTitleLink from "@/components/library/SongTitleLink";
import EnqueueButton from "@/components/shared/EnqueueButton";
import PlayButton from "@/components/shared/PlayButton";
import PlayingBars from "@/components/shared/PlayingBars";
import { useFavorites } from "@/context/FavoritesContext";
import type { Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { enumLabel, getCoverUrl } from "@/lib/utils/utils-song";
import { usePlayerStore } from "@/store/player-store";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { Fragment, useEffect, useRef, useState } from "react";
import {
  type YearChapter,
  creditSummary,
  pickChapterFocal,
  stripeColor,
} from "./timeline";

export type ReadingMode = "index" | "prose";

interface YearChaptersProps {
  chapters: YearChapter[];
  matched: ReadonlySet<number> | null;
  readingMode: ReadingMode;
  onOpenSong: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
  onActiveYearChange?: (yearKey: string) => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 馆藏编年正文（「一年一画幅 + 右侧书目」）：
 * 彻底告别满墙小方图货架：
 * - 宽屏左栏吸顶：大号年份 + 本年色丝微带 + 唯一一幅带色彩弥散的大画幅（悬停右侧任意歌名，
 *   左栏画幅与光晕实时平滑切换为那首歌的封面与色调！）；
 * - 宽屏右栏：清爽疏朗的编年目录（或诗集式连排），一屏可扫 20+ 首，同时保留词曲、时长、播放与歌词片段；
 * - 筛选无命中的年份折成一行「这一年没有」，二十年时间一根不断。
 */
export default function YearChapters({
  chapters,
  matched,
  readingMode,
  onOpenSong,
  getLyricsSnippet,
  onActiveYearChange,
}: YearChaptersProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听当前阅读到哪一年，供右侧悬浮年份标尺高亮
  useEffect(() => {
    if (!onActiveYearChange) return;
    const root = containerRef.current;
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("section[data-year-key]"),
    );
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          );
        const topKey = visible[0]?.target.getAttribute("data-year-key");
        if (topKey) onActiveYearChange(topKey);
      },
      { rootMargin: "-22% 0px -58% 0px", threshold: 0 },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [chapters, matched, onActiveYearChange]);

  return (
    <div ref={containerRef} className="relative">
      {chapters.map((chapter) => (
        <ChapterBlock
          key={chapter.year ?? "unknown"}
          chapter={chapter}
          matched={matched}
          readingMode={readingMode}
          onOpenSong={onOpenSong}
          getLyricsSnippet={getLyricsSnippet}
        />
      ))}
    </div>
  );
}

function ChapterBlock({
  chapter,
  matched,
  readingMode,
  onOpenSong,
  getLyricsSnippet,
}: {
  chapter: YearChapter;
  matched: ReadonlySet<number> | null;
  readingMode: ReadingMode;
  onOpenSong: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
}) {
  const tEnum = useTranslations("enums");
  const tSong = useTranslations("song");
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { currentTrack, isPlaying } = usePlayerStore();

  const shown = matched
    ? chapter.songs.filter((s) => matched.has(s.id))
    : chapter.songs;
  const yearKey = String(chapter.year ?? "unknown");

  const defaultFocal = pickChapterFocal(shown);
  const [hoveredSong, setHoveredSong] = useState<Song | null>(null);

  // 若右侧正在播放本年里的某首歌，无悬停时默认展示正在播放的那一首
  const playingInChapter =
    isPlaying && currentTrack
      ? (shown.find((s) => s.id === currentTrack.songId) ?? null)
      : null;

  const activeFocal =
    hoveredSong && shown.some((s) => s.id === hoveredSong.id)
      ? hoveredSong
      : (playingInChapter ?? defaultFocal);

  // 无命中年份：折成一行，保留二十年时间的完整脉络
  if (shown.length === 0) {
    return (
      <section
        id={`y${yearKey}`}
        data-year-key={yearKey}
        className="flex scroll-mt-[calc(var(--nav-h)+5rem)] items-baseline gap-6 border-t border-slate-200/60 py-4 dark:border-slate-800/70"
      >
        <span className="w-24 shrink-0 font-serif text-xl tabular-nums tracking-tight text-slate-300 lg:w-[21rem] dark:text-slate-700">
          {chapter.year ?? "年份未详"}
        </span>
        <span className="font-kaiti text-sm text-slate-300 dark:text-slate-700">
          这一年没有
        </span>
      </section>
    );
  }

  const focalColor = activeFocal ? stripeColor(activeFocal) : null;
  const focalHasCover = !!activeFocal?.hascover;

  return (
    <section
      id={`y${yearKey}`}
      data-year-key={yearKey}
      className="grid scroll-mt-[calc(var(--nav-h)+5rem)] gap-y-8 border-t border-slate-200/75 py-12 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 lg:py-20 xl:grid-cols-[22rem_minmax(0,1fr)] dark:border-slate-800/80"
    >
      {/* ── 左栏（宽屏吸顶展幅）/ 顶栏（手机紧凑章头） ── */}
      <aside className="self-start lg:sticky lg:top-[calc(var(--nav-h)+5.5rem)]">
        {/* 移动端紧凑章头：左年份 + 本年色丝微带，右一枚小方幅代表作 */}
        <div className="flex items-center justify-between gap-4 lg:block">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-4xl font-semibold leading-none tracking-tight tabular-nums text-slate-900 lg:text-5xl dark:text-slate-50">
                {chapter.year ?? "未详"}
              </h2>
              <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {matched
                  ? `${shown.length} / ${chapter.songs.length} 曲`
                  : `${chapter.songs.length} 曲`}
              </span>
            </div>

            {/* 本年专属微型色带：把这一年的封面色彩凝成一道 3px 细丝 */}
            <div
              aria-hidden
              className="mt-3.5 flex h-[3px] w-full max-w-[14rem] overflow-hidden rounded-full bg-slate-200/70 lg:mt-4 lg:max-w-none dark:bg-slate-800"
            >
              {chapter.songs.map((s) => {
                const c = stripeColor(s);
                const hit = matched === null || matched.has(s.id);
                return (
                  <span
                    key={s.id}
                    className={cn(
                      "block h-full flex-1 transition-opacity duration-300",
                      !c && "bg-slate-300/60 dark:bg-slate-700/60",
                      matched && !hit && "opacity-15 grayscale",
                    )}
                    style={{ backgroundColor: c ?? undefined }}
                  />
                );
              })}
            </div>
          </div>

          {/* 手机端右上角精致代表作缩影（避免占满首屏像详情页） */}
          {defaultFocal && (
            <button
              type="button"
              onClick={() => onOpenSong(defaultFocal.id)}
              aria-label={`进入《${defaultFocal.title}》详情页`}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-slate-100 ring-1 ring-slate-900/10 lg:hidden dark:bg-slate-800 dark:ring-white/15"
              style={{ backgroundColor: stripeColor(defaultFocal) ?? undefined }}
            >
              {defaultFocal.hascover ? (
                <Image
                  src={getCoverUrl(defaultFocal)}
                  alt={defaultFocal.title}
                  width={112}
                  height={112}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-serif text-xs text-slate-500 dark:text-slate-400">
                  {defaultFocal.title.slice(0, 2)}
                </span>
              )}
            </button>
          )}
        </div>

        {/* 宽屏独有：一章一幅带色彩弥散的动态大画幅（随右侧悬停实时显影！） */}
        {activeFocal && (
          <div className="relative mt-8 hidden lg:block">
            {/* 柔和色彩弥散：浅色模式像淡彩晕纸，深色模式复刻暗展厅灯光 */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 rounded-full opacity-25 blur-[64px] transition-colors duration-1000 dark:opacity-40"
              style={{
                background: focalColor ?? "var(--tone)",
              }}
            />

            <AnimatePresence mode="wait">
              <motion.figure
                key={activeFocal.id}
                initial={{ opacity: 0.25, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.25, scale: 0.985 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="relative"
              >
                <div
                  onClick={() => onOpenSong(activeFocal.id)}
                  className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-md bg-slate-100 shadow-[0_28px_60px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/[0.07] dark:bg-slate-900 dark:shadow-[0_32px_70px_-22px_rgba(0,0,0,0.88)] dark:ring-white/12"
                >
                  {focalHasCover ? (
                    <CoverArt
                      song={activeFocal}
                      sizes="352px"
                      className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    /* 无封面的早期作品：以极简刻字碑拓呈现，不放丑占位图 */
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[#F4F3EF] p-8 dark:bg-[#0E1320]">
                      <span className="font-calligraphy text-4xl tracking-[0.35em] text-slate-700 [writing-mode:vertical-rl] dark:text-slate-200">
                        {activeFocal.title}
                      </span>
                    </div>
                  )}
                </div>

                <figcaption className="mt-4 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenSong(activeFocal.id)}
                      className="block max-w-full truncate text-left font-serif text-base text-slate-900 transition-colors hover:text-(--tone) dark:text-slate-100"
                    >
                      《{activeFocal.title}》
                    </button>
                    <p className="mt-0.5 truncate font-kaiti text-xs text-slate-400 dark:text-slate-500">
                      {creditSummary(activeFocal) ||
                        (activeFocal.date
                          ? activeFocal.date.replaceAll("-", ".")
                          : "无题记")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <PlayButton
                      songId={activeFocal.id}
                      title={activeFocal.title}
                      artist={activeFocal.artist?.join(" / ")}
                      coverUrl={getCoverUrl(activeFocal)}
                      hasAudio={activeFocal.has_audio}
                      size={14}
                    />
                  </div>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>
        )}
      </aside>

      {/* ── 右栏：本年书目（编年行目 / 诗集排印，零缩略图货架感） ── */}
      <div
        className="min-w-0"
        onMouseLeave={() => setHoveredSong(null)}
      >
        {readingMode === "index" ? (
          <ul className="divide-y divide-slate-200/65 border-y border-slate-200/65 dark:divide-slate-800/70 dark:border-slate-800/70">
            {shown.map((song) => {
              const color = stripeColor(song);
              const fav = isFavorite(song.id);
              const playing = currentTrack?.songId === song.id && isPlaying;
              const isFocal = activeFocal?.id === song.id;
              const snippet = getLyricsSnippet(song.id);
              const monthDay = song.date ? song.date.slice(5).replace("-", ".") : "";

              return (
                <li
                  key={song.id}
                  onMouseEnter={() => setHoveredSong(song)}
                  onClick={() => onOpenSong(song.id)}
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3.5 py-3.5 transition-colors duration-300 sm:items-center sm:gap-5 sm:py-4",
                    isFocal
                      ? "bg-slate-900/[0.02] dark:bg-white/[0.025]"
                      : "hover:bg-slate-900/[0.018] dark:hover:bg-white/[0.02]",
                  )}
                >
                  {/* 封面色丝微点：1.5px × 14px，克制地把每首歌的颜色编进目录 */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-3.5 w-[2.5px] shrink-0 rounded-full transition-all duration-300 sm:mt-0",
                      !color && "bg-slate-300/70 dark:bg-slate-700/70",
                      isFocal ? "scale-y-125 opacity-100" : "opacity-65 group-hover:opacity-100",
                    )}
                    style={{ backgroundColor: color ?? undefined }}
                  />

                  {/* 月.日 */}
                  <span className="mt-1 hidden w-11 shrink-0 font-mono text-[11px] tabular-nums tracking-wider text-slate-400 sm:mt-0 sm:block dark:text-slate-500">
                    {monthDay || "——"}
                  </span>

                  {/* 歌名 + 词曲 + 歌词命中片段 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <h3
                        className={cn(
                          "truncate font-serif text-[17px] leading-snug text-slate-900 transition-colors sm:text-[19px] dark:text-slate-100",
                          playing || isFocal
                            ? "text-(--tone)"
                            : "group-hover:text-(--tone)",
                        )}
                      >
                        <SongTitleLink
                          songId={song.id}
                          onNavigate={() => onOpenSong(song.id)}
                        >
                          {song.title}
                        </SongTitleLink>
                      </h3>
                      {playing && <PlayingBars />}
                    </div>

                    <p className="mt-0.5 flex items-center gap-2 truncate font-kaiti text-[13px] text-slate-500 dark:text-slate-400">
                      {monthDay && (
                        <span className="font-mono text-[10px] tabular-nums text-slate-400 sm:hidden dark:text-slate-500">
                          {monthDay}
                        </span>
                      )}
                      <span className="truncate">
                        {creditSummary(song) || "单曲"}
                      </span>
                    </p>

                    {snippet && (
                      <LyricsSnippet snippet={snippet} className="mt-1.5" />
                    )}
                  </div>

                  {/* 右侧：类型、时长、悬停播放/入列/收藏 */}
                  <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                    <div className="hidden items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
                      <PlayButton
                        songId={song.id}
                        title={song.title}
                        artist={song.artist?.join(" / ")}
                        coverUrl={getCoverUrl(song)}
                        hasAudio={song.has_audio}
                        size={14}
                      />
                      <EnqueueButton
                        songId={song.id}
                        title={song.title}
                        artist={song.artist?.join(" / ")}
                        coverUrl={getCoverUrl(song)}
                        hasAudio={song.has_audio}
                        size={14}
                      />
                    </div>

                    {isLoggedIn && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song.id);
                        }}
                        aria-label={
                          fav
                            ? tSong("actions.unfavorite")
                            : tSong("actions.favorite")
                        }
                        className={cn(
                          "p-1.5 transition-all duration-200",
                          fav
                            ? "text-rose-500 opacity-100"
                            : "text-slate-400 opacity-0 hover:text-rose-500 group-hover:opacity-100 dark:text-slate-500",
                        )}
                      >
                        <Heart
                          size={14}
                          className={fav ? "fill-current" : ""}
                        />
                      </button>
                    )}

                    {song.type?.[0] && (
                      <span className="hidden w-12 text-right text-[11px] tracking-[0.2em] text-slate-400 sm:inline-block dark:text-slate-500">
                        {enumLabel(tEnum, "type", song.type[0])}
                      </span>
                    )}

                    <span className="w-11 text-right font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      {song.length ? formatTime(song.length) : "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          /* 诗集式排印：大号衬线歌名连排，鼠标扫过左侧大画幅实时显影 */
          <p className="font-serif text-2xl leading-[2.05] text-slate-800 md:text-[1.85rem] md:leading-[1.95] dark:text-slate-200">
            {shown.map((song, i) => {
              const isFocal = activeFocal?.id === song.id;
              return (
                <Fragment key={song.id}>
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="mx-[0.45em] font-light text-slate-300 dark:text-slate-700"
                    >
                      /
                    </span>
                  )}
                  <span
                    onMouseEnter={() => setHoveredSong(song)}
                    className={cn(
                      "inline-block whitespace-nowrap transition-colors duration-300",
                      isFocal
                        ? "text-(--tone)"
                        : "hover:text-(--tone)",
                    )}
                  >
                    <SongTitleLink
                      songId={song.id}
                      onNavigate={() => onOpenSong(song.id)}
                    >
                      {song.title}
                    </SongTitleLink>
                  </span>
                </Fragment>
              );
            })}
          </p>
        )}
      </div>
    </section>
  );
}
