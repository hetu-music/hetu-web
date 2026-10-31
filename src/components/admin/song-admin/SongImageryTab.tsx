"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  apiCreateOccurrencesBatch,
  apiDeleteOccurrence,
  apiGetOccurrencesForSong,
  apiUpdateOccurrence,
} from "@/lib/api/client-api";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import { categoryPath, motifOptions } from "@/lib/imagery/word-motifs";
import SongAnnotationWorkbench, {
  type AnnotationDraft,
} from "../imagery-admin/SongAnnotationWorkbench";
import {
  IMAGERY_KEYS,
  useImageryCategoriesQuery,
  useImageryItemsQuery,
} from "../imagery-admin/queries";
import { EmptyState, ErrorState, LoadingState } from "../kit/parts";
import { WARN_TEXT_CLASS } from "../kit/styles";
import { notify, notifyError } from "../kit/toast";

export const songOccurrencesKey = (songId: number) =>
  ["admin", "occurrences", songId] as const;

/**
 * 一首歌的意象标注：左边整首歌词、右边这首歌的标注与候选审核。
 * 新增标注与预标注审核走同一个接口，词典里没有的词在保存时随之创建。
 */
export default function SongImageryTab({
  song,
}: {
  song: {
    id: number;
    title: string;
    album?: string | null;
    lyrics?: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const items = useImageryItemsQuery();
  const categories = useImageryCategoriesQuery();
  const occurrences = useQuery<OccurrenceWithSong[]>({
    queryKey: songOccurrencesKey(song.id),
    queryFn: () => apiGetOccurrencesForSong(song.id),
  });

  const categoryList = useMemo(() => categories.data ?? [], [categories.data]);
  const motifs = useMemo(() => motifOptions(categoryList), [categoryList]);
  const pathOf = useCallback(
    (id: number) =>
      categoryPath(id, new Map(categoryList.map((c) => [c.id, c]))),
    [categoryList],
  );

  /** 标注变了，这首歌的标注与词典（用量、登记的母题）都要重取 */
  const reload = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: songOccurrencesKey(song.id),
        }),
        queryClient.invalidateQueries({ queryKey: IMAGERY_KEYS.items }),
      ]),
    [queryClient, song.id],
  );

  /**
   * 新建（occurrenceId 为 null）或更新一条标注。词典里没有的词随标注一起保存，
   * 服务端先核对歌词再建词，不会留下没有标注的词
   */
  const save = async (
    occurrenceId: number | null,
    draft: AnnotationDraft,
  ): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    try {
      const word =
        draft.imageryId === null
          ? { imagery_name: draft.imageryName.trim() }
          : { imagery_id: draft.imageryId };
      if (occurrenceId === null) {
        const { created } = await apiCreateOccurrencesBatch(song.id, [
          { ...word, category_id: draft.categoryId },
        ]);
        if (created === 0) {
          notify({ type: "error", text: "这首歌已经标过这个词" });
          await reload();
          return false;
        }
      } else {
        await apiUpdateOccurrence(occurrenceId, {
          ...word,
          category_id: draft.categoryId,
        });
      }
      await reload();
      notify({
        type: "success",
        text:
          draft.imageryId === null
            ? `已新建词「${draft.imageryName.trim()}」并保存标注`
            : occurrenceId === null
              ? "标注已保存"
              : "标注已更新",
      });
      return true;
    } catch (error) {
      notifyError(error, "保存标注失败");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (occurrenceId: number, label: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiDeleteOccurrence(occurrenceId);
      await reload();
      notify({ type: "success", text: `已删除「${label}」` });
    } catch (error) {
      notifyError(error, "删除标注失败");
    } finally {
      setSubmitting(false);
    }
  };

  const failed = [items, categories, occurrences].find((q) => q.isError);
  if (failed?.error) {
    return (
      <ErrorState
        message={failed.error.message}
        onRetry={() => void failed.refetch()}
      />
    );
  }
  if (items.isPending || categories.isPending) {
    return <LoadingState text="加载意象词典…" />;
  }
  if (!song.lyrics?.trim()) {
    return (
      <EmptyState>这首歌还没有歌词，先在「资料」里补上 LRC 歌词</EmptyState>
    );
  }

  const count = occurrences.data?.length ?? 0;

  return (
    <div className="space-y-4">
      {occurrences.data && count < MIN_OCCURRENCES && (
        <p className={`text-xs ${WARN_TEXT_CLASS}`}>
          已标注 {count} 个，少于 {MIN_OCCURRENCES} 个不会进入寻曲测验
        </p>
      )}
      <SongAnnotationWorkbench
        song={song}
        occurrences={occurrences.data ?? []}
        loading={occurrences.isPending}
        items={items.data ?? []}
        motifs={motifs}
        submitting={submitting}
        getCategoryPath={pathOf}
        onReload={reload}
        onSave={save}
        onDelete={(id, label) => void remove(id, label)}
      />
    </div>
  );
}
