import { z } from "zod";
import { COMMENT_QUOTE_MAX } from "@/lib/utils/utils-comments";
import {
  COLLATION_BODY_MAX,
  COLLATION_KINDS,
  COLLATION_QUOTE_MAX,
  SUPPLEMENT_BODY_MAX,
  SUPPLEMENT_KINDS,
} from "@/lib/utils/utils-collations";

/** 后台写校记、补遗的校验规则；接口收到请求体时再校验一遍 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}不能超过 ${max} 个字`)
    .nullish()
    .transform((v) => v || null);

/** 后台新增、修改一条歌词校记的内容 */
export const collationInputSchema = z
  .object({
    kind: z.enum(COLLATION_KINDS),
    anchor_index: z.number().int().min(0),
    anchor_time: z.number().min(0).nullable(),
    anchor_quote: z.string().min(1).max(COMMENT_QUOTE_MAX),
    quote: optionalText(COLLATION_QUOTE_MAX, "原文"),
    sung: optionalText(COLLATION_QUOTE_MAX, "实唱"),
    body: z
      .string()
      .trim()
      .max(COLLATION_BODY_MAX, `说明不能超过 ${COLLATION_BODY_MAX} 个字`),
  })
  .refine((v) => !v.sung || v.quote, {
    message: "填了实唱，也要填原文",
    path: ["quote"],
  })
  .refine((v) => v.body || v.sung, {
    message: "实唱与说明至少填一项",
    path: ["body"],
  });

export type CollationInput = z.infer<typeof collationInputSchema>;
/** 后台发出的请求体，校验与去空白之前 */
export type CollationPayload = z.input<typeof collationInputSchema>;

const DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** 后台新增、修改一条补遗的内容 */
export const supplementInputSchema = z.object({
  kind: z.enum(SUPPLEMENT_KINDS),
  date: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null)
    .refine((v) => v === null || DATE_PATTERN.test(v), {
      message: "日期写成 2019、2019-08 或 2019-08-15",
    }),
  body: z
    .string()
    .trim()
    .min(1, "内容不能为空")
    .max(SUPPLEMENT_BODY_MAX, `内容不能超过 ${SUPPLEMENT_BODY_MAX} 个字`),
});

export type SupplementInput = z.infer<typeof supplementInputSchema>;
export type SupplementPayload = z.input<typeof supplementInputSchema>;
