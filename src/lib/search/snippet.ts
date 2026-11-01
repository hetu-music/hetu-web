/**
 * 歌词片段与高亮区间（见 docs/LIBRARY.md 阶段 2「7. 片段」）。
 *
 * 显示命中的那一整句；句子太长时以第一处命中为中心截取，两头加省略号。
 * 位置表只在这里按需计算：一页只有十几句要显示。
 */
import { type LyricsCorpus } from "./corpus";
import { normalizeWithMap, toOriginalRange } from "./normalize";
import { bigrams, TIER, type SearchHit } from "./rank";

export interface Snippet {
  /** 要显示的文字（原文，可能截取过、带省略号） */
  text: string;
  /** 高亮区间 [起点, 终点)，按 text 计，从前到后、互不重叠 */
  ranges: [number, number][];
  /** 除这一句外还命中了几句 */
  more: number;
  /** 兜底命中（近似），界面上要和精确命中区分开 */
  approximate: boolean;
}

/** 片段最长多少个 UTF-16 单元，超出就截取 */
export const SNIPPET_MAX_LENGTH = 32;
const ELLIPSIS = "…";

export function buildSnippet(
  corpus: LyricsCorpus,
  hit: SearchHit,
  words: readonly string[],
  maxLength = SNIPPET_MAX_LENGTH,
): Snippet | null {
  if (!hit.lyric) return null;
  const original = corpus.lines[hit.lyric.line];
  const approximate = hit.tier === TIER.LYRIC_FALLBACK;
  // 兜底命中没有完整的搜索词，高亮对上的那些两字片段
  const needles = approximate ? words.flatMap(bigrams) : words;
  const ranges = findRanges(original, needles);
  const cut = clip(original, ranges, maxLength);
  return { ...cut, more: hit.lyric.count - 1, approximate };
}

/** 原文里每个搜索词出现的位置（归一化后找，再映射回原文），合并重叠的 */
export function findRanges(
  original: string,
  needles: readonly string[],
): [number, number][] {
  const normalized = normalizeWithMap(original);
  const found: [number, number][] = [];
  for (const needle of needles) {
    if (!needle) continue;
    for (
      let p = normalized.text.indexOf(needle);
      p !== -1;
      p = normalized.text.indexOf(needle, p + 1)
    ) {
      found.push(toOriginalRange(original, normalized, p, p + needle.length));
    }
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of found) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** 太长时以第一处高亮为中心截取 */
function clip(
  text: string,
  ranges: [number, number][],
  maxLength: number,
): { text: string; ranges: [number, number][] } {
  if (text.length <= maxLength) return { text, ranges };

  const [s, e] = ranges[0] ?? [0, 0];
  let start = Math.max(0, s - Math.floor((maxLength - (e - s)) / 2));
  start = Math.min(start, text.length - maxLength);
  start = avoidSplitSurrogate(text, start);
  let end = avoidSplitSurrogate(text, start + maxLength);

  const head = start > 0 ? ELLIPSIS : "";
  const tail = end < text.length ? ELLIPSIS : "";
  if (end < start) end = start;
  const shift = head.length - start;
  const clipped: [number, number][] = [];
  for (const [a, b] of ranges) {
    const from = Math.max(a, start);
    const to = Math.min(b, end);
    if (from < to) clipped.push([from + shift, to + shift]);
  }
  return { text: head + text.slice(start, end) + tail, ranges: clipped };
}

/** 位置落在代理对中间时往前挪一个，不把一个字切成两半 */
function avoidSplitSurrogate(text: string, pos: number): number {
  const code = text.charCodeAt(pos);
  return pos > 0 && code >= 0xdc00 && code <= 0xdfff ? pos - 1 : pos;
}
