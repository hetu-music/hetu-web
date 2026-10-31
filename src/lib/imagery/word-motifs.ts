import type { ImageryCategory, ImageryItem } from "@/lib/types";

/**
 * 词与母题的共用小工具（规则见 IMAGERY.md）。
 * 后台的母题页、歌曲工作台的标注与预标注审核都从这里取，不各写一份。
 */

/**
 * 界面上的叫法。库里是 primary / alternative / part（见 IMAGERY.md），
 * 其他管理员不熟这些术语，界面一律用白话，并配一个例子
 */
export const WORD_ROLE = {
  primary: {
    label: "通常算作",
    help: "标注这个词时默认选它。",
  },
  alternative: {
    label: "有时也指",
    help: "同一个词在不同歌里意思不同，标注时按歌词选。例：「烟花」通常算焰火，「三月烟花」指春。",
  },
  part: {
    label: "同时算进",
    help: "这个词本身包含两样东西，标一次两个都算。例：「风雨」既算风也算雨。",
  },
} as const;

/** 母题就是第三级分类；第一、二级是门类与类别 */
export function isMotif(category: Pick<ImageryCategory, "level">): boolean {
  return category.level === 3;
}

/** 标注这个词时可选的母题：默认母题在前，其后是多义候选（并列组成由服务端补写，不在其中） */
export function wordMotifIds(
  item: Pick<ImageryItem, "primary" | "alternatives">,
): number[] {
  return item.primary === null
    ? item.alternatives
    : [item.primary, ...item.alternatives];
}

export interface MotifOption {
  id: number;
  /** 门类 / 类别 / 母题 */
  label: string;
}

/** 分类的完整路径：门类 / 类别 / 母题 */
export function categoryPath(
  id: number,
  byId: ReadonlyMap<number, Pick<ImageryCategory, "name" | "parent_id">>,
): string {
  const names: string[] = [];
  const seen = new Set<number>();
  for (
    let current = byId.get(id), currentId = id;
    current && !seen.has(currentId);
    currentId = current.parent_id ?? -1, current = byId.get(currentId)
  ) {
    seen.add(currentId);
    names.unshift(current.name);
  }
  return names.length > 0 ? names.join(" / ") : `母题 #${id}`;
}

/** 全部母题，按路径排序，供下拉框用 */
export function motifOptions(
  categories: readonly ImageryCategory[],
): MotifOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories
    .filter(isMotif)
    .map((c) => ({ id: c.id, label: categoryPath(c.id, byId) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}
