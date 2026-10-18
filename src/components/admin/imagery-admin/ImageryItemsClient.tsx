"use client";

import { useMemo } from "react";
import Pagination from "@/components/shared/Pagination";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import type { ImageryCategory } from "@/lib/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from "../kit/parts";
import {
  META_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_PRIMARY_CLASS,
} from "../kit/styles";
import { showToast } from "../kit/toast";
import { ImageryFormDialog } from "./ImageryDialogs";
import ImageryShell from "./ImageryShell";
import { useImageryTab } from "./useImageryTab";

/** 意象词条：名称、用量、所属分类 */
export default function ImageryItemsClient({
  categories,
}: {
  categories: ImageryCategory[];
}) {
  const csrfToken = useCsrfToken();
  const imagery = useImageryTab(csrfToken, showToast);
  const nameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const unused = imagery.items.filter((i) => i.count === 0).length;

  return (
    <ImageryShell
      sub="items"
      stats={[
        { label: "词条", value: imagery.items.length },
        { label: "分类", value: categories.length },
        { label: "未使用", value: unused },
      ]}
      actions={
        <button
          type="button"
          onClick={imagery.openAdd}
          className={SOLID_BUTTON_CLASS}
        >
          新增意象
        </button>
      }
      search={
        <SearchInput
          value={imagery.searchTerm}
          onChange={(value) => {
            imagery.setSearchTerm(value);
            imagery.setPage(1);
          }}
          placeholder="搜索意象名称"
        />
      }
    >
      {imagery.itemsLoading ? (
        <LoadingState text="加载意象中…" />
      ) : imagery.itemsError ? (
        <ErrorState
          message={imagery.itemsError}
          onRetry={() => void imagery.refreshItems()}
        />
      ) : imagery.pagedItems.length === 0 ? (
        <EmptyState>
          {imagery.searchTerm ? "没有找到匹配的意象" : "还没有意象"}
        </EmptyState>
      ) : (
        <>
          <div
            className={`${META_CLASS} hidden grid-cols-[4rem_10rem_5rem_minmax(0,1fr)_4rem] gap-4 border-b border-slate-200/70 pb-2 md:grid dark:border-slate-800`}
          >
            <span className="text-right">#</span>
            <span>名称</span>
            <span className="text-right">用量</span>
            <span>分类</span>
            <span />
          </div>
          <ol>
            {imagery.pagedItems.map((item) => {
              const names = item.categoryIds
                .map((id) => nameById.get(id))
                .filter((v): v is string => Boolean(v));
              return (
                <li
                  key={item.id}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-slate-200/70 py-3 md:grid-cols-[4rem_10rem_5rem_minmax(0,1fr)_4rem] dark:border-slate-800"
                >
                  <span className="hidden text-right font-mono text-xs tabular-nums text-slate-400 md:block">
                    {item.id}
                  </span>
                  <span className="font-serif text-base text-slate-900 dark:text-slate-100">
                    {item.name}
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-slate-500 md:block dark:text-slate-400">
                    {item.count}
                  </span>
                  <span className="col-span-2 row-start-2 truncate text-xs text-slate-500 md:col-span-1 md:row-start-auto md:text-sm dark:text-slate-400">
                    <span className="md:hidden">{item.count} 首 · </span>
                    {names.length > 0 ? names.join("、") : "尚未关联分类"}
                  </span>
                  <button
                    type="button"
                    onClick={() => imagery.openEdit(item)}
                    className={`${TEXT_PRIMARY_CLASS} col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100`}
                  >
                    改名
                  </button>
                </li>
              );
            })}
          </ol>
          <Pagination
            className="mt-10"
            currentPage={imagery.currentPage}
            totalPages={imagery.totalPages}
            onPageChange={imagery.setPage}
          />
        </>
      )}

      <ImageryFormDialog
        modal={imagery.modal}
        submitting={imagery.isSubmitting}
        onClose={imagery.closeModal}
        onAdd={imagery.handleAdd}
        onEdit={imagery.handleEdit}
      />
    </ImageryShell>
  );
}
