"use client";

import SectionHeading from "@/components/detail/SectionHeading";
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
import React from "react";
import { songCreditLine } from "./shared";

interface CatalogSectionProps {
  pageSongs: Song[];
  totalCount: number;
  types: string[];
  activeType: string;
  onTypeChange: (type: string) => void;
  searchInput: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  getLyricsSnippet: (songId: number) => Snippet | undefined;
  approximate: boolean;
  lyricsPending: boolean;
  showHeading: boolean;
}

/**
 * 曲目总录（单一形态，彻底取消双视图切换）：
 * - 完整保留类型标签、全文与歌词搜索、年份滑轨与 5 维高级筛选；
 * - 宽屏点击「筛选」在工具栏下平滑展开，窄屏弹出 Base UI 底部抽屉；
 * - 曲库网格：移动端 2 列紧凑唱片墙，平板 3 列，宽屏 4 列。
 */
export default function CatalogSection({
  pageSongs,
  totalCount,
  types,
  activeType,
  onTypeChange,
  searchInput,
  searchInputRef,
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
  getLyricsSnippet,
  approximate,
  lyricsPending,
  showHeading,
}: CatalogSectionProps) {
  const tLib = useTranslations("library");
  const tCommon = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tSong = useTranslations("song");
  const isDesktop = useIsDesktop();
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const { currentTrack, isPlaying } = usePlayerStore();
  const { containerRef, hasDraggedRef, dragHandlers } =
    useMouseDragScroll<HTMLDivElement>();

  return (
    <section>
      <div ref={listStartRef} aria-hidden className="scroll-mt-(--nav-h)" />

      {showHeading && (
        <SectionHeading label="曲目总录">
          <span className="font-mono text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
            凡 {totalCount} 曲
          </span>
        </SectionHeading>
      )}

      {/* ── 吸顶检目栏（完整检索 + 筛选入口，无视图切换按钮） ── */}
      <div
        className={cn(
          "sticky top-(--nav-h) z-30 -mx-6 mb-8 bg-[#FAFAFA]/95 px-6 pt-2 backdrop-blur-md md:mb-10 dark:bg-[#0B0F19]/95",
          showHeading && "mt-5 md:mt-7",
        )}
      >
        <div
          className={cn(
            TAB_HAIRLINE_CLASS,
            "flex flex-col-reverse md:h-12 md:flex-row md:gap-8",
          )}
        >
          {/* 类型标签行 */}
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
                    active
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
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

          {/* 搜索框 + 高级筛选触发器 */}
          <div
            className={cn(
              TAB_HAIRLINE_CLASS,
              "flex h-11 items-center gap-1 md:ml-auto md:h-full md:before:hidden",
            )}
          >
            <label className="group relative flex h-full min-w-0 flex-1 items-center gap-2 md:w-64 md:flex-none">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={tLib("search.placeholder")}
                value={searchInput}
                onFocus={onSearchFocus}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="清空搜索"
                  className="shrink-0 p-1 text-slate-300 transition-colors hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
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
                "relative inline-flex shrink-0 items-center gap-1.5",
                (advanced || activeAdvancedCount > 0) &&
                  "text-(--tone) dark:text-(--tone)",
              )}
            >
              {advanced && isDesktop ? (
                <X size={18} />
              ) : (
                <SlidersHorizontal size={17} />
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

        {/* 桌面端：平滑内联展开完整 SongFilters */}
        {advanced && isDesktop && (
          <div className="animate-in slide-in-from-top-2 fade-in border-b border-slate-200/70 pb-6 pt-5 duration-300 dark:border-slate-800">
            {filterPanel}
          </div>
        )}
      </div>

      {/* 移动端：Base UI 底部抽屉承载完整 SongFilters */}
      {!isDesktop && (
        <Drawer open={advanced} onOpenChange={onAdvancedChange}>
          <DrawerContent title={tLib("advancedFilter")}>
            <div className="pt-2">{filterPanel}</div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-200/75 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={onReset}
                disabled={!isAnyFilterActive}
                className="text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-40 dark:text-slate-500 dark:hover:text-slate-200"
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

      {/* ── 单一形态曲库：手机 2 列唱片墙 · 平板 3 列 · 桌面 4 列 ── */}
      <div className="min-h-[45vh]">
        {approximate && (
          <p className="mb-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
            {tLib("search.approximate")}
          </p>
        )}

        {pageSongs.length === 0 ? (
          <p className="py-20 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
            {lyricsPending
              ? tLib("search.lyricsPending")
              : tLib("noFilteredSongs")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
            {pageSongs.map((song, index) => {
              const fav = isFavorite(song.id);
              const playing = currentTrack?.songId === song.id && isPlaying;
              const snippet = getLyricsSnippet(song.id);

              return (
                <article
                  key={song.id}
                  onClick={() => onOpenSong(song.id)}
                  className="group flex cursor-pointer flex-col"
                >
                  <div
                    className={cn(
                      "relative aspect-square w-full overflow-hidden rounded-md bg-slate-100 ring-1 transition-all duration-500 dark:bg-slate-800",
                      playing
                        ? "ring-2 ring-(--tone) shadow-[0_18px_36px_-14px_rgba(15,23,42,0.34)]"
                        : "ring-slate-900/[0.06] shadow-[0_12px_26px_-14px_rgba(15,23,42,0.22)] group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_46px_-18px_rgba(15,23,42,0.36)] dark:ring-white/10 dark:shadow-black/50",
                    )}
                  >
                    <CoverArt
                      song={song}
                      sizes="(min-width: 1280px) 284px, (min-width: 1024px) 31vw, 46vw"
                      priority={index < 4 ? "eager" : undefined}
                    />

                    {/* 宽屏悬停底部微暗渐变 + 播放/队列/收藏；手机端保持画面干净 */}
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
                          className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-white"
                          size={13}
                        />
                        <EnqueueButton
                          songId={song.id}
                          title={song.title}
                          artist={song.artist?.join(" / ")}
                          coverUrl={getCoverUrl(song)}
                          hasAudio={song.has_audio}
                          className="rounded-full bg-white/90 p-1.5 text-slate-900 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-white"
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
                                : "text-slate-600 hover:text-rose-500 dark:text-slate-300",
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

                    {/* 移动端若已收藏或正在播放，仅在右下角给极克制的微标记 */}
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

                  {/* 唱片下方排版：在手机 2 列与桌面 4 列下都利落克制 */}
                  <div className="mt-2.5 space-y-0.5 sm:mt-3.5 sm:space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3
                        className={cn(
                          "line-clamp-1 min-w-0 flex-1 font-serif text-[15px] leading-snug text-slate-900 transition-colors sm:text-[18px] dark:text-slate-100",
                          playing
                            ? "text-(--tone)"
                            : "group-hover:text-(--tone)",
                        )}
                        title={song.title}
                      >
                        {song.title}
                      </h3>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400 sm:text-[11px] dark:text-slate-500">
                        {song.year || FILTER_OPTION_UNKNOWN}
                      </span>
                    </div>

                    <p className="flex items-center gap-1.5 overflow-hidden text-xs text-slate-500 sm:text-[13px] dark:text-slate-400">
                      <span className="truncate font-kaiti">
                        {songCreditLine(song)}
                      </span>
                      {song.type?.[0] && (
                        <>
                          <span className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300 sm:inline-block dark:bg-slate-600" />
                          <span className="hidden shrink-0 text-[11px] tracking-wider text-slate-400 sm:inline dark:text-slate-500">
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
          <p className="mt-10 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
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
