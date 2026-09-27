import { processLyrics } from "@/lib/utils/utils-lyrics";

/**
 * 把 LRC 歌词整理成详情页正文所需的结构：
 * - 抽走开头的署名区（标题行、「作词：某某」等署名、版权声明），放进版记；
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
  /** 署名区里的声明与副题（「版权所有……」「-某某专辑 Track01-」） */
  notices: string[];
}

export interface FolioOptions {
  /** 歌名：用来认出开头的标题行 */
  title?: string | null;
  /**
   * 歌词从哪个时间标签开始（如 "00:23.97"）。
   * 自动识别出错的歌由后台手动指定：此前的行全部算署名区。
   */
  lyricsStart?: string | null;
}

/**
 * 署名行「角色：姓名」。角色可以合写（「作曲/编曲/演唱」）或中英对照
 * （「编曲 Arranger」「DJ 版制作」），但不含句读；
 * 姓名里有中文句读的是对白（「王耀：恩，现今天下太平盛世。」），不是署名。
 */
const CREDIT_LINE = /^([^：:，。！？,.!?“”"]{1,30}?)\s*[：:]\s*(.+)$/;
const DIALOGUE = /[，。！？；]/;

function parseCredit(text: string): FolioCredit | null {
  const m = text.match(CREDIT_LINE);
  if (!m || DIALOGUE.test(m[2])) return null;
  const role = cleanRole(m[1]);
  return role ? { role, names: m[2].trim() } : null;
}

const HAS_CJK = /[㐀-鿿]/;

/**
 * 自动识别时，角色名须像一项职务或乐器；
 * 对唱的「男：」「女：」、角色台词「明月心：」都不含这些字，不会被当成署名。
 * 不在此列的冷门角色，由后台手动指定歌词起点兜底。
 */
const ROLE_WORD =
  /[词詞曲编編唱声聲音混缩縮轨軌制製策划劃监監筹籌琴笛箫簫萧蕭埙塤鼓筝箏胡弦键鍵贝貝录錄修美画畫绘繪书書题題剪排协協鸣鳴谢謝]|母带|母帶|出品|发行|發行|吉他|琵琶|尺八|设计|設計|封面|海报|海報|视频|視頻|视觉|視覺|映像|分镜|分鏡|文案|故事|人设|人設|原著|支持|推广|推廣|宣传|宣傳|营销|營銷|后期|後期|念白|旁白|朗诵|朗誦|童|和声|和聲|伴|工程|团队|團隊|演奏|乐|樂|师|師|版权|版權|单位|單位|平台|調教|调教|指导|指導|素材|立绘|立繪|插画|插畫|^(?:OP|SP|PV|PS|MV|DJ|bass)(?![a-z])/i;

/** 中英对照的角色只留中文：「编曲 Arranger」→「编曲」，「古琴监制/Guqin」→「古琴监制」 */
function cleanRole(role: string): string {
  const parts = role
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.some((p) => HAS_CJK.test(p))) return parts.join("/");
  return parts
    .filter((p) => HAS_CJK.test(p))
    .map((p) => p.replace(/\s*[A-Za-z][A-Za-z .&']*$/, "").trim())
    .filter(Boolean)
    .join("/");
}

/** 「歌名 - 歌手」 */
const TITLE_LINE = /\s[-—]\s/;
/**
 * 署名区里夹着的声明：整行用「」『』括起、用 -…- 包起的专辑信息、
 * 以——引出的副题，或含版权、翻唱授权字样的行。
 */
const NOTICE_LINE =
  /^(?:[「『].*[」』]|-.+-|——.+)$|版权|翻唱|授权|二次上传|Track\s*\d/i;

/** 比较歌名时忽略大小写、空白、间隔号与全半角括号 */
function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s·・]/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

/** 标题行：「歌名 - 歌手」，或以歌名开头（「偷个闲-河图」「陌上花早」） */
function isTitleLine(text: string, title: string): boolean {
  if (TITLE_LINE.test(text)) return true;
  return title !== "" && normalizeTitle(text).startsWith(title);
}

/** 段落间隔：至少 8 秒，且明显长于常规行距 */
const MIN_STANZA_GAP = 8;
const STANZA_GAP_RATIO = 2.2;

type TimedLine = { time: number; text: string };

interface Header {
  /** 正文从第几行开始 */
  bodyStart: number;
  credits: FolioCredit[];
  notices: string[];
}

/**
 * 自动识别署名区：可选的标题行之后，连续的署名行，其间可夹声明行，
 * 以及混在署名中间又重复一遍的歌名。没有任何署名时，只去掉标题行。
 */
function detectHeader(timed: TimedLine[], title: string): Header {
  const start = timed[0] && isTitleLine(timed[0].text, title) ? 1 : 0;
  const credits: FolioCredit[] = [];
  const notices: string[] = [];
  let i = start;
  for (; i < timed.length; i++) {
    const text = timed[i].text;
    const credit = parseCredit(text);
    if (credit && ROLE_WORD.test(credit.role)) credits.push(credit);
    else if (NOTICE_LINE.test(text)) notices.push(text);
    else if (title === "" || normalizeTitle(text) !== title) break;
  }
  if (credits.length === 0) return { bodyStart: start, credits, notices: [] };
  return { bodyStart: i, credits, notices };
}

/** 手动指定了歌词起点：此前的行，有冒号的是署名，标题行略去，其余算声明 */
function splitHeader(
  timed: TimedLine[],
  title: string,
  startTime: number,
): Header {
  const bodyStart = timed.findIndex((l) => l.time >= startTime - 0.005);
  const head = bodyStart < 0 ? timed : timed.slice(0, bodyStart);
  const credits: FolioCredit[] = [];
  const notices: string[] = [];
  head.forEach((line, i) => {
    const credit = parseCredit(line.text);
    if (credit) credits.push(credit);
    else if (
      !(i === 0 && isTitleLine(line.text, title)) &&
      normalizeTitle(line.text) !== title
    )
      notices.push(line.text);
  });
  return {
    bodyStart: bodyStart < 0 ? timed.length : bodyStart,
    credits,
    notices,
  };
}

/** 同一角色写了两遍的（署名区重复一次），只留第一次 */
function dedupeCredits(credits: FolioCredit[]): FolioCredit[] {
  const seen = new Set<string>();
  return credits.filter((c) => {
    if (seen.has(c.role)) return false;
    seen.add(c.role);
    return true;
  });
}

export function buildFolio(
  lyrics: string | null | undefined,
  options: FolioOptions = {},
): Folio {
  if (!lyrics) return { lines: [], credits: [], notices: [] };

  const timed = processLyrics(lyrics).lines;
  if (timed.length === 0) return buildPlainFolio(lyrics);

  const title = normalizeTitle(options.title ?? "");
  const startTime = options.lyricsStart
    ? timetagToSeconds(options.lyricsStart)
    : null;
  const header =
    startTime !== null
      ? splitHeader(timed, title, startTime)
      : detectHeader(timed, title);
  const body = timed.slice(header.bodyStart);

  const gaps = body.slice(1).map((l, i) => l.time - body[i].time);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const threshold = Math.max(MIN_STANZA_GAP, median * STANZA_GAP_RATIO);

  return {
    credits: dedupeCredits(header.credits),
    notices: header.notices,
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
  return { lines, credits: [], notices: [] };
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

/** 放不进一列的长句从中间折成两列；前一列取短的一半，多为「五 / 六」的断法 */
function foldInHalf(text: string): string | null {
  const chars = Array.from(text);
  if (text.includes(" ") || chars.length > EXCERPT_MAX_COLUMN_CHARS * 2)
    return null;
  const half = Math.floor(chars.length / 2);
  return `${chars.slice(0, half).join("")} ${chars.slice(half).join("")}`;
}

/**
 * 卷首摘句：意象最密集、长度适合竖排的一句；同分取靠前者。
 * 没有意象标注时取第一句长度合适的歌词。
 * 一句都放不下时（每句都是不带空格的长句），把长句从中间折成两列再挑。
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
  const pick = (shape: (text: string) => string | null) => {
    let best: string | null = null;
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      const text = shape(cleanExcerpt(lines[i].text));
      if (text === null || !fits(text)) continue;
      const score = new Set(marked[i]?.ids ?? []).size;
      if (score > bestScore) {
        best = text;
        bestScore = score;
      }
    }
    return best;
  };
  return pick((text) => text) ?? pick(foldInHalf);
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
