"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { handleApprove } from "@/app/actions/admin-actions";
import {
  mergeAutoCompleteData,
  useAutoComplete,
} from "@/hooks/admin/useAutoComplete";
import { useRouter } from "@/i18n/navigation";
import type {
  MusicProviderType,
  SearchResultItem,
} from "@/lib/api/api-auto-complete";
import { apiCreateSong, apiUpdateSong } from "@/lib/api/client-api";
import {
  createEmptySongFormState,
  songFormStateSchema,
  toSongFormPayload,
  toSongFormState,
  type SongFormStateValues,
} from "@/lib/forms/song-form";
import type { SongDetail } from "@/lib/types";
import { convertEmptyStringToNull } from "@/lib/utils/utils-common";
import { diffSongFields, publishStatusOf } from "@/lib/utils/utils-song-diff";
import { notify, notifyError } from "../kit/toast";

type Published = Record<string, unknown> | null;

/**
 * 歌曲工作台的表单、暂存与发布。
 *
 * song 为 null 是新增：保存后换到这首歌自己的地址，其余板块（封面、意象、音频）
 * 都要先有 id 才能用。发布前先把未暂存的改动存进暂存表，再同步到正式表。
 */
export function useSongWorkspace(
  initialSong: SongDetail | null,
  initialPublished: Published,
) {
  const router = useRouter();
  const [song, setSong] = useState(initialSong);
  const [published, setPublished] = useState(initialPublished);
  const [isPublishing, setIsPublishing] = useState(false);

  const form = useForm<SongFormStateValues>({
    resolver: zodResolver(songFormStateSchema) as Resolver<SongFormStateValues>,
    defaultValues: initialSong
      ? toSongFormState(initialSong)
      : createEmptySongFormState(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const isDirty = form.formState.isDirty;

  const autoComplete = useAutoComplete((text) =>
    notify({ type: "error", text }),
  );

  /** 暂存版与线上版不同的字段 */
  const changedFields = useMemo(
    () =>
      new Set(
        song
          ? diffSongFields(
              song as unknown as Record<string, unknown>,
              published,
            )
          : [],
      ),
    [published, song],
  );
  const publishStatus = song
    ? publishStatusOf(song as unknown as Record<string, unknown>, published)
    : "unpublished";

  // 有没暂存的改动时，关页面或刷新先问一句
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /** 把表单写进暂存表，返回存好的那一行；失败返回 null */
  const persist = useCallback(
    async (data: SongFormStateValues): Promise<SongDetail | null> => {
      const payload = convertEmptyStringToNull(toSongFormPayload(data));
      try {
        if (!song) {
          const created: SongDetail = await apiCreateSong(payload);
          // 表单已存，离开前不再提醒
          form.reset(toSongFormState(created));
          notify({ type: "success", text: "已创建" });
          router.replace(`/admin/songs/${created.id}`);
          return created;
        }
        const updated: SongDetail = await apiUpdateSong(song.id, {
          ...payload,
          updated_at: song.updated_at,
        });
        setSong(updated);
        form.reset(toSongFormState(updated));
        return updated;
      } catch (err) {
        notifyError(err, song ? "保存失败" : "创建失败");
        return null;
      }
    },
    [form, router, song],
  );

  const save = form.handleSubmit(async (data) => {
    if (await persist(data)) {
      if (song) notify({ type: "success", text: "已暂存" });
    }
  });

  /** 发布：先跑校验、把没暂存的改动存掉，再同步到正式表 */
  const publish = useCallback(async () => {
    if (!song) return;
    if (!(await form.trigger())) {
      notify({ type: "error", text: "有字段没填对，先改好再发布" });
      return;
    }

    setIsPublishing(true);
    try {
      const saved = form.formState.isDirty
        ? await persist(form.getValues())
        : song;
      if (!saved) return;

      const res = await handleApprove(saved.id);
      if (!res.success) throw new Error(res.error || "同步失败");

      // 正式表现在与暂存表一致
      setPublished({ ...saved });
      notify({ type: "success", text: "已发布" });
    } catch (err) {
      notifyError(err, "发布失败");
    } finally {
      setIsPublishing(false);
    }
  }, [form, persist, song]);

  /** 放弃没暂存的改动 */
  const discard = useCallback(() => {
    form.reset(song ? toSongFormState(song) : createEmptySongFormState());
  }, [form, song]);

  const runAutoComplete = useCallback(
    async (provider: MusicProviderType) => {
      const values = toSongFormPayload(form.getValues());
      const artists = Array.isArray(values.artist) ? values.artist : undefined;
      await autoComplete.handleAutoComplete(provider, values.title, artists);
    },
    [autoComplete, form],
  );

  const selectSearchResult = useCallback(
    async (result: SearchResultItem) => {
      const data = await autoComplete.handleSelectSearchResult(result);
      if (!data) return;
      const merged = mergeAutoCompleteData(
        toSongFormPayload(form.getValues()),
        data,
      );
      // 只填空字段；以 keepDefaultValues 保住「与暂存版相比有改动」的判断
      form.reset(toSongFormState(merged), { keepDefaultValues: true });
      notify({ type: "success", text: "已补全空着的字段，检查后再暂存" });
    },
    [autoComplete, form],
  );

  return {
    song,
    form,
    isDirty,
    isSaving: form.formState.isSubmitting,
    isPublishing,
    publishStatus,
    changedFields,
    autoComplete,
    save,
    publish,
    discard,
    runAutoComplete,
    selectSearchResult,
  };
}

export type SongWorkspaceState = ReturnType<typeof useSongWorkspace>;
