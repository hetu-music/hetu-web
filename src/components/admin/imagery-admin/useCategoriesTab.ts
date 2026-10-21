"use client";

import {
  apiCreateImageryCategory,
  apiUpdateImageryCategory,
} from "@/lib/api/client-api";
import { toCategoryPayload } from "@/lib/forms/imagery-form";
import type { ImageryCategory } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";
import type { CategoryFormValues } from "@/lib/forms/imagery-form";
import {
  IMAGERY_KEYS,
  useImageryCategoriesQuery,
  useUpdateCache,
} from "./queries";
import type { ModalState } from "./types";
import { buildTree, getCategoryPath } from "./utils";

export function useCategoriesTab(
  initialCategories: ImageryCategory[],
  showToast: (type: "success" | "error", text: string) => void,
) {
  const categoriesQuery = useImageryCategoriesQuery(initialCategories);
  const categories = categoriesQuery.data ?? initialCategories;
  const setCategories = useUpdateCache<ImageryCategory>(
    IMAGERY_KEYS.categories,
  );
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryTree = useMemo(() => buildTree(categories), [categories]);

  const openAdd = (parentId?: number) =>
    setModal({ type: "add-category", parentId });
  const openEdit = (category: ImageryCategory) =>
    setModal({ type: "edit-category", category });
  const closeModal = () => setModal({ type: "none" });

  const handleAdd = async (values: CategoryFormValues) => {
    setIsSubmitting(true);
    try {
      const created = await apiCreateImageryCategory(
        toCategoryPayload(values, categories),
      );
      setCategories((current) => [...current, created]);
      showToast("success", `分类「${created.name}」已创建`);
      closeModal();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "创建分类失败",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (values: CategoryFormValues) => {
    if (modal.type !== "edit-category") return;
    setIsSubmitting(true);
    try {
      const updated = await apiUpdateImageryCategory(
        modal.category.id,
        toCategoryPayload(values, categories),
      );
      setCategories((current) =>
        current.map((category) =>
          category.id === updated.id ? updated : category,
        ),
      );
      showToast("success", "分类已更新");
      closeModal();
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "更新分类失败",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryPathFn = useCallback(
    (id: number) => getCategoryPath(id, categories),
    [categories],
  );

  return {
    categories,
    categoryTree,
    modal,
    isSubmitting,
    openAdd,
    openEdit,
    closeModal,
    handleAdd,
    handleEdit,
    getCategoryPathFn,
  };
}
