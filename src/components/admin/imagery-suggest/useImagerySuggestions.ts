"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiCreateOccurrencesBatch,
  apiGetImagerySuggestions,
  apiGetOccurrencesForSong,
  apiReviewImagery,
} from "@/lib/api/client-api";
import type { ImagerySuggestion } from "@/lib/imagery/suggest";
import { wordMotifIds } from "@/lib/imagery/word-motifs";
import type {
  OccurrenceBatchItem,
  OccurrenceWithSong,
} from "@/lib/server/service-imagery";
import type { ImagerySuggestionsResult } from "@/lib/server/service-imagery-suggest";
import type { ImageryItem } from "@/lib/types";

/** 单个候选的审核状态 */
export interface SuggestionDraft {
  checked: boolean;
  /** 保存时使用的意象名，默认为候选原名，审核时可改 */
  name: string;
  categoryId: number | null;
}

export type PanelMessage = { type: "success" | "error"; text: string };

/** AI 校验对某个候选的意见 */
export type AiNote =
  | { kind: "verdict"; keep: boolean; reason: string }
  | { kind: "addition"; reason: string };

/**
 * 候选的初始状态。母题取词典里这个词登记的默认母题（与手动标注同一份数据）；
 * 词典里没有的（AI 补充的新词）用候选自带的
 */
function initialDraft(
  s: ImagerySuggestion,
  item: ImageryItem | null,
): SuggestionDraft {
  return {
    checked: s.recommended,
    name: s.name,
    categoryId: (item && wordMotifIds(item)[0]) ?? s.categoryIds[0] ?? null,
  };
}

const IMAGERY_NAME_MAX = 50;

/**
 * 单首歌的意象预标注：生成候选（词典匹配）、AI 校验、审核后批量保存。
 *
 * options.items 是后台共用的词典（含各词登记的母题），改名、选母题都按它解析。
 * options.existing 由调用方提供该歌已有的标注时不再自行请求，
 * 保存后改为调用 options.onSaved 让调用方刷新。
 */
