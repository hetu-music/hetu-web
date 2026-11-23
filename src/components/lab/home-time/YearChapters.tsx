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
import { memo, useEffect, useRef, useState } from "react";
import {
  type YearChapter,
  creditSummary,
  pickChapterFocal,
  stripeColor,
} from "./timeline";

interface YearChaptersProps {
  chapters: YearChapter[];
  matched: ReadonlySet<number> | null;
  onOpenSong: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
  onActiveYearChange?: (yearKey: string) => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 馆藏编年目录（「一年一画幅 + 右侧编年行目」，由近及远）：
 * - 宽屏左栏吸顶：大号年份 + 本年色丝微带 + 一幅带色彩弥散的动态大画幅（悬停右侧任意曲目实时显影）；
 * - 宽屏右栏：无缩略图货架感的编年目录，承载色丝微点、月日、衬线曲名、楷体词曲、歌词片段与试听；
 * - 筛选无命中的年份折成一行「这一年没有」，二十年时间一根不断。
 */
function YearChapters({
  chapters,
  matched,
  onOpenSong,
  getLyricsSnippet,
  onActiveYearChange,
}: YearChaptersProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      {chapters.map((chapter, index) => (
        <ChapterBlock
          key={chapter.year ?? "unknown"}
          chapter={chapter}
          isFirst={index === 0}
          matched={matched}
          onOpenSong={onOpenSong}
          getLyricsSnippet={getLyricsSnippet}
        />
      ))}
    </div>
  );
}

export default memo(YearChapters);

