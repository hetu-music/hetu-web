"use client";

import CoverArt from "@/components/library/CoverArt";
import LyricsSnippet from "@/components/library/LyricsSnippet";
import EnqueueButton from "@/components/shared/EnqueueButton";
import Pagination from "@/components/shared/Pagination";
import PlayButton from "@/components/shared/PlayButton";
import PlayingBars from "@/components/shared/PlayingBars";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { TAB_HAIRLINE_CLASS } from "@/components/shared/tab-hairline";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useFavorites } from "@/context/FavoritesContext";
import type { LyricsSearchState } from "@/hooks/library/useLyricsLines";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { useMouseDragScroll } from "@/hooks/ui/useMouseDragScroll";
import { FILTER_OPTION_ALL, FILTER_OPTION_UNKNOWN } from "@/lib/constants";
import type { Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { formatTime } from "@/lib/utils/utils-common";
import { enumLabel, getCoverUrl } from "@/lib/utils/utils-song";
import { usePlayerStore } from "@/store/player-store";
import {
  Heart,
  Mic2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";
import { FeaturePlate, PoetryPlate } from "./GalleryPlates";
import { FEATURE_PLATES, type FeaturedEntry, songCreditLine } from "./shared";

interface CatalogGalleryProps {
  pageSongs: Song[];
  totalCount: number;
  types: string[];
  activeType: string;
  onTypeChange: (type: string) => void;
  searchInput: string;
  onSearchChange: (q: string) => void;
  onSearchFocus: () => void;
  lyricsState: LyricsSearchState;
  isAnyFilterActive: boolean;
  activeAdvancedCount: number;
  onReset: () => void;
  advanced: boolean;
  onAdvancedChange: (open: boolean) => void;
  filterPanel: React.ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  listStartRef: React.RefObject<HTMLDivElement | null>;
  onOpenSong: (songId: number) => void;
  onHoverSong: (song: Song | null, imgEl?: HTMLImageElement | null) => void;
  getLyricsSnippet: (songId: number) => Snippet | undefined;
  approximate: boolean;
  lyricsPending: boolean;
  /** 未筛选的第 1 页，在曲库矩阵中自然织入留白诗格与三枚特辑彩插页 */
  showEditorialPlates: boolean;
  poetryEntry: FeaturedEntry | null;
  onCyclePoetry: () => void;
  canCyclePoetry: boolean;
}

type GridSlot =
  | { kind: "song"; song: Song; songIdx: number }
  | { kind: "poetry" }
  | { kind: "feature"; featureIdx: number };

/**
 * 在未筛选第 1 页的唱片流中，按呼吸节奏自然织入 1 枚留白诗格 + 3 枚特辑插页：
 * 位置选在「第 3 首后（诗格）、第 6 首后（倾尽天下）、第 11 首后（意象词云）、第 16 首后（寻曲）」，
 * 无论桌面 4 列还是手机 2 列，插页都不会紧挨在一起，始终像精装艺术画册的彩插页。
 */
function interleaveEditorialSlots(
  songs: Song[],
  includePlates: boolean,
  hasPoetry: boolean,
): GridSlot[] {
  if (!includePlates || songs.length === 0) {
    return songs.map((song, songIdx) => ({ kind: "song", song, songIdx }));
  }

  const out: GridSlot[] = [];
  songs.forEach((song, songIdx) => {
    out.push({ kind: "song", song, songIdx });
    if (songIdx === 2 && hasPoetry) {
      out.push({ kind: "poetry" });
    } else if (songIdx === 5) {
      out.push({ kind: "feature", featureIdx: 0 });
    } else if (songIdx === 10) {
      out.push({ kind: "feature", featureIdx: 1 });
    } else if (songIdx === 15) {
      out.push({ kind: "feature", featureIdx: 2 });
    }
  });

  // 曲库极少时兜底附在末尾，确保特辑不会消失
  if (songs.length <= 5) {
    if (hasPoetry && !out.some((s) => s.kind === "poetry")) {
      out.push({ kind: "poetry" });
    }
    FEATURE_PLATES.forEach((_, featureIdx) => {
      if (
        !out.some((s) => s.kind === "feature" && s.featureIdx === featureIdx)
      ) {
        out.push({ kind: "feature", featureIdx });
      }
    });
  }

  return out;
}

/**
 * 联动画册曲库：
 * - 极轻吸顶检目线（完整类型标签 + 歌词/全文搜索 + 高级筛选；宽屏展开，手机走底部抽屉）；
 * - 单一形态唱片墙（手机 2 列、平板 3 列、宽屏 4 列），自然织入留白诗格与三枚特辑彩插页；
 * - 悬停任意封面时通知上层，实时点亮光阴声谱对应年份并晕染整页光色。
 */
export default function CatalogGallery({
  pageSongs,
  totalCount,
  types,
  activeType,
  onTypeChange,
  searchInput,
  onSearchChange,
  onSearchFocus,
  lyricsState,
  isAnyFilterActive,
  activeAdvancedCount,
  onReset,
  advanced,
  onAdvancedChange,
  filterPanel,
  page,
  totalPages,
  onPageChange,
  listStartRef,
  onOpenSong,
  onHoverSong,
  getLyricsSnippet,
  approximate,
  lyricsPending,
  showEditorialPlates,
  poetryEntry,
  onCyclePoetry,
  canCyclePoetry,
}: CatalogGalleryProps) {
  const tLib = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tSong = useTranslations("song");
  const isDesktop = useIsDesktop();
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { currentTrack, isPlaying } = usePlayerStore();
  const { containerRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

  const slots = useMemo(
    () =>
      interleaveEditorialSlots(
        pageSongs,
        showEditorialPlates,
        poetryEntry !== null,
      ),
    [pageSongs, showEditorialPlates, poetryEntry],
  );

  return (
    <section>
      <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

      {/* ── 吸顶检目线（工具退隐为极轻细线，全功能完整保留） ── */}
      <div className="sticky top-(--nav-h) z-30 -mx-6 mb-9 bg-[#FAFAFA]/94 px-6 pt-1 backdrop-blur-md md:mb-11 dark:bg-[#0B0F19]/94">
        <div
          className={cn(
            TAB_HAIRLINE_CLASS,
            "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
          )}
        >
          {/* 类型标签 */}
          <div
            ref={containerRef}
            {...dragHandlers}
            className="no-scrollbar flex h-11 min-w-0 cursor-grab gap-6 overflow-x-auto mask-[linear-gradient(to_right,black_calc(100%-2rem),transparent)] after:w-2 after:shrink-0 active:cursor-grabbing md:h-full md:mask-none md:after:hidden"
          >
            {types.map((opt) => {
              if (opt === FILTER_OPTION_ALL && isAnyFilterActive) {
                return (
                  <button
                    key="reset"
                    type="button"
                    onClick={(event) => {
                      if (hasDraggedRef.current) {
                        event.preventDefault();
                        return;
                      }
                      onReset();
                    }}
                    className="relative flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap font-serif text-[15px] tracking-wider text-(--tone) transition-opacity hover:opacity-75"
                  >
                    <RotateCcw size={13} />
                    {tLib("reset")}
                  </button>
                );
              }

              const active = activeType === opt;
              const label =
                opt === FILTER_OPTION_ALL
                  ? tCommon("all")
                  : opt === FILTER_OPTION_UNKNOWN
                    ? tCommon("unknown")
                    : enumLabel(tEnum, "type", opt);

              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    onTypeChange(opt);
                  }}
                  className={cn(
                    "relative flex h-full shrink-0 items-center whitespace-nowrap font-serif text-[15px] tracking-wider transition-colors select-none",
                    active ? "text-ink" : "text-ink-muted hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {/* 检索与多维筛选 */}
          <div
            className={cn(
              TAB_HAIRLINE_CLASS,
              "flex h-11 items-center gap-1 md:ml-auto md:h-full md:before:hidden",
            )}
          >
            <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-64 md:flex-none">
              <Search size={15} className="shrink-0 text-ink-meta" />
              <input
                type="text"
                placeholder={tLib("search.placeholder")}
                value={searchInput}
                onFocus={onSearchFocus}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink-body outline-none placeholder:text-ink-meta"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="清空搜索"
                  className="shrink-0 p-1 text-ink-faint transition-colors hover:text-ink-muted"
                >
                  <XCircle size={14} />
                </button>
              ) : lyricsState === "loading" ? (
                <span className="block h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-300 border-t-(--tone) dark:border-slate-600" />
              ) : lyricsState === "ready" ? (
                <Mic2 size={13} className="shrink-0 text-(--tone) opacity-55" />
              ) : null}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
              />
            </label>

            <span
              aria-hidden
              className="mx-2 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-800"
            />

            <button
              type="button"
              onClick={() => onAdvancedChange(!advanced)}
              aria-pressed={advanced}
              title={tLib("advancedFilter")}
              className={cn(
                NAV_BUTTON_CLASS,
                "inline-flex shrink-0 items-center gap-1.5",
                (advanced || activeAdvancedCount > 0) &&
                  "text-(--tone) dark:text-(--tone)",
              )}
            >
              {advanced && isDesktop ? (
                <X size={17} />
              ) : (
                <SlidersHorizontal size={16} />
              )}
              <span className="text-xs tracking-widest">
                筛选
                {activeAdvancedCount > 0 && (
                  <span className="ml-1 font-mono tabular-nums">
                    ({activeAdvancedCount})
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* 宽屏：内联展开完整 SongFilters */}
        {advanced && isDesktop && (
          <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/70 pb-6 pt-5 duration-300 dark:border-slate-800">
            {filterPanel}
          </div>
        )}
      </div>

      {/* 手机端：Base UI 底部抽屉承载完整 SongFilters */}
      {!isDesktop && (
        <Drawer open={advanced} onOpenChange={onAdvancedChange}>
          <DrawerContent title={tLib("advancedFilter")}>
            <div className="pt-2">{filterPanel}</div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-200/75 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onReset}
                disabled={!isAnyFilterActive}
                className="text-xs tracking-widest text-ink-meta transition-colors hover:text-ink-prose disabled:opacity-40"
              >
                {tLib("filter.clearAll")}
              </button>
              <button
                type="button"
                onClick={() => onAdvancedChange(false)}
                className="rounded-full bg-(--tone) px-5 py-2 text-xs tracking-[0.2em] text-white dark:text-slate-950"
              >
                查看 {totalCount} 首
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* ── 画册唱片墙（手机 2 列 · 平板 3 列 · 桌面 4 列） ── */}
      <div className="min-h-[45vh]">
        {approximate && (
          <p className="mb-8 font-kaiti text-[15px] text-ink-meta">
            {tLib("search.approximate")}
          </p>
        )}

        {pageSongs.length === 0 ? (
          <p className="py-24 text-center font-kaiti text-[15px] text-ink-meta">
            {lyricsPending
              ? tLib("search.lyricsPending")
              : tLib("noFilteredSongs")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-11 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
            {slots.map((slot) => {
              if (slot.kind === "poetry" && poetryEntry) {
                return (
                  <PoetryPlate
                    key="editorial-poetry"
                    entry={poetryEntry}
                    onOpenSong={onOpenSong}
                    onCycle={onCyclePoetry}
                    canCycle={canCyclePoetry}
                  />
                );
              }

              if (slot.kind === "feature") {
                const feature = FEATURE_PLATES[slot.featureIdx];
                return (
                  <FeaturePlate
                    key={`editorial-feature-${feature.id}`}
                    item={feature}
                  />
                );
              }

              if (slot.kind !== "song") return null;
              const { song, songIdx } = slot;
              const fav = isFavorite(song.id);
              const playing = currentTrack?.songId === song.id && isPlaying;
              const snippet = getLyricsSnippet(song.id);

              return (
                <article
                  key={song.id}
                  onClick={() => onOpenSong(song.id)}
                  onMouseEnter={(e) => {
                    const img = e.currentTarget.querySelector("img");
                    onHoverSong(song, img);
                  }}
                  onMouseLeave={() => onHoverSong(null)}
                  className="group flex cursor-pointer flex-col"
                >
                  <div
                    className={cn(
                      "relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 ring-1 transition-all duration-500 dark:bg-slate-800",
                      playing
                        ? "ring-2 ring-(--tone) shadow-[0_18px_36px_-14px_rgba(15,23,42,0.34)]"
                        : "ring-slate-900/[0.06] shadow-[0_12px_26px_-14px_rgba(15,23,42,0.2)] group-hover:-translate-y-1.5 group-hover:shadow-[0_26px_48px_-18px_rgba(15,23,42,0.38)] dark:ring-white/10 dark:shadow-black/55",
                    )}
                  >
                    <CoverArt
                      song={song}
                      sizes="(min-width: 1280px) 284px, (min-width: 1024px) 31vw, 46vw"
                      priority={songIdx < 4 ? "eager" : undefined}
                    />

                    {/* 宽屏悬停底部微暗光影 + 时长/播放/队列/收藏 */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-20 bg-linear-to-t from-black/65 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:block" />

                    <div
                      className={cn(
                        "absolute inset-x-2.5 bottom-2.5 hidden items-center justify-between transition-opacity duration-300 lg:flex",
                        fav || playing
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-white/85 drop-shadow-xs">
                        {playing && <PlayingBars />}
                        {song.length ? formatTime(song.length) : ""}
                      </span>

                      <div className="flex items-center gap-1">
                        <PlayButton
                          songId={song.id}
                          title={song.title}
                          artist={song.artist?.join(" / ")}
                          coverUrl={getCoverUrl(song)}
                          hasAudio={song.has_audio}
                          className="rounded-full bg-white/90 p-1.5 text-ink shadow-sm hover:bg-white dark:bg-slate-900/90"
                          size={13}
                        />
                        <EnqueueButton
                          songId={song.id}
                          title={song.title}
                          artist={song.artist?.join(" / ")}
                          coverUrl={getCoverUrl(song)}
                          hasAudio={song.has_audio}
                          className="rounded-full bg-white/90 p-1.5 text-ink shadow-sm hover:bg-white dark:bg-slate-900/90"
                          size={13}
                        />
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
                              "rounded-full bg-white/90 p-1.5 shadow-sm transition-colors dark:bg-slate-900/90",
                              fav
                                ? "text-rose-500"
                                : "text-ink-prose hover:text-rose-500",
                            )}
                          >
                            <Heart
                              size={13}
                              className={fav ? "fill-current" : ""}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 移动端极克制播放/收藏微标记 */}
                    {(playing || fav) && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur-xs lg:hidden">
                        {playing && <PlayingBars />}
                        {fav && (
                          <Heart
                            size={11}
                            className="fill-rose-400 text-rose-400"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 封面下两行书卷排版：宽屏与手机 2 列皆清爽耐看 */}
                  <div className="mt-2.5 space-y-0.5 sm:mt-3.5 sm:space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          "line-clamp-1 min-w-0 flex-1 font-serif text-[15px] leading-snug text-ink transition-colors sm:text-[18px]",
                          playing
                            ? "text-(--tone)"
                            : "group-hover:text-(--tone)",
                        )}
                        title={song.title}
                      >
                        {song.title}
                      </h3>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-meta sm:text-[11px]">
                        {song.year || FILTER_OPTION_UNKNOWN}
                      </span>
                    </div>

                    <p className="flex items-center gap-1.5 overflow-hidden text-xs text-ink-muted sm:text-[13px]">
                      <span className="truncate font-kaiti">
                        {songCreditLine(song)}
                      </span>
                      {song.type?.[0] && (
                        <>
                          <span className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300 sm:inline-block dark:bg-slate-600" />
                          <span className="hidden shrink-0 text-[11px] tracking-wider text-ink-meta sm:inline">
                            {enumLabel(tEnum, "type", song.type[0])}
                          </span>
                        </>
                      )}
                    </p>

                    {snippet && (
                      <LyricsSnippet snippet={snippet} className="mt-1.5" />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {lyricsPending && pageSongs.length > 0 && (
          <p className="mt-10 font-kaiti text-[15px] text-ink-meta">
            {tLib("search.lyricsPending")}
          </p>
        )}

        <Pagination
          className="mt-14"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          scrollTarget={listStartRef}
        />
      </div>
    </section>
  );
}
