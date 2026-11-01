"use client";

import Pagination from "@/components/shared/Pagination";
import type { MusicLibraryViewMode } from "@/lib/constants";
import type { Snippet } from "@/lib/search/snippet";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import React from "react";
import GridCard from "./GridCard";
import ListRow from "./ListRow";

/**
 * 首屏封面不懒加载。网格首行最多 4 张（宽屏），第一张最可能是 LCP，另给高优先级；
 * 列表的缩略图只有 64px，首屏能看到的七八行都立即加载
 */
const gridCoverPriority = (index: number) =>
  index === 0 ? "high" : index < 4 ? "eager" : undefined;
const listCoverPriority = (index: number) => (index < 8 ? "eager" : undefined);

/** 卡片进场动画：每次结果变化都重播，是有意的设计（见 docs/LIBRARY.md 约束） */
const ENTER_CLASS =
  "animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-both";
const enterStyle = (index: number): React.CSSProperties => ({
  animationDelay: `${(index % 8) * 40}ms`,
  animationFillMode: "both",
});

/** 列表上下的一句提示：楷体灰字，同空状态（DESIGN.md「空状态与提示」） */
const NOTE_CLASS =
  "mb-8 font-kaiti text-[15px] text-slate-400 dark:text-slate-500";

interface SongResultsProps {
  /** 当前这一页的歌 */
  songs: Song[];
  /** 筛选结果一首都没有时显示空状态 */
  isEmpty: boolean;
  view: MusicLibraryViewMode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** 翻页后滚到这里 */
  scrollTarget: React.RefObject<HTMLDivElement | null>;
  /** 换页、从缓存恢复页面时换新，让整页卡片重播进场动画 */
  remountKey: string;
  activeSongId: number | null;
  onSongClick: (songId: number) => void;
  getLyricsSnippet: (songId: number) => Snippet | undefined;
  /** 结果全是歌词兜底（近似）命中：列表上方说一句 */
  approximate: boolean;
  /** 在搜，歌词还没搜上：列表末尾说一句，空状态也改说这个 */
  lyricsPending: boolean;
  /** 网格第一张封面加载完（或失败）时调用 */
  onFirstCoverSettled?: () => void;
  showFavoriteColumn: boolean;
  /** 从详情页返回、正在恢复滚动位置时先透明 */
  isRestoringScroll: boolean;
}

/**
 * 曲目列表：网格或列表，加分页和空状态。只认传进来的值，不读地址栏：
 * 阶段 4 服务端渲染第一页时直接用。
 */
export default function SongResults({
  songs,
  isEmpty,
  view,
  page,
  totalPages,
  onPageChange,
  scrollTarget,
  remountKey,
  activeSongId,
  onSongClick,
  getLyricsSnippet,
  approximate,
  lyricsPending,
  onFirstCoverSettled,
  showFavoriteColumn,
  isRestoringScroll,
}: SongResultsProps) {
  const t = useTranslations("library");

  return (
    <section
      className={cn(
        "min-h-[50vh] transition-opacity duration-200",
        isRestoringScroll ? "opacity-0 **:animate-none!" : "opacity-100",
      )}
    >
      {!isEmpty ? (
        <>
          {approximate && (
            <p className={NOTE_CLASS}>{t("search.approximate")}</p>
          )}
          {view === "grid" ? (
            <div
              key={`grid-${remountKey}`}
              className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {songs.map((song, index) => (
                <GridCard
                  key={song.id}
                  song={song}
                  coverPriority={gridCoverPriority(index)}
                  onCoverSettled={index === 0 ? onFirstCoverSettled : undefined}
                  isActive={activeSongId === song.id}
                  lyricsSnippet={getLyricsSnippet(song.id)}
                  onClick={() => onSongClick(song.id)}
                  className={ENTER_CLASS}
                  style={enterStyle(index)}
                />
              ))}
            </div>
          ) : (
            <div key={`list-${remountKey}`} className="flex flex-col gap-2">
              <div className="mb-2 hidden px-4 py-2 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500 md:flex">
                <div className="mr-6 w-16">{t("listHeader.cover")}</div>
                <div className="grow">{t("listHeader.title")}</div>
                <div className="ml-8 w-8" />
                <div className="ml-8 w-8" />
                {showFavoriteColumn && <div className="ml-8 w-8" />}
                <div className="ml-8 w-24 text-center">
                  {t("listHeader.type")}
                </div>
                <div className="ml-8 w-24 text-center">
                  {t("listHeader.genre")}
                </div>
                <div className="ml-8 w-16">{t("listHeader.year")}</div>
                <div className="ml-8 w-16">{t("listHeader.time")}</div>
              </div>
              {songs.map((song, index) => (
                <ListRow
                  key={song.id}
                  song={song}
                  coverPriority={listCoverPriority(index)}
                  isActive={activeSongId === song.id}
                  lyricsSnippet={getLyricsSnippet(song.id)}
                  onClick={() => onSongClick(song.id)}
                  className={ENTER_CLASS}
                  style={enterStyle(index)}
                />
              ))}
            </div>
          )}

          {/* 歌词到了以后，歌词命中的歌追加在全部结果后面；标在这一页末尾，第 1 页上也看得到 */}
          {lyricsPending && (
            <p className={cn(NOTE_CLASS, "mt-12 mb-0")}>
              {t("search.lyricsPending")}
            </p>
          )}

          <Pagination
            className="mt-12"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            scrollTarget={scrollTarget}
          />
        </>
      ) : (
        <p className="py-20 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
          {lyricsPending ? t("search.lyricsPending") : t("noFilteredSongs")}
        </p>
      )}
    </section>
  );
}
