"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  type CategoryFormValues,
  categoryFormSchema,
  createCategoryFormValues,
  createImageryFormValues,
  type ImageryFormValues,
  imageryFormSchema,
} from "@/lib/forms/imagery-form";
import type { ImageryCategory } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SELECT_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import type { ModalState } from "./types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rose-500">{message}</p>;
}

function Footer({
  formId,
  submitting,
  label,
  onCancel,
}: {
  formId: string;
  submitting: boolean;
  label: string;
  onCancel: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
        取消
      </button>
      <button
        type="submit"
        form={formId}
        disabled={submitting}
        className={SOLID_BUTTON_CLASS}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {label}
      </button>
    </>
  );
}

/** 新增、改名意象词条 */
export function ImageryFormDialog({
  modal,
  submitting,
  onClose,
  onAdd,
  onEdit,
}: {
  modal: ModalState;
  submitting: boolean;
  onClose: () => void;
  onAdd: (values: ImageryFormValues) => void | Promise<void>;
  onEdit: (values: ImageryFormValues) => void | Promise<void>;
}) {
  const open = modal.type === "add-imagery" || modal.type === "edit-imagery";
  const form = useForm<ImageryFormValues>({
    resolver: zodResolver(imageryFormSchema) as Resolver<ImageryFormValues>,
    defaultValues: createImageryFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (modal.type === "add-imagery") form.reset(createImageryFormValues());
    else if (modal.type === "edit-imagery")
      form.reset(createImageryFormValues(modal.item));
  }, [form, modal]);

  const busy = submitting || form.formState.isSubmitting;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={
        modal.type === "edit-imagery"
          ? `编辑意象 · ${modal.item.name}`
          : "新增意象"
      }
      footer={
        <Footer
          formId="imagery-form"
          submitting={busy}
          label={modal.type === "add-imagery" ? "创建" : "保存"}
          onCancel={onClose}
        />
      }
    >
      <form
        id="imagery-form"
        onSubmit={form.handleSubmit((values) =>
          modal.type === "add-imagery" ? onAdd(values) : onEdit(values),
        )}
      >
        <label className="block space-y-1.5">
          <span className={LABEL_CLASS}>
            意象名称 <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            placeholder="如：明月、江水、枫叶…"
            maxLength={50}
            autoFocus
            {...form.register("name")}
            className={INPUT_CLASS}
          />
        </label>
        <FieldError message={form.formState.errors.name?.message} />
      </form>
    </ResponsiveDialog>
  );
}

/** 新增、编辑分类 */
export function CategoryFormDialog({
  modal,
  categories,
  submitting,
  getCategoryPath,
  onClose,
  onAdd,
  onEdit,
}: {
  modal: ModalState;
  categories: ImageryCategory[];
  submitting: boolean;
  getCategoryPath: (categoryId: number) => string;
  onClose: () => void;
  onAdd: (values: CategoryFormValues) => void | Promise<void>;
  onEdit: (values: CategoryFormValues) => void | Promise<void>;
}) {
  const open = modal.type === "add-category" || modal.type === "edit-category";
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema) as Resolver<CategoryFormValues>,
    defaultValues: createCategoryFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (modal.type === "add-category") {
      form.reset(
        createCategoryFormValues({ parent_id: modal.parentId ?? null }),
      );
    } else if (modal.type === "edit-category") {
      form.reset(createCategoryFormValues(modal.category));
    }
  }, [form, modal]);

  const editing = modal.type === "edit-category" ? modal.category : null;
  const currentLevel = editing?.level ?? 1;
  // 编辑时只能在同一层级的父分类间调整；新增时可挂到任何 L1、L2 下
  const parentOptions = categories.filter((c) =>
    editing
      ? c.id !== editing.id && (c.level ?? 1) === currentLevel - 1
      : (c.level ?? 1) < 3,
  );
  const busy = submitting || form.formState.isSubmitting;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? `编辑分类 · ${editing.name}` : "新增分类"}
      footer={
        <Footer
          formId="category-form"
          submitting={busy}
          label="保存"
          onCancel={onClose}
        />
      }
    >
      <form
        id="category-form"
        onSubmit={form.handleSubmit((values) =>
          editing ? onEdit(values) : onAdd(values),
        )}
        className="space-y-5"
      >
        <div>
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>
              分类名称 <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              autoFocus
              {...form.register("name")}
              className={INPUT_CLASS}
            />
          </label>
          <FieldError message={form.formState.errors.name?.message} />
        </div>

        <div className="space-y-1.5">
          <span className={LABEL_CLASS}>父分类</span>
          {editing && currentLevel === 1 ? (
            <p className={cn(INPUT_CLASS, "cursor-not-allowed text-slate-400")}>
              （顶级分类）
            </p>
          ) : (
            <select
              aria-label="父分类"
              {...form.register("parent_id", {
                setValueAs: (value) => (value ? Number(value) : null),
              })}
              className={SELECT_CLASS}
            >
              {(!editing || currentLevel <= 1) && (
                <option value="">（顶级分类）</option>
              )}
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {getCategoryPath(category.id)}
                </option>
              ))}
            </select>
          )}
          {editing && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              编辑时只能在同级分类间调整父分类
            </p>
          )}
        </div>

        <div>
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>描述</span>
            <textarea
              rows={3}
              maxLength={500}
              {...form.register("description")}
              className={cn(INPUT_CLASS, "resize-y")}
            />
          </label>
          <FieldError message={form.formState.errors.description?.message} />
        </div>
      </form>
    </ResponsiveDialog>
  );
}
