"use client";

import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { getCoverUrl } from "@/lib/utils/utils-song";
import Image from "next/image";
import type React from "react";

/**
 * 作品缩略：封面、题名，下面由调用方接几行小字。
 * 主页图录与歌曲页「同有此意」共用，站内只有这一种作品卡。
 */
export default function WorkCard({
  song,
  active = false,
  onNavigate,
  children,
}: {
  song: Pick<Song, "id" | "title" | "hascover">;
  /** 刚点下、正在跳转的那一张：保持悬停时的样子 */
  active?: boolean;
  /** 跳转前要做的事（如记下滚动位置）；导航深度这里已经处理 */
  onNavigate?: () => void;
  /** 题名下方的小字 */
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={`/song/${song.id}`}
      onClick={() => {
        onNavigate?.();
        bumpNavDepth();
      }}
      className="group block"
    >
      <div className="aspect-square overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10">
        <Image
          src={getCoverUrl(song)}
          alt={song.title}
          width={300}
          height={300}
          className={cn(
            "w-full h-full object-cover transition duration-700",
            active
              ? "grayscale-0 scale-[1.04]"
              : "grayscale-[35%] group-hover:grayscale-0 group-hover:scale-[1.04]",
          )}
        />
      </div>
      <p
        className={cn(
          "mt-4 font-serif text-base text-slate-900 dark:text-slate-100 truncate transition-colors",
          active ? "text-(--tone)" : "group-hover:text-(--tone)",
        )}
      >
        {song.title}
      </p>
      {children}
    </Link>
  );
}
