import type { CollationKind, SongCollation, SupplementKind } from "@/lib/types";
import {
  type AnchorContext,
  COMMENT_QUOTE_MAX,
  resolveSlot,
} from "@/lib/utils/utils-comments";
import { z } from "zod";

/**
 * 校记：管理员写在某句歌词上的勘误。位置与批注同一套存法，
 * 歌词改动后按原句找回那一行；找不回的不再写到句下，只在后台列出待处理。
 * 补遗：记在整首歌上的资料（版本、旧稿），与校记同表，anchor 为 song。
 */

/** 显示顺序；名字在文案 song.folio.collations.kinds 里 */
export const COLLATION_KINDS = [
  "slip",
  "sung",
  "version",
  "note",
] as const satisfies readonly CollationKind[];

export const COLLATION_QUOTE_MAX = 100;
export const COLLATION_BODY_MAX = 1000;

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

export const SUPPLEMENT_KINDS = [
  "release",
  "draft",
  "note",
] as const satisfies readonly SupplementKind[];

/** 旧稿可能整段照录 */
export const SUPPLEMENT_BODY_MAX = 4000;

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

/** 补遗按日期排，只到年的排在该年最前；没有日期的排最后，同日按录入先后 */
export function sortSupplements(list: SongCollation[]): SongCollation[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? -1 : 1;
    }
    return a.id - b.id;
  });
}

export interface ResolvedCollation {
  collation: SongCollation;
  /** 所校的那一行；原句已改动、找不回时为 null */
  line: number | null;
}

/**
 * 把校记归到歌词的各行：按行排，同一行按录入先后；找不回的排在最后。
 * byLine 给正文用：每行写在句下的校记，顺序同上。
 */
export function resolveCollations(
  collations: SongCollation[],
  ctx: AnchorContext,
): {
  entries: ResolvedCollation[];
  byLine: Map<number, SongCollation[]>;
} {
  const entries = collations.map((collation) => {
    const { slot, orphan } = resolveSlot(collation, ctx);
    return {
      collation,
      line: !orphan && slot.section === "lyrics" ? slot.line : null,
    };
  });
  entries.sort(
    (a, b) =>
      (a.line ?? Infinity) - (b.line ?? Infinity) ||
      a.collation.id - b.collation.id,
  );
  const byLine = new Map<number, SongCollation[]>();
  for (const { collation, line } of entries) {
    if (line === null) continue;
    byLine.set(line, [...(byLine.get(line) ?? []), collation]);
  }
  return { entries, byLine };
}
