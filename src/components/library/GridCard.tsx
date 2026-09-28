"use client";

import { useFavorites } from "@/context/FavoritesContext";
import { FILTER_OPTION_UNKNOWN, getTypeTagStyle } from "@/lib/constants";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { Heart } from "lucide-react";
import type React from "react";
import CoverArt from "./CoverArt";
import EnqueueButton from "@/components/shared/EnqueueButton";
import PlayButton from "@/components/shared/PlayButton";
import { useTranslations } from "next-intl";

interface GridCardProps {
  song: Song;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
  isActive?: boolean;
  lyricsSnippet?: string;
}

export default function GridCard({
  song,
  onClick,
  style,
  className,
  isActive,
  lyricsSnippet,
}: GridCardProps) {
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const t = useTranslations("song");
  const tEnum = useTranslations("enums");
  const active = isFavorite(song.id);

  return (
    <div
      onClick={onClick}
      className={cn("group flex cursor-pointer flex-col gap-4", className)}
      style={style}
    >
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-sm ring-1 ring-slate-900/5 shadow-lg shadow-slate-200/50 transition-all duration-500 dark:ring-white/10 dark:shadow-black/40",
          isActive
            ? "-translate-y-2 shadow-2xl"
            : "group-hover:-translate-y-2 group-hover:shadow-2xl",
        )}
      >
        <CoverArt song={song} isActive={isActive} />

        <div
          className={cn(
            "absolute inset-0 bg-black/0 opacity-0 transition-colors",
            isActive
              ? "bg-black/10 opacity-100"
              : "group-hover:bg-black/10 group-hover:opacity-100",
          )}
        />

        {/* 右上角按钮组：播放 + 加队列 + 收藏 */}
        <div
          className={cn(
            "absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-200",
            active
              ? "opacity-100"
              : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
          )}
        >
          <PlayButton
            songId={song.id}
            title={song.title}
            artist={song.artist?.join(" / ")}
            coverUrl={getCoverUrl(song)}
            hasAudio={song.has_audio}
            className="rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1.5"
            size={14}
          />
          <EnqueueButton
            songId={song.id}
            title={song.title}
            artist={song.artist?.join(" / ")}
            coverUrl={getCoverUrl(song)}
            hasAudio={song.has_audio}
            className="rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-1.5"
            size={14}
          />
          {isLoggedIn && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(song.id);
              }}
              aria-label={
                active ? t("actions.unfavorite") : t("actions.favorite")
              }
              title={active ? t("actions.unfavorite") : t("actions.favorite")}
              className={cn(
                "rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-all duration-200 dark:bg-slate-900/80",
                active
                  ? "text-rose-500"
                  : "text-slate-500 hover:text-rose-500 hover:bg-rose-50/80 dark:hover:bg-rose-500/10 dark:text-slate-400",
              )}
            >
              <Heart size={14} className={active ? "fill-current" : ""} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <h3
            className={cn(
              "line-clamp-1 min-w-0 flex-1 text-xl leading-tight text-slate-900 transition-colors dark:text-slate-100",
              isActive
                ? "text-blue-600 dark:text-blue-400"
                : "group-hover:text-blue-600 dark:group-hover:text-blue-400",
            )}
            title={song.title}
          >
            {song.title}
          </h3>
          <span className="shrink-0 text-xs font-mono text-slate-400">
            {song.year || FILTER_OPTION_UNKNOWN}
          </span>
        </div>
        <p className="flex items-center gap-2 overflow-hidden text-sm font-light text-slate-500 dark:text-slate-400">
          <span className="truncate">{song.album || t("labels.single")}</span>
          {song.type?.[0] && (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span
                className={cn(
                  "shrink-0 text-sm font-light uppercase tracking-wider",
                  getTypeTagStyle(song.type[0]),
                )}
              >
                {tEnum.has(`type.${song.type[0]}`)
                  ? tEnum(`type.${song.type[0]}`)
                  : song.type[0]}
              </span>
            </>
          )}
        </p>
        {lyricsSnippet && (
          <div className="mt-1.5 border-l-2 border-slate-200 pl-2 dark:border-slate-700">
            <p className="truncate text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              {lyricsSnippet}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
