import type { ImageryItem, ImageryTaxonomy } from "@/lib/types";

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

/** 按 id 查母题的完整路径「门类 / 类别 / 母题」；查不到的母题记作「母题 #id」 */
export function motifPaths(
  taxonomy: ImageryTaxonomy,
): (motifId: number) => string {
  const categoryById = new Map(taxonomy.categories.map((c) => [c.id, c]));
  const paths = new Map(
    taxonomy.motifs.map((m) => {
      const category = categoryById.get(m.motif_id);
      return [
        m.id,
        category
          ? `${category.domain} / ${category.name} / ${m.name}`
          : m.name,
      ];
    }),
  );
  return (id) => paths.get(id) ?? `母题 #${id}`;
}

/** 全部母题，按路径排序，供下拉框用 */
export function motifOptions(taxonomy: ImageryTaxonomy): MotifOption[] {
  const pathOf = motifPaths(taxonomy);
  return taxonomy.motifs
    .map((m) => ({ id: m.id, label: pathOf(m.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}
