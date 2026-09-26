"use client";

import { useCallback, useEffect, useState } from "react";
import {
  apiCreateOccurrencesBatch,
  apiGetImagerySuggestions,
  apiGetOccurrencesForSong,
} from "@/lib/api/client-api";
import type { ImagerySuggestion } from "@/lib/imagery/suggest";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { ImagerySuggestionsResult } from "@/lib/server/service-imagery-suggest";

/** 单个候选的审核状态 */
export interface SuggestionDraft {
  checked: boolean;
  categoryId: number | null;
  /** 取消勾选的时间标签 */
  excludedTags: string[];
}

export type PanelMessage = { type: "success" | "error"; text: string };

function initialDraft(s: ImagerySuggestion): SuggestionDraft {
  return {
    checked: s.recommended,
    categoryId: s.categoryIds[0] ?? null,
    excludedTags: [],
  };
}

/**
 * 歌曲管理中单首歌的意象标注：加载已有标注、生成预标注候选、审核后批量保存。
 */
export function useSongImagery(songId: number, csrfToken: string) {
  const [existing, setExisting] = useState<OccurrenceWithSong[] | null>(null);
  const [result, setResult] = useState<ImagerySuggestionsResult | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SuggestionDraft>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<PanelMessage | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      setExisting(await apiGetOccurrencesForSong(songId));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "获取歌曲意象失败",
      });
    }
  }, [songId]);

  useEffect(() => {
    let cancelled = false;
    apiGetOccurrencesForSong(songId)
      .then((rows) => {
        if (!cancelled) setExisting(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "获取歌曲意象失败",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const next = await apiGetImagerySuggestions(songId);
      setResult(next);
      setDrafts(
        Object.fromEntries(
          next.suggestions.map((s) => [s.imageryId, initialDraft(s)]),
        ),
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "生成意象候选失败",
      });
    } finally {
      setGenerating(false);
    }
  }, [songId]);

  const updateDraft = useCallback(
    (imageryId: number, patch: Partial<SuggestionDraft>) =>
      setDrafts((current) => ({
        ...current,
        [imageryId]: { ...current[imageryId], ...patch },
      })),
    [],
  );

  const toggleTag = useCallback((imageryId: number, tag: string) => {
    setDrafts((current) => {
      const draft = current[imageryId];
      const excludedTags = draft.excludedTags.includes(tag)
        ? draft.excludedTags.filter((t) => t !== tag)
        : [...draft.excludedTags, tag];
      return { ...current, [imageryId]: { ...draft, excludedTags } };
    });
  }, []);

  const setChecked = useCallback((imageryIds: number[], checked: boolean) => {
    setDrafts((current) => {
      const next = { ...current };
      for (const id of imageryIds) next[id] = { ...next[id], checked };
      return next;
    });
  }, []);

  const selected = (result?.suggestions ?? []).filter(
    (s) => drafts[s.imageryId]?.checked,
  );

  const save = useCallback(async () => {
    if (!result || saving) return;
    const items: Array<{
      imagery_id: number;
      category_id: number;
      lyric_timetag: string[];
    }> = [];
    for (const s of selected) {
      const draft = drafts[s.imageryId];
      const tags = s.timetags.filter((t) => !draft.excludedTags.includes(t));
      if (draft.categoryId === null) {
        setMessage({ type: "error", text: `「${s.name}」还没有选择分类` });
        return;
      }
      if (tags.length === 0) {
        setMessage({ type: "error", text: `「${s.name}」至少要保留一处歌词` });
        return;
      }
      items.push({
        imagery_id: s.imageryId,
        category_id: draft.categoryId,
        lyric_timetag: tags,
      });
    }
    if (items.length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { created, skipped } = await apiCreateOccurrencesBatch(
        songId,
        items,
        csrfToken,
      );
      const saved = new Set(items.map((i) => i.imagery_id));
      setResult({
        ...result,
        suggestions: result.suggestions.filter((s) => !saved.has(s.imageryId)),
      });
      await loadExisting();
      setMessage({
        type: "success",
        text:
          skipped > 0
            ? `已保存 ${created} 个意象，${skipped} 个此前已标注，已跳过`
            : `已保存 ${created} 个意象`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存意象标注失败",
      });
    } finally {
      setSaving(false);
    }
  }, [csrfToken, drafts, loadExisting, result, saving, selected, songId]);

  return {
    existing,
    result,
    drafts,
    generating,
    saving,
    message,
    selectedCount: selected.length,
    generate,
    updateDraft,
    toggleTag,
    setChecked,
    save,
  };
}
