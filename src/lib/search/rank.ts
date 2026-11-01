/**
 * 分档匹配与排序（见 docs/LIBRARY.md 阶段 2「2. 匹配与排序」到「5. 题名近似」）。
 *
 * 一首歌按它命中的最好那一档排序；多个词时每个词都要命中，取各词最好档位中最差的那个。
 * 歌词各档都排在元数据各档之后，所以歌词数据到达时只会在末尾追加结果，已显示的不重排。
 */
import type { Song } from "@/lib/types";
import { type LyricsCorpus, lineAt, lineEnd } from "./corpus";
import { isFuzzyTitleMatch } from "./fuzzy";
import { getSongMeta, namesOf, type SongMeta } from "./meta";
import { splitQuery } from "./normalize";

export const TIER = {
  TITLE_EXACT: 1,
  TITLE_PREFIX: 2,
  TITLE_CONTAINS: 3,
  NAME_EXACT: 4,
  NAME_CONTAINS: 5,
  ALBUM: 6,
  TITLE_FUZZY: 7,
  LYRIC_LINE: 8,
  LYRIC_CONTAINS: 9,
  LYRIC_FALLBACK: 10,
} as const;
export type Tier = (typeof TIER)[keyof typeof TIER];

/** 精确命中的歌少于这么多首时才启用歌词兜底。评测里设成 3 会给打对了的题名（如「明月如霜」）带出近似的歌词，所以只在一首都没有时兜底 */
export const FALLBACK_BELOW = 1;
/** 兜底：一句至少包含搜索词这么大比例的相邻两字片段 */
export const FALLBACK_THRESHOLD = 0.6;
/** 兜底：一句至少命中这么多个片段 */
const FALLBACK_MIN_GRAMS = 2;

export interface LyricMatch {
  /** 显示片段用的那一句（corpus 里的句号） */
  line: number;
  /** 这首歌命中的句数（界面上显示「等 N 处」） */
  count: number;
}

export interface SearchHit<T extends Song = Song> {
  song: T;
  tier: Tier;
  /** 只有落在歌词各档的歌才有 */
  lyric?: LyricMatch;
}

export interface SearchResult<T extends Song = Song> {
  /** 归一化之后的搜索词，片段高亮用 */
  words: string[];
  hits: SearchHit<T>[];
}

/** 一个词在元数据上的最好档位，0 表示没命中（题名近似另算） */
function metaTier(meta: SongMeta, word: string): number {
  const { title } = meta;
  if (title === word) return TIER.TITLE_EXACT;
  if (title.startsWith(word)) return TIER.TITLE_PREFIX;
  if (title.includes(word)) return TIER.TITLE_CONTAINS;
  const names = namesOf(meta);
  if (names.includes(word)) return TIER.NAME_EXACT;
  if (names.some((n) => n.includes(word))) return TIER.NAME_CONTAINS;
  if (meta.album.includes(word)) return TIER.ALBUM;
  return 0;
}

/** 每首歌在歌词里命中的句子：句号 → 命中了哪几个词（位掩码） */
type LineHits = Map<number, number>;

interface FallbackHit {
  line: number;
  coverage: number;
  count: number;
}

/**
 * 搜索。query 里没有可搜的字（空串、全是标点）时返回 null，调用方照常显示全部。
 * corpus 为 null 表示歌词数据还没就绪，只查元数据各档。
 */
export function searchSongs<T extends Song>(
  songs: readonly T[],
  query: string,
  corpus: LyricsCorpus | null,
): SearchResult<T> | null {
  const words = splitQuery(query);
  if (words.length === 0) return null;

  const n = songs.length;
  const metas = songs.map(getSongMeta);
  const indexById = new Map<number, number>();
  metas.forEach((m, i) => indexById.set(m.id, i));

  const perWord: Uint8Array[] = [];
  const lineHits = new Map<number, LineHits>();

  words.forEach((word, k) => {
    const best = new Uint8Array(n);
    let anyMeta = false;
    for (let i = 0; i < n; i++) {
      best[i] = metaTier(metas[i], word);
      if (best[i]) anyMeta = true;
    }
    // 题名近似只在这个词在元数据上一处都没对上时才做：打对了题名，就不再带出相近的题名。
    // 这个条件不看歌词，所以歌词数据到达前后结果一样
    if (!anyMeta) {
      for (let i = 0; i < n; i++) {
        if (isFuzzyTitleMatch(word, metas[i].title)) best[i] = TIER.TITLE_FUZZY;
      }
    }
    // 单字不搜歌词，否则几乎每首歌都会命中
    if (corpus && word.length >= 2) {
      collectLyricHits(corpus, word, k, indexById, best, lineHits);
    }
    perWord.push(best);
  });

  const tiers = new Uint8Array(n);
  let matched = 0;
  for (let i = 0; i < n; i++) {
    let worst = 0;
    for (const best of perWord) {
      if (!best[i]) {
        worst = 0;
        break;
      }
      if (best[i] > worst) worst = best[i];
    }
    tiers[i] = worst;
    if (worst) matched++;
  }

  const fallback = new Map<number, FallbackHit>();
  if (corpus && matched < FALLBACK_BELOW) {
    const perWordFallback = words.map((w) =>
      w.length >= 3 ? fallbackLines(corpus, w, indexById) : null,
    );
    for (let i = 0; i < n; i++) {
      if (tiers[i]) continue;
      // 精确命中不了的词都要在兜底里找到；有几个时，片段取覆盖率最低的那个词的句子
      let chosen: FallbackHit | undefined;
      let ok = true;
      for (let k = 0; k < words.length && ok; k++) {
        if (perWord[k][i]) continue;
        const hit = perWordFallback[k]?.get(i);
        if (!hit) ok = false;
        else if (!chosen || hit.coverage < chosen.coverage) chosen = hit;
      }
      if (ok && chosen) {
        tiers[i] = TIER.LYRIC_FALLBACK;
        fallback.set(i, chosen);
      }
    }
  }

  const hits: (SearchHit<T> & {
    order: number;
    first: number;
    score: number;
  })[] = [];
  for (let i = 0; i < n; i++) {
    const tier = tiers[i] as Tier | 0;
    if (!tier) continue;
    const hit: SearchHit<T> & { order: number; first: number; score: number } =
      {
        song: songs[i],
        tier,
        order: i,
        first: 0,
        score: 0,
      };
    if (tier === TIER.LYRIC_FALLBACK) {
      const fb = fallback.get(i) as FallbackHit;
      hit.lyric = { line: fb.line, count: fb.count };
      hit.score = fb.coverage;
    } else if (tier >= TIER.LYRIC_LINE && corpus) {
      const lines = lineHits.get(i) as LineHits;
      const pick = pickLine(lines);
      hit.lyric = { line: pick, count: lines.size };
      hit.score = lines.size;
      hit.first = corpus.lineIndex[Math.min(...lines.keys())];
    }
    hits.push(hit);
  }

  hits.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.score - a.score ||
      a.first - b.first ||
      a.order - b.order,
  );
  return {
    words,
    hits: hits.map(({ song, tier, lyric }) =>
      lyric ? { song, tier, lyric } : { song, tier },
    ),
  };
}

