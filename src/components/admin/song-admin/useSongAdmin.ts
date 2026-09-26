"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { handleApprove } from "@/app/actions/admin-actions";
import {
  mergeAutoCompleteData,
  useAutoComplete,
} from "@/hooks/admin/useAutoComplete";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
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
import type { OperationMessage, SongFormMode } from "./types";

const TOAST_DURATION_MS = 3000;
const NOTIFICATION_INTERVAL_MS = 3600000;
const NOTIFICATION_STORAGE_KEY = "lastNotificationTime";

type SetSongs = React.Dispatch<React.SetStateAction<SongDetail[]>>;

/**
 * 歌曲后台的全部表单状态与提交流程。
 *
 * 从 AdminClient 抽出：原先组件里混着分页、筛选、表单、发布、自动补全五类状态，
 * 这里只收表单与写操作相关的部分，列表/筛选仍由 useSongs 负责。
 */
export function useSongAdmin(setSongs: SetSongs) {
  const csrfToken = useCsrfToken();

  const [formMode, setFormMode] = useState<SongFormMode | null>(null);
  const [editSong, setEditSong] = useState<SongDetail | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [operationMsg, setOperationMsg] = useState<OperationMessage | null>(
    null,
  );
  const [showNotification, setShowNotification] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const songForm = useForm<SongFormStateValues>({
    resolver: zodResolver(songFormStateSchema) as Resolver<SongFormStateValues>,
    defaultValues: createEmptySongFormState(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  /** 弹出一条会自动消失的提示 */
  const notify = useCallback((message: OperationMessage) => {
    setOperationMsg(message);
    setTimeout(() => setOperationMsg(null), TOAST_DURATION_MS);
  }, []);

  const autoComplete = useAutoComplete(csrfToken, (msg) => {
    notify({ type: "error", text: msg });
  });

  // 距上次展示超过一小时才再次弹出使用说明
  useEffect(() => {
    const lastTime = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const now = Date.now();
    if (lastTime && now - parseInt(lastTime) <= NOTIFICATION_INTERVAL_MS) {
      return;
    }
    const timer = setTimeout(() => {
      setShowNotification(true);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, now.toString());
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleRowExpansion = useCallback((id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 展开行：新增或发布歌曲后直接露出意象标注区 */
  const expandRow = useCallback((id: number) => {
    setExpandedRows((prev) => new Set(prev).add(id));
  }, []);

  const closeSongForm = useCallback(() => {
    setFormMode(null);
    setEditSong(null);
    autoComplete.reset();
    songForm.reset(createEmptySongFormState());
  }, [autoComplete, songForm]);

  const openAddForm = useCallback(() => {
    setEditSong(null);
    setFormMode("add");
    autoComplete.reset();
    songForm.reset(createEmptySongFormState());
  }, [autoComplete, songForm]);

  const startEdit = useCallback(
    (song: SongDetail) => {
      setEditSong(song);
      setFormMode("edit");
      autoComplete.reset();
      songForm.reset(toSongFormState(song));
    },
    [autoComplete, songForm],
  );

  /** 缺少 CSRF token 时统一提示，返回 false 表示应中止 */
  const requireCsrfToken = useCallback((): boolean => {
    if (csrfToken) return true;
    notify({ type: "error", text: "缺少安全令牌，请刷新后重试" });
    return false;
  }, [csrfToken, notify]);

  const handleSongSubmit = songForm.handleSubmit(async (data) => {
    if (!requireCsrfToken()) return;

    const payload = convertEmptyStringToNull(toSongFormPayload(data));

    try {
      if (formMode === "add") {
        const created = await apiCreateSong(payload, csrfToken);
        setSongs((prev) => [...prev, created]);
        expandRow(created.id);
        closeSongForm();
        notify({ type: "success", text: "创建成功" });
      } else if (formMode === "edit" && editSong) {
        const updated = await apiUpdateSong(
          editSong.id,
          { ...payload, updated_at: editSong.updated_at },
          csrfToken,
        );
        setSongs((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
        closeSongForm();
        notify({ type: "success", text: "更新成功" });
      }
    } catch (err: unknown) {
      notify({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : formMode === "add"
              ? "创建失败"
              : "更新失败",
      });
    }
  });

  /** 点击发布先跑校验，通过后才弹二次确认 */
  const handlePublishClick = useCallback(async () => {
    if (!editSong) return;
    if (await songForm.trigger()) setShowPublishConfirm(true);
  }, [editSong, songForm]);

  /** 确认发布：先存暂存表，再调同步 Server Action */
  const handlePublish = useCallback(async () => {
    if (!editSong) return;
    if (!requireCsrfToken()) return;

    setIsPublishing(true);
    const payload = convertEmptyStringToNull(
      toSongFormPayload(songForm.getValues()),
    );

    try {
      const updated = await apiUpdateSong(
        editSong.id,
        { ...payload, updated_at: editSong.updated_at },
        csrfToken,
      );

      const approveRes = await handleApprove(editSong.id);
      if (!approveRes.success) throw new Error(approveRes.error || "同步失败");

      setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      expandRow(updated.id);
      closeSongForm();
      notify({ type: "success", text: "发布成功" });
    } catch (err: unknown) {
      notify({
        type: "error",
        text: err instanceof Error ? err.message : "发布失败",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [
    closeSongForm,
    csrfToken,
    editSong,
    expandRow,
    notify,
    requireCsrfToken,
    setSongs,
    songForm,
  ]);

  const runAutoComplete = useCallback(
    async (provider: MusicProviderType) => {
      const values = toSongFormPayload(songForm.getValues());
      const artists = Array.isArray(values.artist) ? values.artist : undefined;
      await autoComplete.handleAutoComplete(provider, values.title, artists);
    },
    [autoComplete, songForm],
  );

  const selectSearchResult = useCallback(
    async (song: SearchResultItem) => {
      const data = await autoComplete.handleSelectSearchResult(song);
      if (!data) return;
      songForm.reset(
        toSongFormState(
          mergeAutoCompleteData(toSongFormPayload(songForm.getValues()), data),
        ),
      );
      notify({ type: "success", text: "自动补全成功" });
    },
    [autoComplete, notify, songForm],
  );

  return {
    csrfToken,
    songForm,
    autoComplete,
    formMode,
    editSong,
    expandedRows,
    operationMsg,
    showNotification,
    setShowNotification,
    isPublishing,
    showPublishConfirm,
    setShowPublishConfirm,
    toggleRowExpansion,
    openAddForm,
    closeSongForm,
    startEdit,
    handleSongSubmit,
    handlePublishClick,
    handlePublish,
    runAutoComplete,
    selectSearchResult,
  };
}
