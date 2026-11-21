"use client";

import CoverArt from "@/components/library/CoverArt";
import LyricsSnippet from "@/components/library/LyricsSnippet";
import SongTitleLink from "@/components/library/SongTitleLink";
import PlayButton from "@/components/shared/PlayButton";
import type { Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { motion } from "framer-motion";
import Image from "next/image";
import { Fragment, useState } from "react";
import { type YearChapter, stripeColor } from "./timeline";

export type ChapterView = "grid" | "list";

interface YearChaptersProps {
  /** 全部歌按年分好的章（色条用全部，显示用命中的） */
  chapters: YearChapter[];
  matched: ReadonlySet<number> | null;
  view: ChapterView;
  /** 变了就重播进场动画 */
  playKey: string;
  onOpenSong: (id: number) => void;
  getLyricsSnippet: (id: number) => Snippet | undefined;
}

const PLATE_SIZES =
  "(min-width: 1280px) 150px, (min-width: 1024px) 15vw, (min-width: 640px) 20vw, 30vw";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 正文：一年一章。左边是年份和这一年的那一段色带，右边是作品。
 * 筛选时没有命中的年份折成一行，时间不断。
 */
export default function YearChapters({
  chapters,
  matched,
  view,
  playKey,
  onOpenSong,
  getLyricsSnippet,
}: YearChaptersProps) {
  const [float, setFloat] = useState<{
    song: Song;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="relative">
      {chapters.map((ch) => {
        const shown = matched
          ? ch.songs.filter((s) => matched.has(s.id))
          : ch.songs;
        const key = ch.year ?? "unknown";

        if (shown.length === 0) {
          // 这一年没有命中：只留年份，像目录里跳过的一页
          return (
            <section
              key={key}
              id={`y${key}`}
              className="flex items-baseline gap-6 border-t border-slate-200/60 py-4 dark:border-slate-800/70"
            >
              <span className="w-[13rem] shrink-0 font-serif text-xl tabular-nums tracking-tight text-slate-300 dark:text-slate-700">
                {ch.year ?? "年份未详"}
              </span>
              <span className="font-kaiti text-sm text-slate-300 dark:text-slate-700">
                这一年没有
              </span>
            </section>
          );
        }

        const withCover = shown.filter((s) => stripeColor(s));
        const without = shown.filter((s) => !stripeColor(s));

        return (
          <section
            key={key}
            id={`y${key}`}
            className="grid scroll-mt-[calc(var(--nav-h)+5rem)] gap-x-12 gap-y-8 border-t border-slate-200/70 py-14 md:grid-cols-[13rem_1fr] md:py-20 dark:border-slate-800"
          >
            <header className="self-start md:sticky md:top-[calc(var(--nav-h)+6rem)]">
              <h2 className="font-serif text-5xl leading-none tracking-tight tabular-nums text-slate-900 md:text-6xl dark:text-slate-100">
                {ch.year ?? "未详"}
              </h2>
              {/* 这一年的那一段色带：一首一根，宽度就是产量 */}
              {ch.year && (
                <div className="mt-6 flex h-12 flex-wrap [--blank:#E2E8F0] dark:[--blank:#1E293B]">
                  {ch.songs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={s.title}
                      title={s.title}
                      onClick={() => onOpenSong(s.id)}
                      className={cn(
                        "h-full w-1.5 transition-opacity duration-700 ease-page hover:opacity-60",
                        matched && !matched.has(s.id) && "opacity-[0.08]",
                      )}
                      style={{ background: stripeColor(s) ?? "var(--blank)" }}
                    />
                  ))}
                </div>
              )}

              <p className="mt-3 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                {matched
                  ? `${shown.length} / ${ch.songs.length} 首`
                  : `${ch.songs.length} 首`}
              </p>
            </header>

            <div key={`${playKey}-${view}`}>
              {view === "grid" ? (
                <>
                  {withCover.length > 0 && (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {withCover.map((s, i) => (
                        <Plate
                          key={s.id}
                          song={s}
                          index={i}
                          onOpen={() => onOpenSong(s.id)}
                          snippet={getLyricsSnippet(s.id)}
                        />
                      ))}
                    </div>
                  )}
                  {without.length > 0 && (
                    <p
                      className={cn(
                        "font-serif text-lg leading-[2.1] text-slate-700 dark:text-slate-300",
                        withCover.length > 0 && "mt-12",
                      )}
                    >
                      {withCover.length > 0 && (
                        <span className="mr-4 font-kaiti text-sm text-slate-400 dark:text-slate-500">
                          此外
                        </span>
                      )}
                      {without.map((s, i) => (
                        <Fragment key={s.id}>
                          {i > 0 && (
                            <span
                              aria-hidden
                              className="mx-3 text-slate-300 dark:text-slate-700"
                            >
                              /
                            </span>
                          )}
                          <TitleLink song={s} onOpen={onOpenSong} />
                        </Fragment>
                      ))}
                    </p>
                  )}
                </>
              ) : (
                // 排印：只有歌名，停在上面才浮出封面
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="font-serif text-2xl leading-[1.9] text-slate-800 md:text-[2rem] md:leading-[1.8] dark:text-slate-200"
                  onPointerLeave={() => setFloat(null)}
                >
                  {shown.map((s, i) => (
                    <Fragment key={s.id}>
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="mx-[0.45em] font-light text-slate-300 dark:text-slate-700"
                        >
                          /
                        </span>
                      )}
                      <span
                        onPointerMove={(e) => {
                          if (e.pointerType !== "mouse") return;
                          if (!stripeColor(s)) return setFloat(null);
                          setFloat({ song: s, x: e.clientX, y: e.clientY });
                        }}
                        onPointerLeave={() => setFloat(null)}
                      >
                        <TitleLink song={s} onOpen={onOpenSong} />
                      </span>
                    </Fragment>
                  ))}
                </motion.p>
              )}
            </div>
          </section>
        );
      })}

      {/* 排印视图里跟着鼠标的封面 */}
      {float && (
        <div
          className="pointer-events-none fixed z-30 h-44 w-44 overflow-hidden shadow-[0_24px_60px_-24px_rgba(15,23,42,0.5)] ring-1 ring-black/5"
          style={{
            left: float.x + 28,
            top: float.y - 88,
            background: stripeColor(float.song) ?? undefined,
          }}
        >
          <Image
            src={getCoverUrl(float.song)}
            alt=""
            fill
            sizes="176px"
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}

function TitleLink({
  song,
  onOpen,
}: {
  song: Song;
  onOpen: (id: number) => void;
}) {
  return (
    <span className="whitespace-nowrap transition-colors duration-300 hover:text-(--tone)">
      <SongTitleLink songId={song.id} onNavigate={() => onOpen(song.id)}>
        {song.title}
      </SongTitleLink>
    </span>
  );
}

function Plate({
  song,
  index,
  onOpen,
  snippet,
}: {
  song: Song;
  index: number;
  onOpen: () => void;
  snippet?: Snippet;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay: (index % 4) * 0.05 }}
      onClick={onOpen}
      className="group cursor-pointer"
    >
      <div
        className="relative aspect-square overflow-hidden"
        style={{ background: stripeColor(song) ?? undefined }}
      >
        <CoverArt
          song={song}
          sizes={PLATE_SIZES}
          className="grayscale-[35%] transition-[filter,transform] duration-700 ease-page group-hover:scale-[1.03] group-hover:grayscale-0"
        />
        <div className="absolute bottom-2 right-2 opacity-100 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
          <PlayButton
            songId={song.id}
            title={song.title}
            artist={song.artist?.join(" / ")}
            coverUrl={getCoverUrl(song)}
            hasAudio={song.has_audio}
            className="rounded-full bg-[#FAFAFA]/90 p-1.5 dark:bg-[#0B0F19]/90"
            size={14}
          />
        </div>
      </div>
      <h3 className="mt-2.5 line-clamp-1 font-serif text-[15px] leading-snug text-slate-900 transition-colors group-hover:text-(--tone) dark:text-slate-100">
        <SongTitleLink songId={song.id} onNavigate={onOpen}>
          {song.title}
        </SongTitleLink>
      </h3>
      <p className="mt-0.5 truncate text-[11px] tabular-nums tracking-wider text-slate-400 dark:text-slate-500">
        {song.date?.slice(5).replace("-", ".")}
      </p>
      {snippet && <LyricsSnippet snippet={snippet} className="mt-1.5" />}
    </motion.article>
  );
}
