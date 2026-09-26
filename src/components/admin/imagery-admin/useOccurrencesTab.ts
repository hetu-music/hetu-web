"use client";

import {
  apiCreateImagery,
  apiCreateOccurrence,
  apiDeleteOccurrence,
  apiGetOccurrencesForSong,
  apiGetSongs,
  apiUpdateOccurrence,
} from "@/lib/api/client-api";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModalState, SongOption } from "./types";

const SONG_PAGE_SIZE = 10;

/** 对照编辑提交的一条关系；imageryId 为 null 表示词典里还没有，保存时新建 */
export interface RelationDraft {
  imageryId: number | null;
  imageryName: string;
  categoryId: number;
  meaningId: number | null;
  timetags: string[];
}

export function useOccurrencesTab(
  csrfToken: string,
  showToast: (type: "success" | "error", text: string) => void,
  refreshImageryItems: () => Promise<unknown>,
) {
  const [allSongs, setAllSongs] = useState<SongOption[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [songSearchTerm, setSongSearchTerm] = useState("");
  const [songsPage, setSongsPage] = useState(1);
  const [expandedSongId, setExpandedSongId] = useState<number | null>(null);
  const [occurrencesBySong, setOccurrencesBySong] = useState<
    Record<number, OccurrenceWithSong[]>
  >({});
  const [occurrenceLoadingSongId, setOccurrenceLoadingSongId] = useState<
    number | null
  >(null);
  const [occurrenceSubmitting, setOccurrenceSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  useEffect(() => {
    void apiGetSongs()
      .then((songs) => setAllSongs(songs))
      .catch((error: unknown) => {
        showToast(
          "error",
          error instanceof Error ? error.message : "加载歌曲失败",
        );
      })
      .finally(() => setSongsLoading(false));
  }, [showToast]);

  const filteredSongs = useMemo(() => {
    if (!songSearchTerm.trim()) return allSongs;
    const query = songSearchTerm.trim().toLowerCase();
    return allSongs.filter((song) =>
      `${song.id} ${song.title} ${song.album ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [allSongs, songSearchTerm]);

  const songsTotalPages = Math.max(
    1,
    Math.ceil(filteredSongs.length / SONG_PAGE_SIZE),
  );
  const currentSongsPage = Math.min(songsPage, songsTotalPages);
  const pagedSongs = useMemo(
    () =>
      filteredSongs.slice(
        (currentSongsPage - 1) * SONG_PAGE_SIZE,
        currentSongsPage * SONG_PAGE_SIZE,
      ),
    [currentSongsPage, filteredSongs],
  );

  const loadOccurrencesForSong = useCallback(
    async (songId: number) => {
      setOccurrenceLoadingSongId(songId);
      try {
        const occurrences = await apiGetOccurrencesForSong(songId);
        setOccurrencesBySong((current) => ({
          ...current,
          [songId]: occurrences,
        }));
        return occurrences;
      } catch (error) {
        showToast(
          "error",
          error instanceof Error ? error.message : "加载关系失败",
        );
        return [];
      } finally {
        setOccurrenceLoadingSongId((current) =>
          current === songId ? null : current,
        );
      }
    },
    [showToast],
  );

  const toggleSongPanel = async (songId: number) => {
    if (expandedSongId === songId) {
      setExpandedSongId(null);
      return;
    }
    setExpandedSongId(songId);
    await loadOccurrencesForSong(songId);
  };

  const closeModal = () => setModal({ type: "none" });

  /**
   * 新建（occurrenceId 为 null）或更新一条关系。意象名不在词典中时先创建意象。
   * 成功返回 true，供对照编辑区决定是否关闭编辑器。
   */
  const saveRelation = async (
    songId: number,
    occurrenceId: number | null,
    draft: RelationDraft,
  ): Promise<boolean> => {
    if (occurrenceSubmitting) return false;
    setOccurrenceSubmitting(true);
    try {
      let imageryId = draft.imageryId;
      if (imageryId === null) {
        const created = (await apiCreateImagery(
          draft.imageryName,
          csrfToken,
        )) as { id: number };
        imageryId = created.id;
      }
      const payload = {
        imagery_id: imageryId,
        category_id: draft.categoryId,
        meaning_id: draft.meaningId,
        lyric_timetag: draft.timetags,
      };
      if (occurrenceId === null) {
        await apiCreateOccurrence({ song_id: songId, ...payload }, csrfToken);
      } else {
        await apiUpdateOccurrence(occurrenceId, payload, csrfToken);
      }
      await Promise.all([
        loadOccurrencesForSong(songId),
        refreshImageryItems(),
      ]);
      showToast(
        "success",
        draft.imageryId === null
          ? `已新建意象「${draft.imageryName}」并保存关系`
          : occurrenceId === null
            ? "关系已创建"
            : "关系已更新",
      );
      return true;
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "保存关系失败",
      );
      return false;
    } finally {
      setOccurrenceSubmitting(false);
    }
  };

  const handleDeleteRelation = async () => {
    if (modal.type !== "delete-occurrence" || occurrenceSubmitting) return;
    setOccurrenceSubmitting(true);
    try {
      await apiDeleteOccurrence(modal.occurrenceId, csrfToken);
      await Promise.all([
        loadOccurrencesForSong(modal.songId),
        refreshImageryItems(),
      ]);
      closeModal();
      showToast("success", "关系已删除");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "删除关系失败",
      );
    } finally {
      setOccurrenceSubmitting(false);
    }
  };

  return {
    allSongs,
    songsLoading,
    songSearchTerm,
    setSongSearchTerm,
    songsPage,
    setSongsPage,
    expandedSongId,
    occurrencesBySong,
    occurrenceLoadingSongId,
    occurrenceSubmitting,
    modal,
    setModal,
    pagedSongs,
    currentSongsPage,
    songsTotalPages,
    loadOccurrencesForSong,
    toggleSongPanel,
    closeModal,
    saveRelation,
    handleDeleteRelation,
    /** 触发删除确认 modal */
    openDeleteOccurrenceModal: (
      occurrenceId: number,
      songId: number,
      label: string,
    ) => setModal({ type: "delete-occurrence", occurrenceId, songId, label }),
  };
}
