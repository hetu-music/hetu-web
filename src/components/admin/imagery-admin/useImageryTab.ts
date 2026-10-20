"use client";

import { apiCreateImagery, apiUpdateImagery } from "@/lib/api/client-api";
import type { ImageryItem } from "@/lib/types";
import { useMemo, useState } from "react";
import type { ImageryFormValues } from "@/lib/forms/imagery-form";
import { IMAGERY_KEYS, useImageryItemsQuery, useUpdateCache } from "./queries";
import type { ModalState } from "./types";

const NO_ITEMS: ImageryItem[] = [];

const PAGE_SIZE = 20;

export function useImageryTab(
  showToast: (type: "success" | "error", text: string) => void,
) {
  const itemsQuery = useImageryItemsQuery();
  const items = itemsQuery.data ?? NO_ITEMS;
  const setItems = useUpdateCache<ImageryItem>(IMAGERY_KEYS.items);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [searchTerm, items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () =>
      filteredItems.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [currentPage, filteredItems],
  );

  const openAdd = () => setModal({ type: "add-imagery" });
  const openEdit = (item: ImageryItem) =>
    setModal({ type: "edit-imagery", item });
  const closeModal = () => setModal({ type: "none" });

  const handleAdd = async ({ name }: ImageryFormValues) => {
    setIsSubmitting(true);
    try {
      const created = await apiCreateImagery(name.trim());
      setItems((current) => [
        ...current,
        { ...created, count: 0, categoryIds: [], meaningCount: 0 },
      ]);
      showToast("success", `意象「${created.name}」已创建`);
      closeModal();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "创建意象失败",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async ({ name }: ImageryFormValues) => {
    if (modal.type !== "edit-imagery") return;
    setIsSubmitting(true);
    try {
      await apiUpdateImagery(modal.item.id, name.trim());
      setItems((current) =>
        current.map((item) =>
          item.id === modal.item.id ? { ...item, name: name.trim() } : item,
        ),
      );
      showToast("success", "意象已更新");
      closeModal();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "更新意象失败",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    items,
    itemsLoading: itemsQuery.isPending,
    itemsError: itemsQuery.error?.message ?? null,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    modal,
    setModal,
    isSubmitting,
    pagedItems,
    currentPage,
    totalPages,
    refreshItems: itemsQuery.refetch,
    openAdd,
    openEdit,
    closeModal,
    handleAdd,
    handleEdit,
  };
}