export function useImagerySuggestions(
  songId: number,
  options: {
    items: ImageryItem[];
    existing?: OccurrenceWithSong[];
    onSaved?: () => Promise<unknown>;
  },
) {
  const { items, existing: externalExisting, onSaved } = options;
  const hasExternalExisting = externalExisting !== undefined;
  const [ownExisting, setOwnExisting] = useState<OccurrenceWithSong[] | null>(
    null,
  );
  const existing = externalExisting ?? ownExisting;
  const [result, setResult] = useState<ImagerySuggestionsResult | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SuggestionDraft>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<PanelMessage | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [aiNotes, setAiNotes] = useState<Record<number, AiNote>>({});
  /** AI 补充的候选没有意象 id，用负数占位，保存时按名称解析 */
  const nextSyntheticId = useRef(-1);

  const loadExisting = useCallback(async () => {
    if (onSaved) {
      await onSaved();
      return;
    }
    try {
      setOwnExisting(await apiGetOccurrencesForSong(songId));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "获取歌曲意象失败",
      });
    }
  }, [onSaved, songId]);

  useEffect(() => {
    if (hasExternalExisting) return;
    let cancelled = false;
    apiGetOccurrencesForSong(songId)
      .then((rows) => {
        if (!cancelled) setOwnExisting(rows);
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
  }, [hasExternalExisting, songId]);

  /** 意象名（小写）→ 词典条目；与预标注的匹配规则一致，大小写不敏感 */
  const itemByName = useMemo(
    () => new Map(items.map((i) => [i.name.toLowerCase(), i])),
    [items],
  );
  const resolveName = useCallback(
    (name: string): ImageryItem | null =>
      itemByName.get(name.trim().toLowerCase()) ?? null,
    [itemByName],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const next = await apiGetImagerySuggestions(songId);
      setResult(next);
      setAiNotes({});
      setDrafts(
        Object.fromEntries(
          next.suggestions.map((s) => [
            s.imageryId,
            initialDraft(s, resolveName(s.name)),
          ]),
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
  }, [resolveName, songId]);

  const updateDraft = useCallback(
    (imageryId: number, patch: Partial<SuggestionDraft>) =>
      setDrafts((current) => ({
        ...current,
        [imageryId]: { ...current[imageryId], ...patch },
      })),
    [],
  );

  const setChecked = useCallback((imageryIds: number[], checked: boolean) => {
    setDrafts((current) => {
      const next = { ...current };
      for (const id of imageryIds) next[id] = { ...next[id], checked };
      return next;
    });
  }, []);

  const existingImageryIds = useMemo(
    () => new Set((existing ?? []).map((o) => o.imagery_id)),
    [existing],
  );

  /**
   * 把候选改成另一个词。改成词典里已有的词时，母题切换为它登记的默认母题；
   * 新词沿用当前母题（改名多为近义替换，如「雪花」→「雪」）。
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
            categoryId: (entry && wordMotifIds(entry)[0]) ?? draft.categoryId,
          },
        };
      });
    },
    [resolveName],
  );

  /**
   * AI 校验：按模型意见改写勾选状态，并把补充的意象追加为新候选。
   * 返回被 AI 勾选的低置信候选数，供界面决定是否展开折叠区。
   */
  const review = useCallback(async (): Promise<number> => {
    if (!result || reviewing) return 0;
    setReviewing(true);
    setMessage(null);
    try {
      const { verdicts, additions } = await apiReviewImagery(
        songId,
        result.suggestions.map((s) => ({
          imageryId: s.imageryId,
          name: s.name,
          rate: s.rate,
          recommended: s.recommended,
        })),
      );

      const notes: Record<number, AiNote> = {};
      const recommendedById = new Map(
        result.suggestions.map((s) => [s.imageryId, s.recommended]),
      );
      let dropped = 0;
      let restored = 0;
      let promotedHidden = 0;
      for (const v of verdicts) {
        notes[v.imageryId] = {
          kind: "verdict",
          keep: v.keep,
          reason: v.reason,
        };
        const recommended = recommendedById.get(v.imageryId);
        if (recommended && !v.keep) dropped += 1;
        if (recommended === false && v.keep) {
          restored += 1;
          promotedHidden += 1;
        }
      }

      const added: ImagerySuggestion[] = additions.map((a) => {
        const imageryId = nextSyntheticId.current--;
        notes[imageryId] = { kind: "addition", reason: a.reason };
        return {
          imageryId,
          name: a.name,
          timetags: a.timetags,
          lines: a.lines,
          categoryIds: a.categoryId === null ? [] : [a.categoryId],
          seen: 0,
          annotated: 0,
          rate: null,
          recommended: true,
        };
      });

      setResult({ ...result, suggestions: [...result.suggestions, ...added] });
      setDrafts((current) => {
        const next = { ...current };
        for (const v of verdicts) {
          if (next[v.imageryId]) {
            next[v.imageryId] = { ...next[v.imageryId], checked: v.keep };
          }
        }
        for (const s of added) {
          // 词典里已有的词用它登记的默认母题，比模型挑的更贴合现有标注
          next[s.imageryId] = initialDraft(s, resolveName(s.name));
        }
        return next;
      });
      setAiNotes((current) => ({ ...current, ...notes }));
      setMessage({
        type: "success",
        text: `AI 校验完成：取消勾选 ${dropped} 个，补勾 ${restored} 个，补充 ${added.length} 个`,
      });
      return promotedHidden;
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "AI 校验失败",
      });
      return 0;
    } finally {
      setReviewing(false);
    }
  }, [resolveName, result, reviewing, songId]);

  const selected = (result?.suggestions ?? []).filter(
    (s) => drafts[s.imageryId]?.checked,
  );

  const save = useCallback(async () => {
    if (!result || saving) return;
    const items: OccurrenceBatchItem[] = [];
    for (const s of selected) {
      const draft = drafts[s.imageryId];
      const name = draft.name.trim();
      if (!name || name.length > IMAGERY_NAME_MAX) {
        setMessage({
          type: "error",
          text: `「${s.name}」的意象名需为 1–${IMAGERY_NAME_MAX} 个字`,
        });
        return;
      }
      if (draft.categoryId === null) {
        setMessage({ type: "error", text: `「${name}」还没有选择母题` });
        return;
      }
      const entry = resolveName(name);
      items.push({
        ...(entry ? { imagery_id: entry.id } : { imagery_name: name }),
        category_id: draft.categoryId,
      });
    }
    if (items.length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { created, skipped, newImagery } = await apiCreateOccurrencesBatch(
        songId,
        items,
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
  }, [drafts, loadExisting, resolveName, result, saving, selected, songId]);

  return {
    existing,
    result,
    drafts,
    generating,
    reviewing,
    aiNotes,
    saving,
    message,
    selectedCount: selected.length,
    generate,
    review,
    existingImageryIds,
    resolveName,
    rename,
    updateDraft,
    setChecked,
    save,
  };
}
export type ImagerySuggestionsState = ReturnType<typeof useImagerySuggestions>;
