import type { Dimension, DimensionKey, SignatureImagery } from "./types";

/**
 * 意象维度定义。
 *
 * 由数据库中的 17 个意象二级分类合并而来（分类体系见 IMAGERY.md）：过于稀疏的分类
 *（世事、饮食等）并入相近维度，避免单独成维带来噪声。分类改名时需同步这里。
 */
export const DIMENSIONS: readonly Dimension[] = [
  {
    key: "tianxiang",
    label: "天象",
    categories: ["天象"],
    motto: "仰观天象",
    description: "你看得见风月。一场雨、一轮月，于你都是心事的形状。",
  },
  {
    key: "shanhe",
    label: "山河",
    categories: ["山水", "地域"],
    motto: "行遍山河",
    description: "你的心在路上。江流、关山与远方，才是你想去的地方。",
  },
  {
    key: "caomu",
    label: "草木",
    categories: ["草木", "鸟兽"],
    motto: "草木知心",
    description: "你留意一花一木的开落，万物有情，你都看在眼里。",
  },
  {
    key: "qiyong",
    label: "器用",
    categories: ["器物", "饮食"],
    motto: "一器一物",
    description: "一盏酒、一柄剑、一方砚，你习惯把情绪寄在手边的物件上。",
  },
  {
    key: "loutai",
    label: "楼台",
    categories: ["建筑"],
    motto: "倚遍楼台",
    description: "你偏爱有檐有窗的地方，愿意在楼阁庭院里等一个人、看一场雪。",
  },
  {
    key: "guangyin",
    label: "光阴",
    categories: ["时令", "光阴"],
    motto: "惜取光阴",
    description: "你对时间格外敏感，朝暮与春秋，总让你想起逝去的事。",
  },
  {
    key: "renjian",
    label: "人间",
    categories: ["身体", "人物"],
    motto: "人间行走",
    description: "你关心人胜过风景，侠客、故人与眉眼，都是你想写的故事。",
  },
  {
    key: "qingsi",
    label: "情思",
    categories: ["情感", "心象"],
    motto: "情之所钟",
    description: "你总被那些未了的心意打动，爱与恨、离与别，都要写到最深处。",
  },
  {
    key: "diangu",
    label: "典故",
    categories: ["神异", "艺文", "世事"],
    motto: "旧典新声",
    description: "你喜欢有来历的句子，一个典故、一段传说，就是一整个世界。",
  },
];

export const DIMENSION_KEYS: readonly DimensionKey[] = DIMENSIONS.map(
  (d) => d.key,
);

const dimensionByKey = new Map(DIMENSIONS.map((d) => [d.key, d]));

export function getDimension(key: DimensionKey): Dimension {
  const dim = dimensionByKey.get(key);
  if (!dim) throw new Error(`未知维度：${key}`);
  return dim;
}

/** 二级分类名 → 维度 */
export const CATEGORY_TO_DIMENSION: ReadonlyMap<string, DimensionKey> = new Map(
  DIMENSIONS.flatMap((d) => d.categories.map((c) => [c, d.key])),
);

/**
 * 招牌意象：原创歌曲中出现最多的具体意象，题目选项可直接指向它们。
 * 按母题计数：挂在该母题上的词都算（清风、长风都是「风」）。
 * 「花」只算母题「花」；桃、梅、梨等品种花是单列的母题，不并入，以免与「草木」维度重叠。
 * 每个招牌意象都是独立的匹配特征，同一维度不宜挑太多，否则该维度在匹配里分量过重；
 * 岁月、人间等高频母题太抽象，不适合作为「你偏爱的意象」展示，故不入选。
 * 母题改名时需同步这里（pnpm quiz:check 会报出找不到的母题）。
 */
export const SIGNATURE_IMAGERY: readonly SignatureImagery[] = [
  // 天象
  { name: "风", motif: "风" },
  { name: "月", motif: "月" },
  { name: "雪", motif: "雪" },
  { name: "雨", motif: "雨" },
  // 山河
  { name: "山", motif: "山" },
  { name: "江河", motif: "江河" },
  // 草木
  { name: "花", motif: "花" },
  { name: "柳", motif: "柳" },
  { name: "马", motif: "马" },
  // 器用
  { name: "酒", motif: "酒" },
  { name: "灯", motif: "灯" },
  { name: "剑", motif: "剑" },
  // 情思
  { name: "梦", motif: "梦" },
  // 楼台
  { name: "楼", motif: "楼" },
];

/** 母题名 → 招牌意象名 */
export const MOTIF_TO_SIGNATURE: ReadonlyMap<string, string> = new Map(
  SIGNATURE_IMAGERY.map((s) => [s.motif, s.name]),
);
