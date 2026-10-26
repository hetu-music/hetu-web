import { z } from "zod";
import type { ImageryCategory, ImageryItem } from "@/lib/types";

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value : value == null ? "" : String(value);

export const imageryFormSchema = z.object({
  name: z.preprocess(
    normalizeString,
    z
      .string()
      .trim()
      .min(1, "意象名称不能为空")
      .max(50, "意象名称不能超过50个字符"),
  ),
});

export const categoryFormSchema = z.object({
  name: z.preprocess(
    normalizeString,
    z.string().trim().min(1, "分类名称不能为空"),
  ),
  parent_id: z.number().int().positive().nullable(),
  description: z.preprocess(
    normalizeString,
    z.string().max(500, "描述不能超过500个字符"),
  ),
});

export type ImageryFormValues = z.infer<typeof imageryFormSchema>;
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function createImageryFormValues(
  item?: Pick<ImageryItem, "name">,
): ImageryFormValues {
  return {
    name: item?.name ?? "",
  };
}

export function createCategoryFormValues(
  category?: Partial<ImageryCategory>,
): CategoryFormValues {
  return {
    name: category?.name ?? "",
    parent_id:
      typeof category?.parent_id === "number" ? category.parent_id : null,
    description: category?.description ?? "",
  };
}

export function toCategoryPayload(
  values: CategoryFormValues,
  categories: ImageryCategory[],
) {
  const parent = values.parent_id
    ? categories.find((category) => category.id === values.parent_id)
    : null;

  return {
    name: values.name.trim(),
    parent_id: values.parent_id,
    level: parent ? (parent.level ?? 1) + 1 : 1,
    description: values.description.trim() || null,
  };
}
