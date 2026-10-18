"use client";

/**
 * ⚠️ 后台「含义」Tab：新增/编辑目前存不进去。
 *
 * imagery_meanings.imagery_id 是 NOT NULL 外键，而这里走的全局接口
 * （/api/admin/meanings）不会传它，插入会被数据库拒掉——这也是该表一直为空的原因。
 * 释义子系统的设计方向尚未确定，详见 lib/server/service-imagery.ts 中
 * getImageryMeanings 上方的说明。暂不投入，等真正要用时再一并设计。
 */

import {
  apiCreateGlobalMeaning,
  apiDeleteGlobalMeaning,
  apiUpdateGlobalMeaning,
} from "@/lib/api/client-api";
import { toMeaningPayload } from "@/lib/forms/imagery-form";
import type { MeaningFormValues } from "@/lib/forms/imagery-form";
import type { ImageryMeaning } from "@/lib/types";
import { useMemo, useState } from "react";
import {
  IMAGERY_KEYS,
  useImageryMeaningsQuery,
  useUpdateCache,
} from "./queries";

const NO_MEANINGS: ImageryMeaning[] = [];

const PAGE_SIZE = 20;

export function useMeaningsTab(
  csrfToken: string,
  showToast: (type: "success" | "error", text: string) => void,
) {
  const meaningsQuery = useImageryMeaningsQuery();
  const meanings = meaningsQuery.data ?? NO_MEANINGS;
  const setMeanings = useUpdateCache<ImageryMeaning>(IMAGERY_KEYS.meanings);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [addingMeaning, setAddingMeaning] = useState(false);
  const [editingMeaningId, setEditingMeaningId] = useState<number | null>(null);
  const [meaningSubmitting, setMeaningSubmitting] = useState(false);

  const filteredMeanings = useMemo(() => {
    if (!searchTerm.trim()) return meanings;
    const query = searchTerm.trim().toLowerCase();
    return meanings.filter((meaning) =>
      `${meaning.label} ${meaning.description ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [meanings, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMeanings.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedMeanings = useMemo(
    () =>
      filteredMeanings.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredMeanings],
  );

  const editingMeaning = useMemo(
    () =>
      editingMeaningId
        ? (meanings.find((m) => m.id === editingMeaningId) ?? null)
        : null,
    [editingMeaningId, meanings],
  );

  const startAdd = () => {
    setAddingMeaning(true);
    setEditingMeaningId(null);
  };
  const startEdit = (meaning: ImageryMeaning) => {
    setAddingMeaning(false);
    setEditingMeaningId(meaning.id);
  };
  const resetEditor = () => {
    setAddingMeaning(false);
    setEditingMeaningId(null);
  };

  const handleCreate = async (values: MeaningFormValues) => {
    if (meaningSubmitting) return;
    setMeaningSubmitting(true);
    try {
      const created = await apiCreateGlobalMeaning(
        toMeaningPayload(values),
        csrfToken,
      );
      setMeanings((current) =>
        [...current, created].sort((a, b) =>
          a.label.localeCompare(b.label, "zh-CN"),
        ),
      );
      resetEditor();
      showToast("success", `含义「${created.label}」已创建`);
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "创建含义失败",
      );
    } finally {
      setMeaningSubmitting(false);
    }
  };

  const handleUpdate = async (values: MeaningFormValues) => {
    if (!editingMeaningId || meaningSubmitting) return;
    setMeaningSubmitting(true);
    try {
      const updated = await apiUpdateGlobalMeaning(
        editingMeaningId,
        toMeaningPayload(values),
        csrfToken,
      );
      setMeanings((current) =>
        current
          .map((m) => (m.id === editingMeaningId ? updated : m))
          .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      );
      resetEditor();
      showToast("success", "含义已更新");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "更新含义失败",
      );
    } finally {
      setMeaningSubmitting(false);
    }
  };

  const handleDelete = async (meaning: ImageryMeaning) => {
    if (meaningSubmitting) return;
    setMeaningSubmitting(true);
    try {
      await apiDeleteGlobalMeaning(meaning.id, csrfToken);
      setMeanings((current) => current.filter((m) => m.id !== meaning.id));
      if (editingMeaningId === meaning.id) resetEditor();
      showToast("success", `已删除含义「${meaning.label}」`);
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "删除含义失败",
      );
    } finally {
      setMeaningSubmitting(false);
    }
  };

  return {
    meanings,
    meaningsLoading: meaningsQuery.isPending,
    meaningsError: meaningsQuery.error?.message ?? null,
    refetchMeanings: meaningsQuery.refetch,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    addingMeaning,
    editingMeaningId,
    editingMeaning,
    meaningSubmitting,
    pagedMeanings,
    currentPage,
    totalPages,
    startAdd,
    startEdit,
    resetEditor,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
