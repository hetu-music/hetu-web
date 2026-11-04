import type { CollationKind, SongCollation, SupplementKind } from "@/lib/types";
import { type AnchorContext, resolveSlot } from "@/lib/utils/utils-comments";

/**
 * 校记：管理员写在某句歌词上的勘误。位置与批注同一套存法，
 * 歌词改动后按原句找回那一行；找不回的不再写到句下，只在后台列出待处理。
 * 补遗：记在整首歌上的资料（版本、旧稿），与校记同表，anchor 为 song。
 *
 * 后台提交用的校验规则在 lib/forms/collation-form：这里的函数详情页也用，
 * 不能把 zod 带进前台的包
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

export const SUPPLEMENT_KINDS = [
  "release",
  "draft",
  "note",
] as const satisfies readonly SupplementKind[];

/** 旧稿可能整段照录 */
export const SUPPLEMENT_BODY_MAX = 4000;

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

/**
 * 前台落款里的订者：三人以内全列，用顿号隔开；再多只列第一个和最后一个，
 * 记作「乙、戊等四人」，count 为总人数。没有订者时为 null
 */
export function summarizeRevisers(
  revisers: string[],
): { names: string; count: number | null } | null {
  if (revisers.length === 0) return null;
  if (revisers.length <= 3) return { names: revisers.join("、"), count: null };
  return {
    names: `${revisers[0]}、${revisers[revisers.length - 1]}`,
    count: revisers.length,
  };
}

/** 后台提示：改了内容再保存，是否会把自己新记进订者名单 */
export function willSignAsReviser(
  c: SongCollation,
  userName: string | null | undefined,
): boolean {
  return (
    !!userName && c.collator !== userName && !c.revisers.includes(userName)
  );
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
