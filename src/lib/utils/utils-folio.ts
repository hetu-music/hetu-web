import { processLyrics } from "@/lib/utils/utils-lyrics";

/**
 * 把 LRC 歌词整理成详情页正文所需的结构：
 * - 抽走开头的「歌名 - 歌手」与「词：某某」「混音：某某」等署名行，放进版记；
 * - 按大段间奏推断分段（LRC 本身不保留空行）；
 * - 把意象标注（按时间标签）定位到具体的行与字。
 */

export interface FolioLine {
  /** 时间戳（秒）；纯文本歌词为 null */
  time: number | null;
  text: string;
  /** 与上一行之间有段落间隔 */
  stanzaStart: boolean;
}

export interface FolioCredit {
  role: string;
  names: string;
}

export interface Folio {
  lines: FolioLine[];
  credits: FolioCredit[];
}

const CREDIT_LINE = /^([^：:\s]{1,8})\s*[：:]\s*(.+)$/;
const TITLE_LINE = /\s[-—]\s/;

/** 段落间隔：至少 8 秒，且明显长于常规行距 */
const MIN_STANZA_GAP = 8;
const STANZA_GAP_RATIO = 2.2;

export function buildFolio(lyrics: string | null | undefined): Folio {
  if (!lyrics) return { lines: [], credits: [] };

  const timed = processLyrics(lyrics).lines;
  if (timed.length === 0) return buildPlainFolio(lyrics);

  // 开头的署名区：标题行只可能出现在最前面，其后是连续的「角色：姓名」
  const credits: FolioCredit[] = [];
  let start = 0;
  if (timed[0] && TITLE_LINE.test(timed[0].text)) start = 1;
  while (start < timed.length) {
    const m = timed[start].text.match(CREDIT_LINE);
    if (!m) break;
    credits.push({ role: m[1], names: m[2].trim() });
    start += 1;
  }
  const body = timed.slice(start);

  const gaps = body.slice(1).map((l, i) => l.time - body[i].time);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const threshold = Math.max(MIN_STANZA_GAP, median * STANZA_GAP_RATIO);

  return {
    credits,
    lines: body.map((l, i) => ({
      time: l.time,
      text: l.text,
      stanzaStart: i > 0 && gaps[i - 1] >= threshold,
    })),
  };
}

function buildPlainFolio(lyrics: string): Folio {
  const lines: FolioLine[] = [];
  let pendingBreak = false;
  for (const raw of lyrics.split(/\r?\n/)) {
    const text = raw.trim();
    if (!text) {
      pendingBreak = lines.length > 0;
      continue;
    }
    lines.push({ time: null, text, stanzaStart: pendingBreak });
    pendingBreak = false;
  }
  return { lines, credits: [] };
}

// ─── 意象定位 ────────────────────────────────────────────────────────────────

export interface MarkInput {
  id: number;
  name: string;
  timetags: string[];
}

export interface LineSegment {
  text: string;
  /** 这段文字承载的意象；空数组表示普通文字 */
  ids: number[];
}

export interface MarkedLine {
  segments: LineSegment[];
  /** 本行涉及的全部意象（含在行内找不到对应文字的） */
  ids: number[];
}

export function timetagToSeconds(tag: string): number | null {
  const m = tag.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?$/);
  if (!m) return null;
  const frac = m[3] ? Number(m[3]) / (m[3].length === 2 ? 100 : 1000) : 0;
  return Number(m[1]) * 60 + Number(m[2]) + frac;
}

/**
 * 标注只记了某一次出现的时间标签，而副歌往往重复多次；
 * 这里先按时间找到那一句，再把同文的各句都标上，聚焦时才不会漏掉重复段。
 * 找不到时间标签（纯文本歌词或标签失配）时，退回按意象名搜全文。
 */
export function markLines(
  lines: FolioLine[],
  marks: MarkInput[],
): MarkedLine[] {
  const idsByLine: number[][] = lines.map(() => []);

  for (const mark of marks) {
    const texts = new Set<string>();
    for (const tag of mark.timetags) {
      const t = timetagToSeconds(tag);
      if (t === null) continue;
      const hit = lines.find(
        (l) => l.time !== null && Math.abs(l.time - t) < 0.05,
      );
      if (hit) texts.add(hit.text);
    }
    lines.forEach((line, i) => {
      const matched =
        texts.size > 0 ? texts.has(line.text) : line.text.includes(mark.name);
      if (matched) idsByLine[i].push(mark.id);
    });
  }

  const nameById = new Map(marks.map((m) => [m.id, m.name]));
  return lines.map((line, i) =>
    splitSegments(line.text, idsByLine[i], nameById),
  );
}

function splitSegments(
  text: string,
  ids: number[],
  nameById: Map<number, string>,
): MarkedLine {
  if (ids.length === 0) return { segments: [{ text, ids: [] }], ids };

  const chars = Array.from(text);
  const owners: number[][] = chars.map(() => []);
  for (const id of ids) {
    const needle = locateNeedle(text, nameById.get(id) ?? "");
    if (!needle) continue;
    const needleChars = Array.from(needle);
    for (let i = 0; i + needleChars.length <= chars.length; i++) {
      if (needleChars.every((c, k) => chars[i + k] === c)) {
        for (let k = 0; k < needleChars.length; k++) owners[i + k].push(id);
        i += needleChars.length - 1;
      }
    }
  }

  const segments: LineSegment[] = [];
  chars.forEach((c, i) => {
    const last = segments[segments.length - 1];
    if (last && sameIds(last.ids, owners[i])) last.text += c;
    else segments.push({ text: c, ids: owners[i] });
  });
  return { segments, ids };
}

