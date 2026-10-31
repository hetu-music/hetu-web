import type { CollationKind, SongCollation } from "@/lib/types";
import {
  type AnchorContext,
  COMMENT_QUOTE_MAX,
  resolveSlot,
} from "@/lib/utils/utils-comments";
import { z } from "zod";

/**
 * 校记：管理员写在某句歌词上的勘误。位置与批注同一套存法，
 * 歌词改动后按原句找回那一行；找不回的仍列在校勘记里，只是不再写到句下。
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

/** 后台新增、修改一条校记的内容；第一版只挂在歌词上 */
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
