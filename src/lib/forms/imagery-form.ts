import { z } from "zod";
import type { ImageryCategory } from "@/lib/types";

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value : value == null ? "" : String(value);

/**
 * 母题表单。后台只增改母题（第三级）：挂在某个类别下，说明必填（见 IMAGERY.md）。
 * 门类与类别固定，词在标注时按歌词原文创建，都没有表单。
 */
export const motifFormSchema = z.object({
  name: z.preprocess(
    normalizeString,
    z
      .string()
      .trim()
      .min(1, "母题名称不能为空")
      .max(50, "母题名称不能超过 50 个字"),
  ),
  parent_id: z.number({ error: "选择所属类别" }).int().positive(),
  description: z.preprocess(
    normalizeString,
    z
      .string()
      .trim()
      .min(1, "写一句这个母题指什么")
      .max(500, "说明不能超过 500 个字"),
  ),
});

export type MotifFormValues = z.input<typeof motifFormSchema>;
export type MotifPayload = z.output<typeof motifFormSchema>;

export function createMotifFormValues(
  motif?: Partial<ImageryCategory>,
): MotifFormValues {
  return {
    name: motif?.name ?? "",
    parent_id: typeof motif?.parent_id === "number" ? motif.parent_id : 0,
    description: motif?.description ?? "",
  };
}
