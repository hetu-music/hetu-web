import type { Dimension, DimensionKey, SignatureImagery } from "./types";

/**
 * 意象维度定义。
 *
 * 由数据库中的 15 个意象二级分类合并而来：过于稀疏的分类（传说、习俗、饮食等）
 * 并入相近维度，避免单独成维带来噪声。分类改名时需同步这里。
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
    categories: ["地理", "地点"],
    motto: "行遍山河",
    description: "你的心在路上。江流、关山与远方，才是你想去的地方。",
  },
  {
    key: "caomu",
    label: "草木",
    categories: ["植物", "动物"],
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
    description: "你偏爱有檐有窗的地方，在楼阁庭院里等一个人、看一场雪。",
  },
  {
    key: "guangyin",
    label: "光阴",
    categories: ["时间"],
    motto: "惜取光阴",
    description: "你对时间格外敏感，朝暮与春秋，总让你想起逝去的事。",
  },
  {
    key: "renjian",
    label: "人间",
    categories: ["身体", "身份"],
    motto: "人间行走",
    description: "你关心人胜过风景，侠客、故人与眉眼，都是你想写的故事。",
  },
  {
    key: "qingsi",
    label: "情思",
    categories: ["情感"],
    motto: "情之所钟",
    description: "你不绕弯子，爱与恨、离与别，都要写到最深处。",
  },
  {
    key: "diangu",
    label: "典故",
    categories: ["传说", "习俗", "文体"],
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
 * 招牌意象：原创歌曲中出现最多的意象，题目选项可直接指向它们。
 */
export const SIGNATURE_IMAGERY: readonly SignatureImagery[] = [
  { name: "风", aliases: ["风", "春风", "西风", "东风", "秋风"] },
  { name: "花", aliases: ["花", "落花", "桃花", "繁花"] },
  { name: "月", aliases: ["月", "明月", "月光", "月色"] },
  { name: "雪", aliases: ["雪", "飞雪", "大雪"] },
  { name: "雨", aliases: ["雨", "烟雨", "细雨"] },
  { name: "云", aliases: ["云", "浮云", "白云"] },
  { name: "酒", aliases: ["酒", "美酒", "浊酒"] },
  { name: "梦", aliases: ["梦", "梦境", "旧梦"] },
  { name: "山", aliases: ["山", "青山", "关山"] },
  { name: "灯", aliases: ["灯", "灯火", "孤灯"] },
  { name: "柳", aliases: ["柳", "杨柳", "垂柳"] },
  { name: "马", aliases: ["马", "白马", "骏马"] },
  { name: "星辰", aliases: ["星辰", "星", "星河"] },
  { name: "窗", aliases: ["窗", "轩窗", "窗前"] },
];

/** 数据库意象名 → 招牌意象名 */
export const IMAGERY_ALIAS: ReadonlyMap<string, string> = new Map(
  SIGNATURE_IMAGERY.flatMap((s) => s.aliases.map((a) => [a, s.name])),
);
