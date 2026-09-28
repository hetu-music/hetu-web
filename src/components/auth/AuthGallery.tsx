"use client";

import { GALLERY_QUOTES, type GallerySong } from "@/lib/auth-gallery";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

/** 每句摘句停留多久 */
const QUOTE_INTERVAL_MS = 7000;
/** 宽屏封面墙的列数与各列滚完一轮的秒数（错开，免得整面墙同步移动） */
const WALL_COLUMNS = 4;
const WALL_DURATIONS = [150, 120, 170, 135];
const EASE = [0.23, 1, 0.32, 1] as const;

/** 轮换的摘句取前几首；返回当前那一首的序号 */
export function useQuoteCycle(songs: GallerySong[]) {
  const count = Math.min(songs.length, GALLERY_QUOTES);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      QUOTE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [count]);
  return songs[index] ?? null;
}

/** 一张封面：平时褪色半透明，轮到它的摘句时恢复原色 */
function Cover({
  song,
  active,
  className,
}: {
  song: GallerySong;
  active: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 aspect-square overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10 transition duration-1000",
        active
          ? "opacity-100 grayscale-0"
          : "opacity-55 grayscale-[70%] dark:opacity-35",
        className,
      )}
    >
      <Image
        src={getCoverUrl({ id: song.id, hascover: true })}
        alt=""
        width={200}
        height={200}
        sizes="(min-width: 1024px) 12vw, 64px"
        className="size-full object-cover"
      />
    </div>
  );
}

/** 宽屏左半边：几列封面缓缓上下漂移，边缘渐隐到页面底色 */
export function CoverWall({
  songs,
  activeId,
}: {
  songs: GallerySong[];
  activeId: number | null;
}) {
  const columns = Array.from({ length: WALL_COLUMNS }, (_, c) =>
    songs.filter((_, i) => i % WALL_COLUMNS === c),
  );

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute -inset-y-24 inset-x-0 grid grid-cols-4 gap-4 px-6 xl:gap-5 xl:px-8">
        {columns.map((col, c) => (
          <div
            key={c}
            className="flex flex-col gap-4 xl:gap-5 motion-reduce:animate-none!"
            style={{
              animation: `${c % 2 === 0 ? "cover-drift-up" : "cover-drift-down"} ${WALL_DURATIONS[c]}s linear infinite`,
            }}
          >
            {/* 同一列排两遍，平移一半高度正好接上 */}
            {[...col, ...col].map((song, i) => (
              <Cover
                key={`${song.id}-${i}`}
                song={song}
                active={song.id === activeId}
              />
            ))}
          </div>
        ))}
      </div>
      {/* 上下与右侧渐隐：顶栏下不显得杂，摘句下有干净的底，右边接上表单那一侧 */}
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-[#FAFAFA] dark:from-[#0B0F19] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-[#FAFAFA] via-[#FAFAFA]/85 dark:from-[#0B0F19] dark:via-[#0B0F19]/85 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-[#FAFAFA] dark:from-[#0B0F19] to-transparent" />
    </div>
  );
}

/** 窄屏顶部：两行封面左右相向滚动 */
export function CoverStrip({
  songs,
  activeId,
}: {
  songs: GallerySong[];
  activeId: number | null;
}) {
  const rows = [
    songs.filter((_, i) => i % 2 === 0),
    songs.filter((_, i) => i % 2 === 1),
  ];

  return (
    <div
      aria-hidden
      className="space-y-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
    >
      {rows.map((row, r) => (
        <div
          key={r}
          className="flex w-max gap-3 motion-reduce:animate-none!"
          style={{
            animation: `${r === 0 ? "imagery-marquee-ltr" : "imagery-marquee-rtl"} ${r === 0 ? 90 : 110}s linear infinite`,
          }}
        >
          {[...row, ...row].map((song, i) => (
            <Cover
              key={`${song.id}-${i}`}
              song={song}
              active={song.id === activeId}
              className="size-16"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 当前一句歌词与出处；点歌名可去歌曲页 */
export function GalleryQuote({
  song,
  size,
}: {
  song: GallerySong | null;
  size: "lg" | "sm";
}) {
  return (
    <div
      className={cn(
        "relative",
        size === "lg" ? "min-h-[10rem]" : "min-h-[5.5rem]",
      )}
    >
      <AnimatePresence mode="wait">
        {song && (
          <motion.figure
            key={song.id}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <blockquote
              className={cn(
                "font-serif text-slate-800 dark:text-slate-100",
                size === "lg"
                  ? "text-3xl xl:text-4xl leading-[1.45] tracking-wide"
                  : "text-xl leading-normal tracking-wide",
              )}
            >
              {song.excerpt.split(" ").map((phrase, i) => (
                <span key={i} className="block">
                  {phrase}
                </span>
              ))}
            </blockquote>
            <figcaption
              className={cn(
                "flex items-center gap-3 text-(--tone)",
                size === "lg" ? "mt-6 text-sm" : "mt-3 text-xs",
              )}
            >
              <span aria-hidden className="w-6 h-px bg-(--tone)/60" />
              <Link
                href={`/song/${song.id}`}
                className="font-serif tracking-[0.2em] hover:opacity-75 transition-opacity"
              >
                《{song.title}》
              </Link>
            </figcaption>
          </motion.figure>
        )}
      </AnimatePresence>
    </div>
  );
}
