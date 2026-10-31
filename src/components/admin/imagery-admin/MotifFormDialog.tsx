"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  createMotifFormValues,
  type MotifFormValues,
  type MotifPayload,
  motifFormSchema,
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

export type MotifFormTarget =
  { type: "add"; parentId: number } | { type: "edit"; motif: ImageryCategory };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-rose-500">{message}</p>;
}

/** 新增、编辑母题：名称、所属类别、一句说明（必填） */
export default function MotifFormDialog({
  target,
  categories,
  submitting,
  onClose,
  onSubmit,
}: {
  target: MotifFormTarget | null;
  categories: ImageryCategory[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: MotifPayload) => void | Promise<void>;
}) {
  const form = useForm<MotifFormValues, unknown, MotifPayload>({
    resolver: zodResolver(motifFormSchema),
    defaultValues: createMotifFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (target?.type === "add") {
      form.reset(createMotifFormValues({ parent_id: target.parentId }));
    } else if (target?.type === "edit") {
      form.reset(createMotifFormValues(target.motif));
    }
  }, [form, target]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  // 母题只能放在类别（第二级）下，选项写成「门类 / 类别」
  const parents = categories
    .filter((c) => c.level === 2)
    .map((c) => {
      const top = c.parent_id === null ? undefined : byId.get(c.parent_id);
      return { id: c.id, label: top ? `${top.name} / ${c.name}` : c.name };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  const busy = submitting || form.formState.isSubmitting;
  const editing = target?.type === "edit" ? target.motif : null;

  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? `编辑母题 · ${editing.name}` : "新增母题"}
      footer={
        <>
          <button type="button" onClick={onClose} className={TEXT_BUTTON_CLASS}>
            取消
          </button>
          <button
            type="submit"
            form="motif-form"
            disabled={busy}
            className={SOLID_BUTTON_CLASS}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            保存
          </button>
        </>
      }
    >
      <form
        id="motif-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        className="space-y-5"
      >
        <div>
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>
              母题 <span className="text-rose-500">*</span>
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

        <div>
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>
              所属类别 <span className="text-rose-500">*</span>
            </span>
            <select
              {...form.register("parent_id", { valueAsNumber: true })}
              className={SELECT_CLASS}
            >
              <option value={0} disabled>
                选择类别…
              </option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <FieldError message={form.formState.errors.parent_id?.message} />
        </div>

        <div>
          <label className="block space-y-1.5">
            <span className={LABEL_CLASS}>
              说明 <span className="text-rose-500">*</span>
            </span>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="一句话说它指什么，例如：汗水、汗珠"
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
