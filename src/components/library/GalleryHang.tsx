"use client";

import { Link } from "@/i18n/navigation";
import type { LibraryImageryItem, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { memo, useMemo } from "react";

/** 滚到视口里才亮起（见 useReveal）：淡入并微微上浮。只管这一层，悬停效果写在里层，免得被错开的延迟拖慢 */
const REVEAL_CLASS =
  "opacity-0 translate-y-5 transition-[opacity,translate] duration-1000 ease-page data-shown:opacity-100 data-shown:translate-y-0 motion-reduce:opacity-100 motion-reduce:translate-y-0";

/** 主作下方列出几个意象 */
const FEATURE_MARKS = 3;

interface GalleryHangProps {
  /** 全部曲目，已按日期从新到旧排好 */
  songs: Song[];
  yearSignatures: Map<number, number[]>;
  /** 年份 → 主作 */
  featured: Map<number, number>;
  imageryById: Map<number, LibraryImageryItem>;
  bySong: Map<number, Set<number>>;
  activeSongId: number | null;
  /** 鼠标停在某幅上：整页换成它的颜色 */
  onPreview: (song: Song | null, img: HTMLImageElement | null) => void;
  onNavigate: (songId: number) => void;
}

/**
 * 近赏：按展厅的挂法排。每一年是一间展室，左边一块大字展签（年份、首数、这一年的意象），
 * 右边作品成排挂开，画与画之间留出空墙；每年挑一幅主作挂大一号，说明牌贴在画下。
 */
export default function GalleryHang({
  songs,
  yearSignatures,
  featured,
  imageryById,
  bySong,
  activeSongId,
  onPreview,
  onNavigate,
}: GalleryHangProps) {
  const t = useTranslations("library.hall");
  const tCommon = useTranslations("common");

  const rooms = useMemo(() => {
    const result: Array<{ key: string; year: number | null; songs: Song[] }> =
      [];
    for (const song of songs) {
      const year = song.year ?? null;
      const last = result[result.length - 1];
      if (last && last.year === year) last.songs.push(song);
      else
        result.push({ key: `room-${year ?? "unknown"}`, year, songs: [song] });
    }
    return result;
  }, [songs]);

  return (
    <div
      className="space-y-28 md:space-y-40"
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") onPreview(null, null);
      }}
    >
      {rooms.map((room) => {
        const signature =
          room.year !== null ? (yearSignatures.get(room.year) ?? []) : [];
        const featuredId =
          room.year !== null ? featured.get(room.year) : undefined;
        return (
          <section
            key={room.key}
            className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-16"
          >
            {/* 展签：宽屏停在左侧，读完这一间才被推走 */}
            <header
              data-reveal
              className={cn(
                REVEAL_CLASS,
                "mb-10 flex items-end gap-6 lg:mb-0 lg:block lg:sticky lg:top-[calc(var(--nav-h)+6.5rem)] lg:self-start",
              )}
            >
              <h3 className="font-serif text-5xl lg:text-6xl font-semibold leading-none tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
                {room.year ?? tCommon("unknown")}
              </h3>
              <div className="lg:mt-5">
                <p className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  {t("works", { count: room.songs.length })}
                </p>
                {signature.length > 0 && (
                  <p className="mt-2 lg:mt-6 flex gap-x-3 lg:flex-col lg:gap-y-2 font-calligraphy text-xl lg:text-2xl leading-none text-(--tone) transition-colors duration-1000">
                    {signature.map((id) => (
                      <span key={id}>{imageryById.get(id)?.name}</span>
                    ))}
                  </p>
                )}
              </div>
            </header>

            <ul className="grid grid-flow-dense grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 md:gap-x-9 gap-y-12 md:gap-y-16">
              {room.songs.map((song) => {
                const isFeatured = song.id === featuredId;
                const marks = isFeatured
                  ? [...(bySong.get(song.id) ?? [])]
                      .map((id) => imageryById.get(id))
                      .filter((i): i is LibraryImageryItem => !!i)
                      .sort((a, b) => a.songCount - b.songCount || a.id - b.id)
                      .slice(0, FEATURE_MARKS)
                  : [];
                return (
                  <HallWork
                    key={song.id}
                    song={song}
                    featured={isFeatured}
                    marks={marks}
                    active={activeSongId === song.id}
                    onPreview={onPreview}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const HallWork = memo(function HallWork({
  song,
  featured,
  marks,
  active,
  onPreview,
  onNavigate,
}: {
  song: Song;
  featured: boolean;
  marks: LibraryImageryItem[];
  active: boolean;
  onPreview: GalleryHangProps["onPreview"];
  onNavigate: GalleryHangProps["onNavigate"];
}) {
  const tEnum = useTranslations("enums");
  const hasCover = song.hascover === true;
  const type = song.type?.[0];
  const meta = [
    song.artist?.join(" / "),
    type && (tEnum.has(`type.${type}`) ? tEnum(`type.${type}`) : type),
  ].filter(Boolean);

  return (
    <li className={cn(featured && "col-span-2 row-span-2")}>
      <div data-reveal className={REVEAL_CLASS}>
        <Link
          href={`/song/${song.id}`}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse")
              onPreview(song, e.currentTarget.querySelector("img"));
          }}
          onClick={() => {
            onNavigate(song.id);
            bumpNavDepth();
          }}
          className="group block outline-none"
        >
          {/* 画：平时收着一点色，走近（悬停）时灯打上去 */}
          <div
            data-flip={song.id}
            className={cn(
              "relative aspect-square overflow-hidden rounded-[3px] ring-1 ring-slate-900/5 dark:ring-white/10",
              "shadow-[0_24px_48px_-30px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_48px_-26px_rgba(0,0,0,0.9)]",
              "transition-shadow duration-1000 ease-page group-hover:shadow-[0_34px_60px_-30px_rgba(15,23,42,0.6)] group-focus-visible:ring-2 group-focus-visible:ring-(--tone)",
              hasCover
                ? "bg-slate-200 dark:bg-slate-800"
                : "bg-slate-100 dark:bg-slate-900",
            )}
          >
            {hasCover ? (
              <Image
                src={getCoverUrl(song)}
                alt={song.title}
                width={featured ? 480 : 240}
                height={featured ? 480 : 240}
                sizes={
                  featured
                    ? "(min-width: 1024px) 400px, 90vw"
                    : "(min-width: 1024px) 200px, 45vw"
                }
                className={cn(
                  "size-full object-cover transition-[filter,scale] duration-1000 ease-page",
                  active
                    ? "scale-[1.025]"
                    : "saturate-[.8] brightness-[.97] dark:brightness-[.82] group-hover:saturate-100 group-hover:brightness-100 group-hover:scale-[1.025]",
                )}
              />
            ) : (
              // 没有封面：一张素笺，题名竖排
              <span className="absolute inset-0 flex justify-center p-4">
                <span
                  className={cn(
                    "font-serif tracking-[0.25em] text-slate-600 dark:text-slate-300 [writing-mode:vertical-rl] transition-colors duration-700 group-hover:text-(--tone)",
                    featured ? "text-2xl" : "text-base",
                  )}
                >
                  {song.title}
                </span>
              </span>
            )}
          </div>

          {/* 说明牌：题名常在，署名走近才清楚 */}
          <div className={featured ? "mt-5" : "mt-3"}>
            <p
              className={cn(
                "truncate font-serif transition-colors duration-700",
                featured ? "text-lg" : "text-[13px] md:text-sm",
                active
                  ? "text-(--tone)"
                  : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-50",
              )}
            >
              {song.title}
            </p>
            {meta.length > 0 && (
              <p className="mt-1 truncate text-[11px] tracking-wider text-slate-400 dark:text-slate-500 opacity-0 -translate-y-0.5 transition-[opacity,translate] duration-700 ease-page group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100">
                {meta.join(" · ")}
              </p>
            )}
            {marks.length > 0 && (
              <p className="mt-3 flex gap-x-4 font-calligraphy text-xl leading-none text-slate-500 dark:text-slate-400">
                {marks.map((m) => (
                  <span key={m.id}>{m.name}</span>
                ))}
              </p>
            )}
          </div>
        </Link>
      </div>
    </li>
  );
});
