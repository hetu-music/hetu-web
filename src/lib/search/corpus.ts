/**
 * 歌词的内存结构（见 docs/LIBRARY.md 阶段 2「6. 内存结构」）。
 *
 * 全部句子归一化后拼成一个字符串，句间用 \u0001 隔开。搜索只在这个字符串上反复 indexOf，
 * 再二分查找定位到句子和歌，不遍历上万个短字符串。归一化去掉了所有控制字符，
 * 分隔符不会出现在正文里，所以命中不会跨句。
 */
import { normalize } from "./normalize";

/** lyrics-lines 接口的一条（阶段 5）：按页面字形，已去掉署名区与说明行 */
export interface LyricsLinesEntry {
  id: number;
  lines: string[];
}

export interface LyricsCorpus {
  /** 全部句子归一化后拼接，句间用 \u0001 隔开 */
  corpus: string;
  /** 每句在 corpus 里的起点 */
  lineStart: Int32Array;
  /** 每句属于哪首歌（歌曲 id） */
  lineSong: Int32Array;
  /** 每句是所属那首歌的第几句（从 0 起） */
  lineIndex: Int32Array;
  /** 原文，按句号索引，显示片段时用 */
  lines: string[];
}

export const SEPARATOR = "\u0001";

/** 第 line 句在 corpus 里的终点（不含） */
export function lineEnd(c: LyricsCorpus, line: number): number {
  return line + 1 < c.lineStart.length
    ? c.lineStart[line + 1] - 1
    : c.corpus.length;
}

/** corpus 里的位置属于第几句 */
export function lineAt(c: LyricsCorpus, pos: number): number {
  const starts = c.lineStart;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 一次建好。测试、脚本用；页面上用 buildCorpusChunked，不卡输入 */
export function buildCorpus(
  entries: readonly LyricsLinesEntry[],
): LyricsCorpus {
  const builder = new CorpusBuilder(entries);
  builder.step(entries.length);
  return builder.finish();
}

export interface ChunkedOptions {
  /** 每段处理几首歌，默认 40：中档手机上每段十几毫秒 */
  chunkSize?: number;
  /** 中途放弃（比如切换了页面字形，换了一份歌词） */
  signal?: AbortSignal;
  /** 让出主线程；默认 scheduler.yield()，不支持时 setTimeout(0) */
  yieldToMain?: () => Promise<void>;
}

/**
 * 分段构建，每段之间把主线程让出来。建好之前这个 Promise 未完成，
 * 期间的搜索传 null，只查元数据各档。
 */
export async function buildCorpusChunked(
  entries: readonly LyricsLinesEntry[],
  { chunkSize = 40, signal, yieldToMain = defaultYield }: ChunkedOptions = {},
): Promise<LyricsCorpus> {
  const builder = new CorpusBuilder(entries);
  while (!builder.done) {
    if (signal?.aborted) throw signal.reason;
    builder.step(chunkSize);
    if (!builder.done) await yieldToMain();
  }
  if (signal?.aborted) throw signal.reason;
  return builder.finish();
}

function defaultYield(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } })
    .scheduler;
  if (typeof s?.yield === "function") return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class CorpusBuilder {
  private readonly parts: string[] = [];
  private readonly lineStart: Int32Array;
  private readonly lineSong: Int32Array;
  private readonly lineIndex: Int32Array;
  private readonly lines: string[] = [];
  private next = 0;
  private line = 0;
  private pos = 0;

  constructor(private readonly entries: readonly LyricsLinesEntry[]) {
    let total = 0;
    for (const e of entries) total += e.lines.length;
    this.lineStart = new Int32Array(total);
    this.lineSong = new Int32Array(total);
    this.lineIndex = new Int32Array(total);
  }

  get done(): boolean {
    return this.next >= this.entries.length;
  }

  step(songs: number): void {
    const stop = Math.min(this.entries.length, this.next + songs);
    for (; this.next < stop; this.next++) {
      const entry = this.entries[this.next];
      entry.lines.forEach((text, i) => {
        const n = normalize(text);
        this.lineStart[this.line] = this.pos;
        this.lineSong[this.line] = entry.id;
        this.lineIndex[this.line] = i;
        this.lines.push(text);
        this.parts.push(n);
        this.pos += n.length + 1;
        this.line++;
      });
    }
  }

  finish(): LyricsCorpus {
    return {
      corpus: this.parts.join(SEPARATOR),
      lineStart: this.lineStart,
      lineSong: this.lineSong,
      lineIndex: this.lineIndex,
      lines: this.lines,
    };
  }
}
