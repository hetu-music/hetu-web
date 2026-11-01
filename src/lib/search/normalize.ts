/**
 * 搜索归一化（见 docs/LIBRARY.md 阶段 2「1. 归一化」）。
 *
 * 搜索词和被搜的文本都过同一套：去掉标点、空白和符号；全角转半角、拉丁字母转小写；
 * 繁体逐字转简体。一个字只换成一个字，所以归一化后的每个字都能对回原文的某个字，
 * 高亮时用位置表把命中区间映射回原文。
 *
 * 繁转简只用逐字表 t2s.json（scripts/gen-t2s-table.ts 生成），不打包 opencc-js。
 * 已知局限：繁体页按词转换（「软件」→「軟體」），逐字转回去是「软体」，对不上简体的「软件」。
 */
import T2S_PAIRS from "./t2s.json";

/** 去掉的字符：标点、符号、空白、控制字符（\u0001 是 corpus 的句间分隔符，必须去掉） */
const SKIP = /[\p{P}\p{S}\p{Z}\p{Cc}\p{Cf}\s]/u;

let t2s: Map<string, string> | null = null;

function getT2S(): Map<string, string> {
  if (t2s) return t2s;
  const map = new Map<string, string>();
  const chars = [...(T2S_PAIRS as string)];
  for (let i = 0; i + 1 < chars.length; i += 2) map.set(chars[i], chars[i + 1]);
  t2s = map;
  return map;
}

/** 一个字（码点）归一化后的结果，空串表示去掉 */
function normalizeChar(ch: string, table: Map<string, string>): string {
  if (SKIP.test(ch)) return "";
  const code = ch.charCodeAt(0);
  // 全角 ASCII（！到～）转半角
  const half =
    code >= 0xff01 && code <= 0xff5e ? String.fromCharCode(code - 0xfee0) : ch;
  const lower = half.toLowerCase();
  return table.get(lower) ?? lower;
}

/** 归一化，不要位置表 */
export function normalize(text: string): string {
  const table = getT2S();
  let out = "";
  for (const ch of text) out += normalizeChar(ch, table);
  return out;
}

export interface Normalized {
  text: string;
  /** map[i]：归一化后第 i 个 UTF-16 单元来自原文的第几个单元 */
  map: Int32Array;
}

/** 归一化，并记下位置表。只给要显示片段的那几句算（阶段 2「6. 内存结构」） */
export function normalizeWithMap(text: string): Normalized {
  const table = getT2S();
  let out = "";
  const map: number[] = [];
  let pos = 0;
  for (const ch of text) {
    const n = normalizeChar(ch, table);
    for (let k = 0; k < n.length; k++) map.push(pos);
    out += n;
    pos += ch.length;
  }
  return { text: out, map: Int32Array.from(map) };
}

/**
 * 把归一化文本上的区间 [start, end) 映射回原文的区间。
 * 区间两端之间被去掉的标点会包含在内，比如「七重纱衣血溅」对回「七重纱衣，血溅」。
 */
export function toOriginalRange(
  original: string,
  { map }: Normalized,
  start: number,
  end: number,
): [number, number] {
  const from = map[start];
  const last = map[end - 1];
  const code = original.charCodeAt(last);
  const width = code >= 0xd800 && code <= 0xdbff ? 2 : 1;
  return [from, last + width];
}

/**
 * 把搜索框里的内容拆成词：按空白（含全角空格）分开，各自归一化，去掉空的和重复的。
 * 不按空白分开的标点（如「，」）只是被去掉，不起分词作用。
 */
export function splitQuery(query: string): string[] {
  const words = new Set<string>();
  for (const part of query.split(/\s+/)) {
    const word = normalize(part);
    if (word) words.add(word);
  }
  return [...words];
}
