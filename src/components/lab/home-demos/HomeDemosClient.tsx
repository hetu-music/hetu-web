"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import TopBar from "@/components/shared/topbar/TopBar";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import {
  DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
  type MusicLibraryViewMode,
} from "@/lib/constants";
import { buildBaseOptions } from "@/lib/library/filters";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import { cn } from "@/lib/utils/utils";
import React, { useCallback, useMemo, useRef, useState } from "react";
import DemoAEditorial from "./DemoAEditorial";
import DemoBShowcase from "./DemoBShowcase";
import DemoCFolio from "./DemoCFolio";
import {
  type DemoVariant,
  type DemoViewProps,
  buildFeaturedEntries,
  computeArchiveStats,
} from "./shared";

const VARIANTS: Array<{
  id: DemoVariant;
  name: string;
  tagline: string;
}> = [
  { id: "A", name: "A · 刊首画廊", tagline: "封面取色 + 竖排摘句 + Bento" },
  { id: "B", name: "B · 光影唱片行", tagline: "氛围封面墙 + 近期收录 + 浮雕卡" },
  { id: "C", name: "C · 精装典籍", tagline: "宣纸肌理 + 细线扉页 + 编号图版" },
];

interface HomeDemosClientProps {
  songs: Song[];
  gallery: GallerySong[];
}

export default function HomeDemosClient({
  songs,
  gallery,
}: HomeDemosClientProps) {
  const router = useRouter();
  const { showScrollTop, scrollToTop } = useScrollTop();
  const listStartRef = useRef<HTMLDivElement>(null);

  const [variant, setVariant] = useState<DemoVariant>("A");
  const [activeType, setActiveType] = useState<string>(FILTER_OPTION_ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<MusicLibraryViewMode>(
    DEFAULT_MUSIC_LIBRARY_VIEW_MODE,
  );
  const [page, setPage] = useState(1);

  const baseOptions = useMemo(() => buildBaseOptions(songs), [songs]);
  const featured = useMemo(
    () => buildFeaturedEntries(songs, gallery),
    [songs, gallery],
  );
  const stats = useMemo(() => computeArchiveStats(songs), [songs]);
  const recentSongs = useMemo(
    () => songs.filter((s) => !s.dispute_note && s.hascover).slice(0, 10),
    [songs],
  );

  // 原型页使用轻量本地过滤：支持类型、歌名、专辑、词曲演唱模糊查找
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return songs.filter((song) => {
      if (activeType !== FILTER_OPTION_ALL) {
        if (activeType === FILTER_OPTION_UNKNOWN) {
          if (song.type && song.type.length > 0) return false;
        } else if (!song.type?.includes(activeType)) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = [
        song.title,
        song.album,
        ...(song.artist ?? []),
        ...(song.lyricist ?? []),
        ...(song.composer ?? []),
        ...(song.arranger ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [songs, activeType, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSongs.length / MUSIC_LIBRARY_ITEMS_PER_PAGE),
  );
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageSongs = useMemo(() => {
    const start = (safePage - 1) * MUSIC_LIBRARY_ITEMS_PER_PAGE;
    return filteredSongs.slice(start, start + MUSIC_LIBRARY_ITEMS_PER_PAGE);
  }, [filteredSongs, safePage]);

  const isFiltering =
    activeType !== FILTER_OPTION_ALL || searchQuery.trim() !== "";

  const handleTypeChange = useCallback((next: string) => {
    setActiveType(next);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((next: string) => {
    setSearchQuery(next);
    setPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setActiveType(FILTER_OPTION_ALL);
    setSearchQuery("");
    setPage(1);
  }, []);

  const handleOpenSong = useCallback(
    (songId: number) => {
      bumpNavDepth();
      router.push(`/song/${songId}`);
    },
    [router],
  );

  const handleRandomSong = useCallback(() => {
    const pool = songs.filter((s) => !s.dispute_note);
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    bumpNavDepth();
    router.push(`/song/${picked.id}`);
  }, [songs, router]);

  const switchVariant = useCallback((next: DemoVariant) => {
    setVariant(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const sharedProps: DemoViewProps = {
    songs,
    filteredSongs,
    pageSongs,
    featured,
    recentSongs,
    wallSongs: gallery,
    stats,
    types: baseOptions.types,
    activeType,
    onTypeChange: handleTypeChange,
    searchQuery,
    onSearchChange: handleSearchChange,
    isFiltering,
    onReset: handleReset,
    view,
    onViewChange: setView,
    page: safePage,
    totalPages,
    onPageChange: setPage,
    listStartRef,
    onOpenSong: handleOpenSong,
    onRandomSong: handleRandomSong,
  };

  return (
    <>
      <TopBar
        exit={{
          kind: "logo",
          onClick: handleReset,
          tooltip: "重置预览筛选",
        }}
        nav={
          <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-slate-400 sm:inline-flex dark:text-slate-500">
            <span aria-hidden>/</span>
            <span>首页方案预览</span>
          </span>
        }
      />

      {variant === "A" && <DemoAEditorial {...sharedProps} />}
      {variant === "B" && <DemoBShowcase {...sharedProps} />}
      {variant === "C" && <DemoCFolio {...sharedProps} />}

      {/* 底部居中方案切换坞：随时对比 A / B / C 三个版本 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        <div
          role="tablist"
          aria-label="首页设计方案切换"
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 p-1.5 shadow-[0_14px_40px_-10px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-900/90 dark:shadow-[0_14px_40px_-10px_rgba(0,0,0,0.85)]"
        >
          {VARIANTS.map((item) => {
            const active = variant === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={item.tagline}
                onClick={() => switchVariant(item.id)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-xs tracking-wider transition-all duration-300 sm:px-4",
                  active
                    ? "bg-slate-900 font-medium text-white shadow-xs dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </>
  );
}
