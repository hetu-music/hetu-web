"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiCreateOccurrencesBatch,
  apiGetImagerySuggestions,
  apiGetOccurrencesForSong,
} from "@/lib/api/client-api";
import type { ImagerySuggestion } from "@/lib/imagery/suggest";
import type {
  OccurrenceBatchItem,
  OccurrenceWithSong,
} from "@/lib/server/service-imagery";
import type {
  DictionaryOption,
  ImagerySuggestionsResult,
} from "@/lib/server/service-imagery-suggest";

/** 单个候选的审核状态 */
export interface SuggestionDraft {
  checked: boolean;
  /** 保存时使用的意象名，默认为候选原名，审核时可改 */
  name: string;
  categoryId: number | null;
  /** 取消勾选的时间标签 */
  excludedTags: string[];
}

export type PanelMessage = { type: "success" | "error"; text: string };

function initialDraft(s: ImagerySuggestion): SuggestionDraft {
  return {
    checked: s.recommended,
    name: s.name,
    categoryId: s.categoryIds[0] ?? null,
    excludedTags: [],
  };
}

const IMAGERY_NAME_MAX = 50;

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

  /** 意象名（小写）→ 词典条目；与预标注的匹配规则一致，大小写不敏感 */
  const dictionaryByName = useMemo(
    () =>
      new Map((result?.dictionary ?? []).map((d) => [d.name.toLowerCase(), d])),
    [result],
  );
  const resolveName = useCallback(
    (name: string): DictionaryOption | null =>
      dictionaryByName.get(name.trim().toLowerCase()) ?? null,
    [dictionaryByName],
  );
  const existingImageryIds = useMemo(
    () => new Set((existing ?? []).map((o) => o.imagery_id)),
    [existing],
  );

  /**
   * 把候选改成另一个意象。改成词典里已有的意象时，分类切换为它最常用的分类；
   * 新意象或没有历史分类的意象沿用当前分类（改名多为近义替换，如「雪花」→「雪」）。
   */
  const rename = useCallback(
    (imageryId: number, name: string) => {
      const entry = resolveName(name);
      setDrafts((current) => {
        const draft = current[imageryId];
        return {
          ...current,
          [imageryId]: {
            ...draft,
            name: name.trim(),
            checked: true,
            categoryId: entry?.categoryIds[0] ?? draft.categoryId,
          },
        };
      });
    },
    [resolveName],
  );

  const selected = (result?.suggestions ?? []).filter(
    (s) => drafts[s.imageryId]?.checked,
  );

  const save = useCallback(async () => {
    if (!result || saving) return;
    const items: OccurrenceBatchItem[] = [];
    for (const s of selected) {
      const draft = drafts[s.imageryId];
      const tags = s.timetags.filter((t) => !draft.excludedTags.includes(t));
      const name = draft.name.trim();
      if (!name || name.length > IMAGERY_NAME_MAX) {
        setMessage({
          type: "error",
          text: `「${s.name}」的意象名需为 1–${IMAGERY_NAME_MAX} 个字`,
        });
        return;
      }
      if (draft.categoryId === null) {
        setMessage({ type: "error", text: `「${name}」还没有选择分类` });
        return;
      }
      if (tags.length === 0) {
        setMessage({ type: "error", text: `「${name}」至少要保留一处歌词` });
        return;
      }
      const entry = resolveName(name);
      items.push({
        ...(entry ? { imagery_id: entry.id } : { imagery_name: name }),
        category_id: draft.categoryId,
        lyric_timetag: tags,
      });
    }
    if (items.length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { created, skipped, newImagery } = await apiCreateOccurrencesBatch(
        songId,
        items,
        csrfToken,
      );
      const saved = new Set(selected.map((s) => s.imageryId));
      setResult({
        ...result,
        suggestions: result.suggestions.filter((s) => !saved.has(s.imageryId)),
      });
      await loadExisting();
      const notes = [
        newImagery > 0 && `新建意象 ${newImagery} 个`,
        skipped > 0 && `${skipped} 个此前已标注，已跳过`,
      ].filter(Boolean);
      setMessage({
        type: "success",
        text: [`已保存 ${created} 个意象`, ...notes].join("，"),
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存意象标注失败",
      });
    } finally {
      setSaving(false);
    }
  }, [
    csrfToken,
    drafts,
    loadExisting,
    resolveName,
    result,
    saving,
    selected,
    songId,
  ]);

  return {
    existing,
    result,
    drafts,
    generating,
    saving,
    message,
    selectedCount: selected.length,
    generate,
    existingImageryIds,
    resolveName,
    rename,
    updateDraft,
    toggleTag,
    setChecked,
    save,
  };
}