/** 歌词里精确命中这个词的句子，记进 best（第 8、9 档）和 lineHits */
function collectLyricHits(
  corpus: LyricsCorpus,
  word: string,
  k: number,
  indexById: Map<number, number>,
  best: Uint8Array,
  lineHits: Map<number, LineHits>,
) {
  const text = corpus.corpus;
  const bit = k < 31 ? 1 << k : 0;
  let p = text.indexOf(word);
  while (p !== -1) {
    const line = lineAt(corpus, p);
    const end = lineEnd(corpus, line);
    const i = indexById.get(corpus.lineSong[line]);
    if (i !== undefined) {
      const whole = p === corpus.lineStart[line] && end - p === word.length;
      const tier = whole ? TIER.LYRIC_LINE : TIER.LYRIC_CONTAINS;
      if (!best[i] || tier < best[i]) best[i] = tier;
      let lines = lineHits.get(i);
      if (!lines) lineHits.set(i, (lines = new Map()));
      lines.set(line, (lines.get(line) ?? 0) | bit);
    }
    // 同一句里再出现不用再数，直接跳到下一句
    p = text.indexOf(word, end + 1);
  }
}

/** 片段用哪一句：同时包含的词最多的，一样多时取最靠前的 */
function pickLine(lines: LineHits): number {
  let bestLine = -1;
  let bestCount = -1;
  for (const [line, mask] of lines) {
    const count = popcount(mask);
    if (count > bestCount || (count === bestCount && line < bestLine)) {
      bestLine = line;
      bestCount = count;
    }
  }
  return bestLine;
}

function popcount(x: number): number {
  let c = 0;
  for (let v = x >>> 0; v; v &= v - 1) c++;
  return c;
}

/** 搜索词的相邻两字片段，去重 */
export function bigrams(word: string): string[] {
  const grams = new Set<string>();
  for (let i = 0; i + 1 < word.length; i++) grams.add(word.slice(i, i + 2));
  return [...grams];
}

/**
 * 兜底：逐句数包含了多少个片段，覆盖率够高的句子算命中，每首歌取覆盖率最高的一句。
 * 返回 歌在 songs 里的下标 → 那一句。
 */
function fallbackLines(
  corpus: LyricsCorpus,
  word: string,
  indexById: Map<number, number>,
): Map<number, FallbackHit> {
  const grams = bigrams(word);
  const out = new Map<number, FallbackHit>();
  if (grams.length < FALLBACK_MIN_GRAMS) return out;

  const text = corpus.corpus;
  const perLine = new Map<number, number>();
  for (const gram of grams) {
    let p = text.indexOf(gram);
    while (p !== -1) {
      const line = lineAt(corpus, p);
      perLine.set(line, (perLine.get(line) ?? 0) + 1);
      p = text.indexOf(gram, lineEnd(corpus, line) + 1);
    }
  }

  for (const [line, count] of perLine) {
    const coverage = count / grams.length;
    if (count < FALLBACK_MIN_GRAMS || coverage < FALLBACK_THRESHOLD) continue;
    const i = indexById.get(corpus.lineSong[line]);
    if (i === undefined) continue;
    const prev = out.get(i);
    if (!prev) {
      out.set(i, { line, coverage, count: 1 });
    } else {
      prev.count++;
      if (
        coverage > prev.coverage ||
        (coverage === prev.coverage && line < prev.line)
      ) {
        prev.line = line;
        prev.coverage = coverage;
      }
    }
  }
  return out;
}
