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

/** 一个署名在曲库里的使用情况，供后台挑选别名与主名 */
export type CreditNameUsage = {
  name: string;
  /** 署有这个名字的歌曲数 */
  songs: number;
  /** 以这个名字担任过的角色，按 CREDIT_FIELDS 的顺序 */
  roles: CreditField[];
};

export function summarizeCreditNames(songs: CreditFields[]): CreditNameUsage[] {
  const usage = new Map<string, { songs: number; roles: Set<CreditField> }>();
  for (const song of songs) {
    const seen = new Set<string>();
    for (const field of CREDIT_FIELDS) {
      for (const name of song[field] ?? []) {
        const entry = usage.get(name) ?? { songs: 0, roles: new Set() };
        entry.roles.add(field);
        // 一首歌里身兼数职只算一首
        if (!seen.has(name)) {
          entry.songs += 1;
          seen.add(name);
        }
        usage.set(name, entry);
      }
    }
  }
  return [...usage].map(([name, { songs, roles }]) => ({
    name,
    songs,
    roles: CREDIT_FIELDS.filter((f) => roles.has(f)),
  }));
}
