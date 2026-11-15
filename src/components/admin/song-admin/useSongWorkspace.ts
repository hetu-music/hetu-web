"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import {
  handleApprove,
  handleDeleteSong,
  handleDiscardDraft,
  handleUnpublish,
} from "@/app/actions/admin-actions";
import { onEditorialWrite } from "@/lib/api/editorial-events";
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
import { cdnPurgeWarning } from "@/lib/cdn-purge";
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
import { songOccurrencesKey } from "./SongImageryTab";

type Published = Record<string, unknown> | null;

/**
 * 歌曲工作台的表单、暂存、发布与下架。
 *
 * song 是这首歌的工作版本（有草稿用草稿），带 is_live、has_draft、ever_published。
 * song 为 null 是新增：保存后换到这首歌自己的地址，其余板块（封面、意象、音频）
 * 都要先有 id 才能用。资料与意象、基调、校勘都写在草稿上，发布时一起上线；发布前先把未暂存的表单存掉。
 */
export function useSongWorkspace(
  initialSong: SongDetail | null,
  initialPublished: Published,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [song, setSong] = useState(initialSong);
  const [published, setPublished] = useState(initialPublished);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isChangingState, setIsChangingState] = useState(false);

  // 意象、基调、校勘写进了草稿：线上的歌变成「有未发布的改动」
  useEffect(
    () =>
      onEditorialWrite(() =>
        setSong((s) => (s && !s.has_draft ? { ...s, has_draft: true } : s)),
      ),
    [],
  );

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
  const publishStatus = song ? publishStatusOf(song) : "unpublished";

  // 有没暂存的改动时，关页面或刷新先问一句
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /** 把表单写进草稿（链接直接改），返回存好的工作版本；失败返回 null */
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

  /** 发布：先跑校验、把没暂存的改动存掉，再让草稿冻结上线（已下架而没有草稿时是重新上线） */
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
      if (!res.success) throw new Error(res.error || "发布失败");

      // 工作版本现在就是线上版本
      setPublished({ ...saved });
      setSong({
        ...saved,
        is_live: true,
        has_draft: false,
        ever_published: true,
      });
      if (res.cdnPurgeFailed?.length) {
        notify({ type: "error", text: cdnPurgeWarning(res.cdnPurgeFailed) });
      } else {
        notify({ type: "success", text: "已发布" });
      }
      void queryClient.invalidateQueries({
        queryKey: songOccurrencesKey(saved.id),
      });
      // 意象时间标签随歌词重算；歌词里已找不到的词，标注要到意象页签里删掉或改标
      if (res.imagerySyncFailed) {
        notify({
          type: "error",
          text: "意象时间标签没同步成功，可在意象页签改动任一标注触发重算",
        });
      } else if (res.imageryNotFound?.length) {
        notify({
          type: "error",
          text: `新歌词里找不到意象「${res.imageryNotFound.join("」「")}」，请到意象页签删掉或改标`,
        });
      }
    } catch (err) {
      notifyError(err, "发布失败");
    } finally {
      setIsPublishing(false);
    }
  }, [form, persist, queryClient, song]);

  /** 放弃没暂存的改动 */
  const discard = useCallback(() => {
    form.reset(song ? toSongFormState(song) : createEmptySongFormState());
  }, [form, song]);

  /** 下架、放弃草稿、删歌：都是两步确认后才调；成功后按各自的结果更新页面 */
  const changeState = useCallback(
    async (
      run: () => Promise<{ success: boolean; error?: string }>,
      done: () => void,
      failText: string,
    ) => {
      setIsChangingState(true);
      try {
        const res = await run();
        if (!res.success) throw new Error(res.error || failText);
        done();
      } catch (err) {
        notifyError(err, failText);
      } finally {
        setIsChangingState(false);
      }
    },
    [],
  );

  /** 放弃草稿：回到线上版本。各页签的数据都变了，整页重新加载最省事 */
  const discardDraft = useCallback(async () => {
    if (!song) return;
    await changeState(
      () => handleDiscardDraft(song.id),
      () => window.location.reload(),
      "放弃草稿失败",
    );
  }, [changeState, song]);

  const unpublish = useCallback(async () => {
    if (!song) return;
    await changeState(
      () => handleUnpublish(song.id),
      () => {
        setSong({ ...song, is_live: false });
        setPublished(null);
        notify({ type: "success", text: "已下架" });
      },
      "下架失败",
    );
  }, [changeState, song]);

  const deleteSong = useCallback(async () => {
    if (!song) return;
    await changeState(
      () => handleDeleteSong(song.id),
      () => {
        notify({ type: "success", text: "已删除" });
        router.replace("/admin/songs");
      },
      "删除失败",
    );
  }, [changeState, router, song]);

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
    isChangingState,
    publishStatus,
    changedFields,
    autoComplete,
    save,
    publish,
    discard,
    discardDraft,
    unpublish,
    deleteSong,
    runAutoComplete,
    selectSearchResult,
  };
}

export type SongWorkspaceState = ReturnType<typeof useSongWorkspace>;
