"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  apiCreateImagery,
  apiCreateOccurrence,
  apiDeleteOccurrence,
  apiGetOccurrencesForSong,
  apiUpdateOccurrence,
} from "@/lib/api/client-api";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import SongRelationWorkbench, {
  type RelationDraft,
} from "../imagery-admin/SongRelationWorkbench";
import {
  IMAGERY_KEYS,
  useImageryCategoriesQuery,
  useImageryItemsQuery,
} from "../imagery-admin/queries";
import { getCategoryPath } from "../imagery-admin/utils";
import { EmptyState, ErrorState, LoadingState } from "../kit/parts";
import { WARN_TEXT_CLASS } from "../kit/styles";
import { notify, notifyError } from "../kit/toast";

export const songOccurrencesKey = (songId: number) =>
  ["admin", "occurrences", songId] as const;

/**
 * 一首歌的意象标注：左边整首歌词、右边这首歌的意象关系与候选审核。
 * 原先放在意象管理的「关系管理」里，要先在列表里找到这首歌再展开。
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
  const leafCategories = useMemo(() => {
    const parentIds = new Set(categoryList.map((c) => c.parent_id));
    return categoryList.filter((c) => !parentIds.has(c.id));
  }, [categoryList]);
  const pathOf = useCallback(
    (id: number) => getCategoryPath(id, categoryList),
    [categoryList],
  );

  /** 关系变了，这首歌的关系与词典里各意象的用量都要重取 */
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

  /** 新建（occurrenceId 为 null）或更新一条关系；意象名不在词典里时先建意象 */
  const save = async (
    occurrenceId: number | null,
    draft: RelationDraft,
  ): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    try {
      let imageryId = draft.imageryId;
      if (imageryId === null) {
        const created = (await apiCreateImagery(draft.imageryName)) as {
          id: number;
        };
        imageryId = created.id;
      }
      const payload = {
        imagery_id: imageryId,
        category_id: draft.categoryId,
      };
      if (occurrenceId === null) {
        await apiCreateOccurrence({ song_id: song.id, ...payload });
      } else {
        await apiUpdateOccurrence(occurrenceId, payload);
      }
      await reload();
      notify({
        type: "success",
        text:
          draft.imageryId === null
            ? `已新建意象「${draft.imageryName}」并保存关系`
            : occurrenceId === null
              ? "关系已创建"
              : "关系已更新",
      });
      return true;
    } catch (error) {
      notifyError(error, "保存关系失败");
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
      notifyError(error, "删除关系失败");
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
      <SongRelationWorkbench
        song={song}
        occurrences={occurrences.data ?? []}
        loading={occurrences.isPending}
        items={items.data ?? []}
        leafCategories={leafCategories}
        submitting={submitting}
        getCategoryPath={pathOf}
        onReload={reload}
        onSave={save}
        onDelete={(id, label) => void remove(id, label)}
      />
    </div>
  );
}
