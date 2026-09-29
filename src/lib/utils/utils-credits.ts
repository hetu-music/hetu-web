import { CREDIT_FIELDS, type CreditField } from "@/lib/types";

/** 别名 → 主名；没登记的名字就是它自己 */
export type CreditAliasMap = ReadonlyMap<string, string>;

type CreditFields = Partial<Record<CreditField, string[] | null>>;

export type WithResolvedCredits<T> = T & {
  credited?: CreditFields;
  creditAliases?: string[];
};

/**
 * 把署名换成主名，供卷首、列表、筛选、搜索使用。
 *
 * 原署名不丢：改动过的字段原样存进 credited（版记照录），
 * 被换掉的名字收进 creditAliases（搜别名也能找到这首歌）。
 * 一个名字都没换的歌原样返回，不多带字段。
 */
export function applyCreditAliases<T extends CreditFields>(
  song: T,
  aliases: CreditAliasMap,
): WithResolvedCredits<T> {
  if (aliases.size === 0) return song;

  const resolved: CreditFields = {};
  const credited: CreditFields = {};
  const replaced = new Set<string>();

  for (const field of CREDIT_FIELDS) {
    const names = song[field];
    if (!names || !names.some((n) => aliases.has(n))) continue;

    names.forEach((n) => aliases.has(n) && replaced.add(n));
    // 原名与别名并列署在同一首歌上时，归并后只留一个
    resolved[field] = [...new Set(names.map((n) => aliases.get(n) ?? n))];
    credited[field] = names;
  }

  if (replaced.size === 0) return song;
  return { ...song, ...resolved, credited, creditAliases: [...replaced] };
}
