"use client";

import { useMemo } from "react";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import type { ImageryCategory } from "@/lib/types";
import { EmptyState } from "../kit/parts";
import { SOLID_BUTTON_CLASS, TEXT_BUTTON_CLASS } from "../kit/styles";
import { showToast } from "../kit/toast";
import { CategoryTreeNode } from "./CategoryTree";
import { CategoryFormDialog } from "./ImageryDialogs";
import ImageryShell from "./ImageryShell";
import { useCategoriesTab } from "./useCategoriesTab";
import { useImageryTab } from "./useImageryTab";

/** 意象分类树：一级分类各占一栏，下面逐级展开 */
export default function ImageryCategoriesClient({
  initialCategories,
}: {
  initialCategories: ImageryCategory[];
}) {
  const csrfToken = useCsrfToken();
  const categories = useCategoriesTab(initialCategories, csrfToken, showToast);
  // 只用来数每个分类下有多少意象
  const imagery = useImageryTab(csrfToken, showToast);
  const list = categories.categories;

  const countByCategory = useMemo(() => {
    const parentOf = new Map(list.map((c) => [c.id, c.parent_id]));
    const counts = new Map<number, number>();
    for (const item of imagery.items) {
      for (const categoryId of item.categoryIds) {
        // 意象挂在叶子上，祖先分类也各记一次
        let current: number | null | undefined = categoryId;
        while (current) {
          counts.set(current, (counts.get(current) ?? 0) + 1);
          current = parentOf.get(current);
        }
      }
    }
    return counts;
  }, [imagery.items, list]);

  const levelCount = (level: number) =>
    list.filter((c) => (c.level ?? 1) === level).length;
  const parentIds = new Set(list.map((c) => c.parent_id));
  const leafCount = list.filter((c) => !parentIds.has(c.id)).length;

  return (
    <ImageryShell
      sub="categories"
      stats={[
        { label: "分类", value: list.length },
        { label: "一级", value: levelCount(1) },
        { label: "二级", value: levelCount(2) },
        { label: "叶子", value: leafCount },
      ]}
      actions={
        <button
          type="button"
          onClick={() => categories.openAdd()}
          className={SOLID_BUTTON_CLASS}
        >
          新增顶级分类
        </button>
      }
    >
      {categories.categoryTree.length === 0 ? (
        <EmptyState>还没有分类</EmptyState>
      ) : (
        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {categories.categoryTree.map((node) => (
            <section key={node.id} className="min-w-0">
              <div className="flex items-baseline gap-3 border-b border-slate-200/70 pb-2 dark:border-slate-800">
                <h2 className="min-w-0 flex-1 truncate font-serif text-base text-slate-900 dark:text-slate-100">
                  {node.name}
                  <span className="ml-2 text-xs tabular-nums text-slate-400">
                    {countByCategory.get(node.id) ?? 0}
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => categories.openAdd(node.id)}
                  className={TEXT_BUTTON_CLASS}
                >
                  加子类
                </button>
                <button
                  type="button"
                  onClick={() => categories.openEdit(node)}
                  className={TEXT_BUTTON_CLASS}
                >
                  编辑
                </button>
              </div>
              {node.children.length > 0 && (
                <div className="mt-2">
                  {node.children.map((child) => (
                    <CategoryTreeNode
                      key={child.id}
                      node={child}
                      depth={0}
                      imageryCountByCategory={countByCategory}
                      onAddChild={categories.openAdd}
                      onEdit={categories.openEdit}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <CategoryFormDialog
        modal={categories.modal}
        categories={list}
        submitting={categories.isSubmitting}
        getCategoryPath={categories.getCategoryPathFn}
        onClose={categories.closeModal}
        onAdd={categories.handleAdd}
        onEdit={categories.handleEdit}
      />
    </ImageryShell>
  );
}
