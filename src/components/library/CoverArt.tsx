"use client";

import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

interface CoverArtProps {
  song: Song;
  className?: string;
  isActive?: boolean;
}

export default function CoverArt({ song, className, isActive }: CoverArtProps) {
  const coverUrl = getCoverUrl(song);

  return (
    <div
      className={cn(
        "@container relative h-full w-full overflow-hidden bg-slate-100 ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10",
        className,
      )}
    >
      <Image
        src={coverUrl}
        alt={song.title}
        width={400}
        height={400}
        className={cn(
          "h-full w-full object-cover transition-transform duration-500",
          isActive ? "scale-105" : "group-hover:scale-105",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 bg-black mix-blend-overlay transition-opacity",
          isActive ? "opacity-10" : "opacity-0 group-hover:opacity-10",
        )}
      />
      {song.dispute_note && <DisputedBand />}
    </div>
  );
}

/**
 * 资料存疑：压在封面底部的一条色带。
 * 按封面尺寸（容器查询）切换大小——网格大封面写全「资料存疑」，列表小缩略图只写「存疑」。
 */
function DisputedBand() {
  const t = useTranslations("song");

  return (
    <div
      title={t("labels.disputedHint")}
      className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-amber-500/95 py-0.5 text-[10px] font-semibold tracking-wider text-white @[10rem]:py-2 @[10rem]:text-sm dark:bg-amber-600/95"
    >
      <TriangleAlert
        className="hidden size-4 shrink-0 @[10rem]:block"
        aria-hidden
      />
      <span className="@[10rem]:hidden">{t("labels.disputed")}</span>
      <span className="hidden @[10rem]:inline">{t("folio.dispute")}</span>
    </div>
  );
}
