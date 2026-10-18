"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import Pagination from "@/components/shared/Pagination";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import {
  createMeaningFormValues,
  meaningFormSchema,
  type MeaningFormValues,
} from "@/lib/forms/imagery-form";
import { cn } from "@/lib/utils/utils";
import {
  ConfirmButton,
  EmptyState,
  LoadingState,
  SearchInput,
} from "../kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  TEXT_PRIMARY_CLASS,
} from "../kit/styles";
import { showToast } from "../kit/toast";
import ImageryShell from "./ImageryShell";
import { useMeaningsTab } from "./useMeaningsTab";

function MeaningEditor({
  initialValues,
  submitting,
  saveLabel,
  onSave,
  onCancel,
}: {
  initialValues: MeaningFormValues;
  submitting: boolean;
  saveLabel: string;
  onSave: (values: MeaningFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<MeaningFormValues>({
    resolver: zodResolver(meaningFormSchema) as Resolver<MeaningFormValues>,
    defaultValues: initialValues,
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSave(values))}
      className="space-y-4 border-b border-l-2 border-b-slate-200/70 border-l-(--tone) py-4 pl-4 dark:border-b-slate-800"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>含义名称</span>
          <input
            type="text"
            autoFocus
            {...form.register("label")}
            className={INPUT_CLASS}
          />
          {form.formState.errors.label && (
            <span className="block text-xs text-rose-500">
              {form.formState.errors.label.message}
            </span>
          )}
        </label>
        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>描述</span>
          <textarea
            rows={2}
            placeholder="可选"
            {...form.register("description")}
            className={cn(INPUT_CLASS, "resize-y")}
          />
          {form.formState.errors.description && (
            <span className="block text-xs text-rose-500">
              {form.formState.errors.description.message}
            </span>
          )}
        </label>
      </div>
      <div className="flex justify-end gap-4">
        <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || form.formState.isSubmitting}
          className={SOLID_BUTTON_CLASS}
        >
          {saveLabel}
        </button>
      </div>
    </form>
  );
}

/** 全局含义库 */
export default function ImageryMeaningsClient() {
  const csrfToken = useCsrfToken();
  const m = useMeaningsTab(csrfToken, showToast);

  return (
    <ImageryShell
      sub="meanings"
      stats={[{ label: "含义", value: m.meanings.length }]}
      actions={
        <button
          type="button"
          onClick={m.startAdd}
          className={SOLID_BUTTON_CLASS}
        >
          新增含义
        </button>
      }
      search={
        <SearchInput
          value={m.searchTerm}
          onChange={(value) => {
            m.setSearchTerm(value);
            m.setPage(1);
          }}
          placeholder="搜索含义名称或描述"
        />
      }
    >
      {m.meaningsLoading ? (
        <LoadingState text="加载含义中…" />
      ) : (
        <>
          {m.addingMeaning && (
            <MeaningEditor
              initialValues={createMeaningFormValues()}
              submitting={m.meaningSubmitting}
              saveLabel="创建"
              onSave={m.handleCreate}
              onCancel={m.resetEditor}
            />
          )}

          {m.pagedMeanings.length === 0 && !m.addingMeaning ? (
            <EmptyState>
              {m.searchTerm ? "没有找到匹配的含义" : "还没有含义"}
            </EmptyState>
          ) : (
            <ol>
              {m.pagedMeanings.map((meaning) =>
                m.editingMeaning?.id === meaning.id ? (
                  <li key={meaning.id}>
                    <MeaningEditor
                      initialValues={createMeaningFormValues(m.editingMeaning)}
                      submitting={m.meaningSubmitting}
                      saveLabel="保存"
                      onSave={m.handleUpdate}
                      onCancel={m.resetEditor}
                    />
                  </li>
                ) : (
                  <li
                    key={meaning.id}
                    className="group flex items-baseline gap-4 border-b border-slate-200/70 py-3 dark:border-slate-800"
                  >
                    <span className="w-40 shrink-0 text-slate-900 dark:text-slate-100">
                      {meaning.label}
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap font-kaiti text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {meaning.description || "—"}
                    </span>
                    <span className="flex shrink-0 gap-4 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => m.startEdit(meaning)}
                        className={TEXT_PRIMARY_CLASS}
                      >
                        编辑
                      </button>
                      <ConfirmButton
                        onConfirm={() => void m.handleDelete(meaning)}
                        disabled={m.meaningSubmitting}
                      />
                    </span>
                  </li>
                ),
              )}
            </ol>
          )}
        </>
      )}

      {m.totalPages > 1 && (
        <div className="mt-10 flex justify-center">
          <Pagination
            currentPage={m.currentPage}
            totalPages={m.totalPages}
            onPageChange={m.setPage}
          />
        </div>
      )}
    </ImageryShell>
  );
}
