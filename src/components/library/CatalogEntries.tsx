"use client";

import SongPlayActions from "@/components/shared/SongPlayActions";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { useFavorites } from "@/context/FavoritesContext";
import { useUserContext } from "@/context/UserContext";
import type { LyricsSnippetParts } from "@/hooks/library/useLyricsIndex";
import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { bumpNavDepth } from "@/lib/utils/utils-nav";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

interface EntriesProps {
  songs: Song[];
  /** 刚点下、正在跳转的那一首 */
  activeSongId: number | null;
  onNavigate: (songId: number) => void;
  /** 搜索命中歌词时的片段；没命中歌词的返回 null */
  getSnippet: (songId: number) => LyricsSnippetParts | null;
}

// ── 共用的小件 ──────────────────────────────────────────────────────────────

/** 署名一行：词曲同一人时合写 */
export function useCreditLine() {
  const t = useTranslations("library.catalog");
  return (song: Song) => {
    const lyricist = song.lyricist?.join(" / ");
    const composer = song.composer?.join(" / ");
    if (lyricist && lyricist === composer) {
      return `${t("lyricsAndMusic")} ${lyricist}`;
    }
    const parts = [
      lyricist && `${t("lyricist")} ${lyricist}`,
      composer && `${t("composer")} ${composer}`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : song.artist?.join(" / ");
  };
}

/** 存疑与已收藏：一两个带语义色的小字，不做徽章 */
function EntryMarks({ song }: { song: Song }) {
  const t = useTranslations("song.labels");
  const tCatalog = useTranslations("library.catalog");
  const { isFavorite } = useFavorites();
  return (
    <>
      {song.dispute_note && (
        <span
          title={t("disputedHint")}
          className="shrink-0 text-xs tracking-wider text-amber-600 dark:text-amber-500"
        >
          {t("disputed")}
        </span>
      )}
      {isFavorite(song.id) && (
        <span className="shrink-0 text-xs tracking-wider text-rose-500 dark:text-rose-400">
          {tCatalog("favorited")}
        </span>
      )}
    </>
  );
}

/** 搜索命中的歌词：一行楷体，命中处用强调色 */
function Snippet({
  parts,
  className,
}: {
  parts: LyricsSnippetParts;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-kaiti text-sm leading-relaxed text-slate-500 dark:text-slate-400 truncate",
        className,
      )}
    >
      {parts.before}
      <span className="text-(--tone)">{parts.match}</span>
      {parts.after}……
    </p>
  );
}

/** 悬停才出现的文字操作：播放、加入队列、收藏。只在宽屏有，窄屏到歌曲页再听 */
function EntryActions({
  song,
  groupClass,
  className,
}: {
  song: Song;
  /** 悬停时显出的触发类，按所在的 group 名给 */
  groupClass: string;
  className?: string;
}) {
  const t = useTranslations("song.actions");
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { user, loaded } = useUserContext();
  const favorited = isFavorite(song.id);

  // 什么都不能做时不占位置，署名才能贴齐右缘
  const canPlay = loaded && !!user?.hasBenefits && !!song.has_audio;
  if (!canPlay && !isLoggedIn) return null;

  return (
    <div
      className={cn(
        "hidden lg:flex items-center gap-4 opacity-0 focus-within:opacity-100 transition-opacity duration-300",
        groupClass,
        className,
      )}
    >
      <SongPlayActions song={song} />
      {isLoggedIn && (
        <button
          type="button"
          onClick={() => toggleFavorite(song.id)}
          aria-pressed={favorited}
          className={cn(
            TEXT_BUTTON_CLASS,
            "hover:text-rose-500 dark:hover:text-rose-400",
          )}
        >
          {favorited ? t("unfavorite") : t("favorite")}
        </button>
      )}
    </div>
  );
}

// ── 目录 ────────────────────────────────────────────────────────────────────

/**
 * 目录：按年份编排，一首一行——题名、点线、署名，像书前的目录。
 * 搜索时按相关度排，不再分年，年份改写在署名后面。
 */
export function CatalogList({
  songs,
  grouped,
  activeSongId,
  onNavigate,
  getSnippet,
}: EntriesProps & { grouped: boolean }) {
  const tCommon = useTranslations("common");

  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", label: null, songs }];
    // 曲目已按日期从新到旧排好，顺次归组即可；无年份的排在最后
    const map = new Map<string, Song[]>();
    for (const song of songs) {
      const key = song.year ? String(song.year) : "unknown";
      const list = map.get(key);
      if (list) list.push(song);
      else map.set(key, [song]);
    }
    return Array.from(map, ([key, list]) => ({
      key,
      label: key === "unknown" ? tCommon("unknown") : key,
      songs: list,
    }));
  }, [songs, grouped, tCommon]);

  return (
    <div className="space-y-14">
      {groups.map((group) => (
        <section
          key={group.key}
          className={cn(
            group.label !== null &&
              "md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-x-6",
          )}
        >
          {group.label !== null && (
            // 宽屏年份停在左侧，读到这一年的末尾才被推走，像书页的书眉
            <h3 className="mb-5 md:mb-0 md:pt-1 font-serif text-sm tracking-[0.2em] tabular-nums text-(--tone) lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:self-start">
              {group.label}
            </h3>
          )}
          <ol className="space-y-4">
            {group.songs.map((song) => (
              <CatalogRow
                key={song.id}
                song={song}
                showYear={!grouped}
                active={activeSongId === song.id}
                onNavigate={onNavigate}
                snippet={getSnippet(song.id)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function CatalogRow({
  song,
  showYear,
  active,
  onNavigate,
  snippet,
}: {
  song: Song;
  showYear: boolean;
  active: boolean;
  onNavigate: (songId: number) => void;
  snippet: LyricsSnippetParts | null;
}) {
  const creditLine = useCreditLine();
  const credit = [creditLine(song), showYear && song.year]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group/entry">
      <div className="flex items-baseline gap-6">
        <Link
          href={`/song/${song.id}`}
          onClick={() => {
            onNavigate(song.id);
            bumpNavDepth();
          }}
          className="group min-w-0 flex-1 md:flex md:items-baseline md:gap-4"
        >
          <span className="flex min-w-0 items-baseline gap-3">
            <span
              className={cn(
                "truncate font-serif text-[17px] text-slate-900 dark:text-slate-100 transition-colors",
                active ? "text-(--tone)" : "group-hover:text-(--tone)",
              )}
            >
              {song.title}
            </span>
            <EntryMarks song={song} />
          </span>
          {/* 点线：把题名和署名连成一行，宽屏才有 */}
          <span
            aria-hidden
            className="hidden md:block min-w-8 flex-1 self-end mb-[0.4em] border-b border-dotted border-slate-300 dark:border-slate-700"
          />
          {credit && (
            <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500 md:mt-0 md:max-w-[50%] md:shrink-0">
              {credit}
            </span>
          )}
        </Link>
        <EntryActions
          song={song}
          groupClass="group-hover/entry:opacity-100"
          className="shrink-0"
        />
      </div>
      {snippet && <Snippet parts={snippet} className="mt-1" />}
    </li>
  );
}
