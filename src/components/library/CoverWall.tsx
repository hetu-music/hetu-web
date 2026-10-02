"use client";

import { Link } from "@/i18n/navigation";
import type { LibraryImageryItem, Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { memo, useMemo } from "react";

/** 墙上的格子：一张封面，或一年开头的年份字块 */
type Cell =
  | { kind: "song"; song: Song }
  | { kind: "year"; key: string; year: number | null; songIds: number[] };

interface CoverWallProps {
  /** 全部曲目，已按日期从新到旧排好；墙上的次序始终是编年，检索只改明暗 */
  songs: Song[];
  /** 开头的刊头，占一大块 */
  masthead: React.ReactNode;
  /** 亮着的作品；null 表示全亮 */
  lit: Set<number> | null;
  pinnedId: number | null;
  /** 年份 → 这一年的代表意象 */
  yearSignatures: Map<number, number[]>;
  imageryById: Map<number, LibraryImageryItem>;
  /** 鼠标停在某张封面上（触屏不触发） */
  onPreview: (song: Song | null, img: HTMLImageElement | null) => void;
  /** 点选一张封面：第一下选中，再点同一张才进入歌曲页 */
  onPin: (song: Song, img: HTMLImageElement | null) => void;
  onUnpin: () => void;
  /** 进入歌曲页之前（记下滚动位置） */
  onNavigate: (songId: number) => void;
}

/**
 * 千面墙：全部封面密排成一面墙，从新到旧；每一年开头嵌一块年份字。
 * 检索与点选都不增删格子，只让一部分亮着、其余压暗，全貌始终都在。
 */
export default function CoverWall({
  songs,
  masthead,
  lit,
  pinnedId,
  yearSignatures,
  imageryById,
  onPreview,
  onPin,
  onUnpin,
  onNavigate,
}: CoverWallProps) {
  const cells = useMemo(() => {
    const result: Cell[] = [];
    let current: Extract<Cell, { kind: "year" }> | null = null;
    for (const song of songs) {
      const year = song.year ?? null;
      if (!current || current.year !== year) {
        current = {
          kind: "year",
          key: `year-${year ?? "unknown"}`,
          year,
          songIds: [],
        };
        result.push(current);
      }
      current.songIds.push(song.id);
      result.push({ kind: "song", song });
    }
    return result;
  }, [songs]);

  return (
    <div
      // 点在格子之间的空隙上，算作放下当前选中的那首
      onClick={(e) => {
        if (e.target === e.currentTarget) onUnpin();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") onPreview(null, null);
      }}
      className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-0.75"
    >
      <div className="col-span-full lg:col-[span_6] lg:row-span-3 flex px-1 pt-4 pb-8 lg:p-0 lg:pr-8 lg:pb-2">
        {masthead}
      </div>

      {cells.map((cell) =>
        cell.kind === "year" ? (
          <YearCell
            key={cell.key}
            year={cell.year}
            signature={
              cell.year !== null ? (yearSignatures.get(cell.year) ?? []) : []
            }
            imageryById={imageryById}
            dim={lit !== null && !cell.songIds.some((id) => lit.has(id))}
          />
        ) : (
          <SongCell
            key={cell.song.id}
            song={cell.song}
            dim={lit !== null && !lit.has(cell.song.id)}
            pinned={pinnedId === cell.song.id}
            onPreview={onPreview}
            onPin={onPin}
            onNavigate={onNavigate}
          />
        ),
      )}
    </div>
  );
}

/** 年份字块：大一点的年份数字，下面是这一年的代表意象 */
function YearCell({
  year,
  signature,
  imageryById,
  dim,
}: {
  year: number | null;
  signature: number[];
  imageryById: Map<number, LibraryImageryItem>;
  dim: boolean;
}) {
  const tCommon = useTranslations("common");
  return (
    <div
      className={cn(
        "flex aspect-square flex-col justify-between p-1.5 md:p-2 transition-opacity duration-500 ease-page",
        dim && "opacity-25",
      )}
    >
      <h3 className="font-serif text-base md:text-lg leading-none tabular-nums tracking-wide text-(--tone) transition-colors duration-1000">
        {year ?? tCommon("unknown")}
      </h3>
      {signature.length > 0 && (
        <p className="flex flex-col items-end gap-0.5 font-calligraphy text-sm md:text-base leading-tight text-slate-500 dark:text-slate-400">
          {signature.map((id) => (
            <span key={id}>{imageryById.get(id)?.name}</span>
          ))}
        </p>
      )}
    </div>
  );
}

const SongCell = memo(function SongCell({
  song,
  dim,
  pinned,
  onPreview,
  onPin,
  onNavigate,
}: {
  song: Song;
  dim: boolean;
  pinned: boolean;
  onPreview: CoverWallProps["onPreview"];
  onPin: CoverWallProps["onPin"];
  onNavigate: CoverWallProps["onNavigate"];
}) {
  const imgOf = (el: HTMLElement) => el.querySelector("img");
  // 没有封面的作品不放占位图（同一张图满墙重复），改写成一块字：题名竖排
  const hasCover = song.hascover === true;

  return (
    <Link
      href={`/song/${song.id}`}
      title={song.title}
      aria-current={pinned ? "true" : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") onPreview(song, imgOf(e.currentTarget));
      }}
      onClick={(e) => {
        // 新窗口打开等照浏览器原样处理
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!pinned) {
          e.preventDefault();
          onPin(song, imgOf(e.currentTarget));
          return;
        }
        onNavigate(song.id);
        bumpNavDepth();
      }}
      className={cn(
        "group relative block aspect-square overflow-hidden outline-none",
        hasCover
          ? "bg-slate-200 dark:bg-slate-800"
          : "bg-slate-100 dark:bg-slate-900",
        "transition-[opacity,filter] duration-500 ease-page",
        dim && "opacity-[0.14] grayscale hover:opacity-50",
        // 选中的那张：内描一圈强调色
        "after:pointer-events-none after:absolute after:inset-0 after:ring-inset after:transition-shadow",
        pinned
          ? "after:ring-2 after:ring-(--tone)"
          : "focus-visible:after:ring-2 focus-visible:after:ring-(--tone)",
      )}
    >
      {hasCover ? (
        <Image
          src={getCoverUrl(song)}
          alt={song.title}
          width={176}
          height={176}
          sizes="(min-width: 768px) 96px, 80px"
          className={cn(
            "size-full object-cover transition-transform duration-700 ease-page",
            pinned ? "scale-[1.06]" : "group-hover:scale-[1.06]",
          )}
        />
      ) : (
        <span className="absolute inset-0 flex justify-center overflow-hidden p-2">
          <span className="font-serif text-[13px] md:text-sm leading-tight tracking-[0.15em] text-slate-600 dark:text-slate-300 [writing-mode:vertical-rl] line-clamp-2 group-hover:text-(--tone) transition-colors">
            {song.title}
          </span>
        </span>
      )}
    </Link>
  );
});
