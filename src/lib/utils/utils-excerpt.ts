import {
  buildFolio,
  markLines,
  type FolioLine,
  type FolioOptions,
  type MarkedLine,
  type MarkInput,
} from "@/lib/utils/utils-folio";

/**
 * 卷首摘句：从一首歌的歌词里挑一句竖排展示。歌曲页卷首、登录页封面墙共用。
 *
 * 一般直接用 songExcerpt；手上已经有 buildFolio 的结果时用 pickExcerpt。
 * 折长句要用 Intl.Segmenter，分词随运行环境而异，只在服务端调用，
 * 结果作为 props 传给页面，免得前后端挑出的不一样。
 *
 * 意象标注决定挑哪句，同一首歌各处要传同样的 marks 才挑得出同一句：
 * 从意象索引现算的用 groupMarks。繁体页面先把歌词、意象名转好再传进来。
 */

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

/** 折句时宜断在其后的字：结构助词与方位词 */
const BREAK_AFTER = new Set("的里裡裏中上下外旁前后後间間边邊");
/** 宜断在其前的字：副词、介词、连词、指代与数量 */
const BREAK_BEFORE = new Set(
  "正已却卻只仍还還又也都早未不似如像在至于於与與和同把被将將为為某一几幾每这這那",
);
/** 不宜断在其前的字：动态助词、补语标记，须跟着前面的动词 */
const NO_BREAK_BEFORE = new Set("着著了过過得");

/**
 * 放不进一列的长句折成两列：两列都不超过列长上限，断点越靠中间越好，
 * 落在虚词边界上加分，切开分词得到的词或落在助词之前扣分。
 * Intl.Segmenter 的分词随运行环境的词典而异，只在服务端调用，免得前后端断法不一。
 */
function foldInHalf(text: string): string | null {
  const chars = Array.from(text);
  const n = chars.length;
  if (text.includes(" ") || n > EXCERPT_MAX_COLUMN_CHARS * 2) return null;

  // 落在多字词内部的断点
  const insideWord = new Set<number>();
  let pos = 0;
  for (const { segment } of new Intl.Segmenter("zh", {
    granularity: "word",
  }).segment(text)) {
    const length = Array.from(segment).length;
    for (let k = 1; k < length; k++) insideWord.add(pos + k);
    pos += length;
  }

  let best = -1;
  let bestScore = -Infinity;
  for (let p = 1; p < n; p++) {
    if (p > EXCERPT_MAX_COLUMN_CHARS || n - p > EXCERPT_MAX_COLUMN_CHARS)
      continue;
    let score = -Math.abs(p - n / 2);
    if (BREAK_AFTER.has(chars[p - 1]) || BREAK_BEFORE.has(chars[p]))
      score += 2.5;
    if (insideWord.has(p)) score -= 3;
    if (NO_BREAK_BEFORE.has(chars[p])) score -= 3;
    // 同分取靠前者：前一列短些，竖排时右起一列更利落
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (best < 0) return null;
  return `${chars.slice(0, best).join("")} ${chars.slice(best).join("")}`;
}

/**
 * 卷首摘句：意象最密集、长度适合竖排的一句；同分取靠前者。
 * 没有意象标注时取第一句长度合适的歌词。
 * 一句都放不下时（每句都是不带空格的长句），把长句折成两列再挑。
 * 折句要用 Intl.Segmenter，须在服务端调用，结果作为 props 传给页面。
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

/**
 * 一步取摘句：分行、定位意象、挑句。lyrics 与 title 须是同一种字形（都简或都繁）。
 */
export function songExcerpt(
  lyrics: string | null | undefined,
  options: FolioOptions & { marks?: MarkInput[] } = {},
): string | null {
  const { marks = [], ...folioOptions } = options;
  const { lines } = buildFolio(lyrics, folioOptions);
  return pickExcerpt(lines, markLines(lines, marks));
}

// ─── 意象标注 ────────────────────────────────────────────────────────────────

export interface MarkOccurrence {
  song_id: number;
  imagery_id: number;
  lyric_timetag: string[] | null;
}

/**
 * 每首歌的意象标注，整理成 markLines 要的样子：一个词一条，时间标签取并集。
 * 详情页（getSongImagery）与登录页封面墙都从这里取，摘句才挑得出同一句；
 * 顺序按标注首次出现的先后。
 */
export function groupMarks(
  occurrences: MarkOccurrence[],
  imagery: Array<{ id: number; name: string }>,
): Map<number, MarkInput[]> {
  const nameById = new Map(imagery.map((i) => [i.id, i.name]));
  const bySong = new Map<number, Map<number, MarkInput>>();
  for (const occ of occurrences) {
    const name = nameById.get(occ.imagery_id);
    if (!name) continue;
    let marks = bySong.get(occ.song_id);
    if (!marks) bySong.set(occ.song_id, (marks = new Map()));
    let mark = marks.get(occ.imagery_id);
    if (!mark) {
      marks.set(
        occ.imagery_id,
        (mark = { id: occ.imagery_id, name, timetags: [] }),
      );
    }
    for (const tag of occ.lyric_timetag ?? []) {
      if (!mark.timetags.includes(tag)) mark.timetags.push(tag);
    }
  }
  return new Map([...bySong].map(([id, marks]) => [id, [...marks.values()]]));
}