const ChapterBlock = memo(function ChapterBlock({
  chapter,
  isFirst,
  matched,
  onOpenSong,
  getLyricsSnippet,
}: {
  chapter: YearChapter;
  isFirst: boolean;
  matched: ReadonlySet<number> | null;
  onOpenSong: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
}) {
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  // 逐项订阅：播放器其他状态（音量、队列、加载中……）变化不重渲整章
  const currentSongId = usePlayerStore((s) => s.currentTrack?.songId ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const shown = matched
    ? chapter.songs.filter((s) => matched.has(s.id))
    : chapter.songs;
  const yearKey = String(chapter.year ?? "unknown");

  const defaultFocal = pickChapterFocal(shown);
  const [hoveredSong, setHoveredSong] = useState<Song | null>(null);

  const playingInChapter =
    isPlaying && currentSongId !== null
      ? (shown.find((s) => s.id === currentSongId) ?? null)
      : null;

  const activeFocal =
    hoveredSong && shown.some((s) => s.id === hoveredSong.id)
      ? hoveredSong
      : (playingInChapter ?? defaultFocal);

  // 无命中年份：折成一行，时间不断
  if (shown.length === 0) {
    return (
      <section
        id={`y${yearKey}`}
        data-year-key={yearKey}
        className={cn(
          "flex scroll-mt-[calc(var(--nav-h)+4rem)] items-baseline gap-6 py-4",
          !isFirst && "border-t border-slate-200/60 dark:border-slate-800/70",
        )}
      >
        <span className="w-24 shrink-0 font-serif text-xl tabular-nums tracking-tight text-ink-faint lg:w-[20rem] xl:w-88">
          {chapter.year ?? "年份未详"}
        </span>
        <span className="font-kaiti text-sm text-ink-faint">这一年没有</span>
      </section>
    );
  }

  const focalColor = activeFocal ? stripeColor(activeFocal) : null;

  return (
    <section
      id={`y${yearKey}`}
      data-year-key={yearKey}
      className={cn(
        "grid scroll-mt-[calc(var(--nav-h)+4rem)] gap-y-8 py-12 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 lg:py-18 xl:grid-cols-[22rem_minmax(0,1fr)]",
        !isFirst && "border-t border-slate-200/75 dark:border-slate-800/80",
      )}
    >
      {/* ── 左栏（宽屏吸顶展幅）/ 顶栏（手机紧凑章头） ── */}
      <aside className="self-start lg:sticky lg:top-[calc(var(--nav-h)+4.5rem)]">
        <div className="flex items-center justify-between gap-4 lg:block">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-4xl font-semibold leading-none tracking-tight tabular-nums text-ink lg:text-5xl">
                {chapter.year ?? "未详"}
              </h2>
              <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-ink-meta">
                {matched
                  ? `${shown.length} / ${chapter.songs.length} 曲`
                  : `${chapter.songs.length} 曲`}
              </span>
            </div>

            {/* 本年专属 3px 微色带 */}
            <div
              aria-hidden
              className="mt-3.5 flex h-0.75 w-full max-w-56 overflow-hidden rounded-full bg-slate-200/70 lg:mt-4 lg:max-w-none dark:bg-slate-800"
            >
              {chapter.songs.map((s) => {
                const c = stripeColor(s);
                const hit = matched === null || matched.has(s.id);
                return (
                  <span
                    key={s.id}
                    className={cn(
                      "block h-full flex-1 transition-opacity duration-300",
                      matched && !hit && "opacity-15 grayscale",
                    )}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          {/* 手机端右上角精致代表作缩影 */}
          {defaultFocal && (
            <button
              type="button"
              onClick={() => onOpenSong(defaultFocal.id)}
              aria-label={`进入《${defaultFocal.title}》详情页`}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-slate-100 ring-1 ring-slate-900/10 lg:hidden dark:bg-slate-800 dark:ring-white/15"
              style={{ backgroundColor: stripeColor(defaultFocal) }}
            >
              <Image
                src={getCoverUrl(defaultFocal)}
                alt={defaultFocal.title}
                width={112}
                height={112}
                sizes="56px"
                className="h-full w-full object-cover"
              />
            </button>
          )}
        </div>

        {/* 宽屏独有：一章一幅带色彩弥散的动态大画幅 */}
        {activeFocal && (
          <div className="relative mt-8 hidden lg:block">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 rounded-full opacity-25 blur-3xl transition-colors duration-1000 dark:opacity-40"
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
                  <CoverArt
                    song={activeFocal}
                    sizes="352px"
                    className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                </div>

                <figcaption className="mt-4 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenSong(activeFocal.id)}
                      className="block max-w-full truncate text-left font-serif text-base text-ink transition-colors hover:text-(--tone)"
                    >
                      《{activeFocal.title}》
                    </button>
                    <p className="mt-0.5 truncate font-kaiti text-xs text-ink-meta">
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

      {/* ── 右栏：编年目录 ── */}
      <div className="min-w-0" onMouseLeave={() => setHoveredSong(null)}>
        <ul className="divide-y divide-slate-200/65 border-y border-slate-200/65 dark:divide-slate-800/70 dark:border-slate-800/70">
          {shown.map((song) => (
            <ChapterRow
              key={song.id}
              song={song}
              fav={isFavorite(song.id)}
              playing={currentSongId === song.id && isPlaying}
              isFocal={activeFocal?.id === song.id}
              isLoggedIn={isLoggedIn}
              onOpenSong={onOpenSong}
              onHover={setHoveredSong}
              onToggleFavorite={toggleFavorite}
              getLyricsSnippet={getLyricsSnippet}
            />
          ))}
        </ul>
      </div>
    </section>
  );
});

/** 目录一行。memo：悬停换焦点时只有焦点前后两行重渲 */
const ChapterRow = memo(function ChapterRow({
  song,
  fav,
  playing,
  isFocal,
  isLoggedIn,
  onOpenSong,
  onHover,
  onToggleFavorite,
  getLyricsSnippet,
}: {
  song: Song;
  fav: boolean;
  playing: boolean;
  isFocal: boolean;
  isLoggedIn: boolean;
  onOpenSong: (id: number) => void;
  onHover: (song: Song) => void;
  onToggleFavorite: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
}) {
  const tEnum = useTranslations("enums");
  const tSong = useTranslations("song");
  const color = stripeColor(song);
  const snippet = getLyricsSnippet(song.id);
  const monthDay = song.date ? song.date.slice(5).replace("-", ".") : "";

  return (
    <li
      aria-current={isFocal ? "true" : undefined}
      onMouseEnter={() => onHover(song)}
      onClick={() => onOpenSong(song.id)}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3.5 py-3.5 transition-colors duration-300 sm:items-center sm:gap-5 sm:py-4",
        isFocal
          ? "bg-slate-900/2 dark:bg-white/2.5"
          : "hover:bg-slate-900/[0.018] dark:hover:bg-white/2",
      )}
    >
      {/* 封面色丝微点 */}
      <span
        aria-hidden
        className={cn(
          "mt-1.5 h-3.5 w-[2.5px] shrink-0 rounded-full transition-all duration-300 sm:mt-0",
          isFocal
            ? "scale-y-125 opacity-100"
            : "opacity-65 group-hover:opacity-100",
        )}
        style={{ backgroundColor: color }}
      />

      {/* 月.日 */}
      <span className="mt-1 hidden w-11 shrink-0 font-mono text-[11px] tabular-nums tracking-wider text-ink-meta sm:mt-0 sm:block">
        {monthDay || "——"}
      </span>

      {/* 歌名 + 词曲 + 歌词命中片段 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <h3
            className={cn(
              "truncate font-serif text-[17px] leading-snug transition-colors sm:text-[19px]",
              // 当前项（焦点、正在放）与悬停只改文字颜色。当前项不能和带 dark: 的常态色写在一起：
              // 两者优先级相同而 dark: 排在后面，深色下强调色会被盖住（悬停多一个 :hover，不受影响）
              playing || isFocal
                ? "text-(--tone)"
                : "text-ink group-hover:text-(--tone)",
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

        <p className="mt-0.5 flex items-center gap-2 truncate font-kaiti text-[13px] text-ink-muted">
          {monthDay && (
            <span className="font-mono text-[10px] tabular-nums text-ink-meta sm:hidden">
              {monthDay}
            </span>
          )}
          <span className="truncate">{creditSummary(song) || "单曲"}</span>
        </p>

        {snippet && <LyricsSnippet snippet={snippet} className="mt-1.5" />}
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
              onToggleFavorite(song.id);
            }}
            aria-label={
              fav ? tSong("actions.unfavorite") : tSong("actions.favorite")
            }
            className={cn(
              "p-1.5 transition-all duration-200",
              fav
                ? "text-rose-500 opacity-100"
                : "text-ink-meta opacity-0 hover:text-rose-500 group-hover:opacity-100",
            )}
          >
            <Heart size={14} className={fav ? "fill-current" : ""} />
          </button>
        )}

        {song.type?.[0] && (
          <span className="hidden w-12 text-right text-[11px] tracking-[0.2em] text-ink-meta sm:inline-block">
            {enumLabel(tEnum, "type", song.type[0])}
          </span>
        )}

        <span className="w-11 text-right font-mono text-[11px] tabular-nums text-ink-meta">
          {song.length ? formatTime(song.length) : "—"}
        </span>
      </div>
    </li>
  );
});
