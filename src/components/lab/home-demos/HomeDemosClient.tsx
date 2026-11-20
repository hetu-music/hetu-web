"use client";

import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import TopBar from "@/components/shared/topbar/TopBar";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { useRouter } from "@/i18n/navigation";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import {
  FILTER_OPTION_ALL,
  FILTER_OPTION_UNKNOWN,
  MUSIC_LIBRARY_ITEMS_PER_PAGE,
} from "@/lib/constants";
import { buildBaseOptions } from "@/lib/library/filters";
import type { Song } from "@/lib/types";
import { bumpNavDepth } from "@/lib/utils/nav-depth";
import React, { useCallback, useMemo, useRef, useState } from "react";
import RecordSalonHome from "./RecordSalonHome";
import { buildFeaturedEntries, computeArchiveStats } from "./shared";

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

  const [activeType, setActiveType] = useState<string>(FILTER_OPTION_ALL);
  const [searchQuery, setSearchQuery] = useState("");
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

  // 原型页使用轻量本地过滤：支持类型、歌名、专辑、词曲演唱检索
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <>
      <TopBar
        exit={{
          kind: "logo",
          onClick: handleReset,
          tooltip: "回到卷首",
        }}
        nav={
          <span className="hidden items-center gap-2 text-xs tracking-[0.2em] text-slate-400 sm:inline-flex dark:text-slate-500">
            <span aria-hidden>/</span>
            <span>首页重设计预览</span>
          </span>
        }
      />

      <RecordSalonHome
        filteredSongs={filteredSongs}
        pageSongs={pageSongs}
        featured={featured}
        recentSongs={recentSongs}
        stats={stats}
        types={baseOptions.types}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        isFiltering={isFiltering}
        onReset={handleReset}
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        listStartRef={listStartRef}
        onOpenSong={handleOpenSong}
        onRandomSong={handleRandomSong}
      />

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </>
  );
}