/**
 * 意象名不一定原样出现在歌词里（标注为「刀剑」，歌词写「剑」），
 * 取意象名在该行中出现的最长子串；标点与空白不算。
 */
function locateNeedle(text: string, name: string): string | null {
  if (!name) return null;
  if (text.includes(name)) return name;
  const chars = Array.from(name);
  for (let len = chars.length - 1; len >= 1; len--) {
    for (let i = 0; i + len <= chars.length; i++) {
      const sub = chars.slice(i, i + len).join("");
      if (/^[\p{L}\p{N}]+$/u.test(sub) && text.includes(sub)) return sub;
    }
  }
  return null;
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 短语末尾的标点；书名号、引号等成对符号不在此列，去掉会只剩半边 */
const TRAILING_PUNCTUATION = /[，。、；：！？,.;:!?…~～—·-]+$/u;

/** 摘句按空格分成几个短语竖排，每个短语末尾的标点都去掉 */
function cleanExcerpt(text: string): string {
  return text
    .split(/\s+/)
    .map((phrase) => phrase.replace(TRAILING_PUNCTUATION, ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * 摘句竖排时每个短语占一列。列数与每列字数在各尺寸屏幕上一致：
 * 窄屏靠缩小字号放进封面旁的留白，列太多或太长就只能缩到看不清。
 */
const EXCERPT_MIN_CHARS = 4;
const EXCERPT_MAX_COLUMNS = 3;
const EXCERPT_MAX_COLUMN_CHARS = 9;

/**
 * 卷首摘句：意象最密集、长度适合竖排的一句；同分取靠前者。
 * 没有意象标注时取第一句长度合适的歌词。
 */
export function pickExcerpt(
  lines: FolioLine[],
  marked: MarkedLine[],
): string | null {
  const fits = (text: string) => {
    const columns = text.split(" ").map((c) => Array.from(c).length);
    const total = columns.reduce((a, b) => a + b, 0);
    return (
      total >= EXCERPT_MIN_CHARS &&
      columns.length <= EXCERPT_MAX_COLUMNS &&
      columns.every((n) => n <= EXCERPT_MAX_COLUMN_CHARS)
    );
  };
  let best: string | null = null;
  let bestScore = -1;
  for (let i = 0; i < lines.length; i++) {
    const text = cleanExcerpt(lines[i].text);
    if (!fits(text)) continue;
    const score = new Set(marked[i]?.ids ?? []).size;
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
  }
  return best;
}

// ─── 创作手记 ────────────────────────────────────────────────────────────────

export interface NoteLine {
  text: string;
  /** 落款行（「——Finale」「-记《穆天子传》」），右对齐排 */
  signature: boolean;
}

export interface Notes {
  paragraphs: NoteLine[][];
  /** 总字数，用于决定是否折叠 */
  length: number;
}

/**
 * 落款：破折号后跟一个短名字（人名、书名、「题记」），名字里不带句读与引号。
 * 带句读的是正文里的破折号（「——她告诉我，……」），不算落款。
 */
const SIGNER = String.raw`[^，。！？、；：,.!?;:“”"‘’\s—][^，。！？、；：,.!?;:“”"‘’—]{0,19}`;
/** 独占一行的落款：「——《天岁城志》」「-记《穆天子传》西王母 周穆王」 */
const STANDALONE_SIGNATURE = new RegExp(
  String.raw`^(?:——|—|--|-)\s*${SIGNER}$`,
);
/** 接在句末的落款：「……2025年最后一首歌。 ——Finale」；单个连字符太常见，不认 */
const TRAILING_SIGNATURE = new RegExp(
  String.raw`^(.*\S)(\s*)((?:——|--)\s*(${SIGNER}))$`,
);
/** 句末标点或右括号、右引号：其后的破折号是另起的落款，而非正文里的同位语 */
const SENTENCE_END = /[。！？!?.~～”」』）)\]】]$/;

function toNoteLines(paragraph: string): NoteLine[] {
  return paragraph
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((text): NoteLine[] => {
      if (STANDALONE_SIGNATURE.test(text)) return [{ text, signature: true }];
      const m = text.match(TRAILING_SIGNATURE);
      // 破折号紧贴正文且后接书名（「第四张音乐CD——《NL不分》」）是同位语，不是落款
      const appositive =
        m !== null &&
        m[2] === "" &&
        !SENTENCE_END.test(m[1]) &&
        m[4].startsWith("《");
      if (m && !appositive && !/[—-]$/.test(m[1])) {
        return [
          { text: m[1], signature: false },
          { text: m[3], signature: true },
        ];
      }
      return [{ text, signature: false }];
    });
}

function charCount(lines: NoteLine[]): number {
  return lines
    .filter((l) => !l.signature)
    .reduce((n, l) => n + Array.from(l.text.replace(/\s+/g, "")).length, 0);
}

/** 备注是作者的创作手记：按空行分段，段内换行保留，落款行单独标出 */
export function parseNotes(comment: string | null | undefined): Notes | null {
  const text = comment?.replace(/\r\n?/g, "\n").trim();
  if (!text) return null;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(toNoteLines)
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;

  return {
    paragraphs,
    length: paragraphs.reduce((n, p) => n + charCount(p), 0),
  };
}
