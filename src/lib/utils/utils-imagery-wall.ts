/**
 * 主页封面墙的意象计算：点灯（多个意象取交集）、相认（与某首共有意象的作品）、年度意象。
 * 都是纯函数，服务端与客户端算出的结果一致。
 */

import type { LibraryImagery, LibraryImageryItem } from "@/lib/types";

export interface ImageryCorpus {
  /** 歌曲 id → 写到的意象 */
  bySong: Map<number, Set<number>>;
  /** 意象 id → 全库写到它的作品数 */
  df: Map<number, number>;
  /** 有意象标注的作品数 */
  n: number;
}

export function buildCorpus(imagery: LibraryImagery): ImageryCorpus {
  const bySong = new Map<number, Set<number>>();
  for (const [songId, ids] of Object.entries(imagery.bySong)) {
    bySong.set(Number(songId), new Set(ids));
  }
  const df = new Map(imagery.items.map((i) => [i.id, i.songCount]));
  return { bySong, df, n: bySong.size };
}

function idfOf(corpus: ImageryCorpus, id: number): number {
  const df = corpus.df.get(id) ?? corpus.n;
  return Math.log(corpus.n / Math.max(df, 1));
}

/** 写到的作品最多的几个意象，同数时按 id 定序，保证每次一样 */
export function topImagery(
  items: LibraryImageryItem[],
  limit: number,
): LibraryImageryItem[] {
  return [...items]
    .sort((a, b) => b.songCount - a.songCount || a.id - b.id)
    .slice(0, limit);
}

/** 同时写到这几个意象的作品 */
export function songsWithAll(
  corpus: ImageryCorpus,
  imageryIds: readonly number[],
): Set<number> {
  const result = new Set<number>();
  if (imageryIds.length === 0) return result;
  for (const [songId, set] of corpus.bySong) {
    if (imageryIds.every((id) => set.has(id))) result.add(songId);
  }
  return result;
}

/**
 * 与某首共有意象、气质最近的作品，按相似度从高到低。
 * 算法同歌曲页「同有此意」：以 IDF 加权的意象集合余弦相似度，少见的共同意象分量更重。
 */
export function kinOf(
  corpus: ImageryCorpus,
  songId: number,
  limit: number,
): number[] {
  const own = corpus.bySong.get(songId);
  if (!own || own.size === 0) return [];
  const norm = (set: Set<number>) =>
    Math.sqrt([...set].reduce((sum, id) => sum + idfOf(corpus, id) ** 2, 0));
  const ownNorm = norm(own);
  if (ownNorm === 0) return [];

  const scored: Array<{ id: number; score: number }> = [];
  for (const [otherId, set] of corpus.bySong) {
    if (otherId === songId) continue;
    let dot = 0;
    for (const id of set) if (own.has(id)) dot += idfOf(corpus, id) ** 2;
    if (dot === 0) continue;
    const denom = ownNorm * norm(set);
    if (denom > 0) scored.push({ id: otherId, score: dot / denom });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  return scored.slice(0, limit).map((s) => s.id);
}

/**
 * 每一年的代表意象：这一年写得多、别的年份写得少（年内频率 × IDF）。
 * 只算在这一年至少出现两次的，免得一首歌里的生僻字被当成一年的气质。
 */
export function yearSignatures(
  songs: ReadonlyArray<{ id: number; year?: number | null }>,
  corpus: ImageryCorpus,
  perYear: number,
): Map<number, number[]> {
  const byYear = new Map<number, number[]>();
  for (const song of songs) {
    if (!song.year || !corpus.bySong.has(song.id)) continue;
    const list = byYear.get(song.year);
    if (list) list.push(song.id);
    else byYear.set(song.year, [song.id]);
  }

  const result = new Map<number, number[]>();
  for (const [year, songIds] of byYear) {
    const counts = new Map<number, number>();
    for (const songId of songIds) {
      for (const id of corpus.bySong.get(songId) ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const ranked = [...counts]
      .filter(([, count]) => count >= 2)
      .map(([id, count]) => ({
        id,
        count,
        score: (count / songIds.length) * idfOf(corpus, id),
      }))
      .sort((a, b) => b.score - a.score || b.count - a.count || a.id - b.id);
    result.set(
      year,
      ranked.slice(0, perYear).map((r) => r.id),
    );
  }
  return result;
}
