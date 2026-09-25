import { rankSongs, scoreSongs, userVector, type QuizModel } from "./model";

/** mulberry32：固定种子的伪随机数，只用于复现模拟样本 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulationReport {
  samples: number;
  seed: number;
  topN: number;
  /** 每首歌成为第一契合的次数，键为歌曲 id */
  firstCount: Map<number, number>;
  /** 每首歌进入前 topN 的次数 */
  topCount: Map<number, number>;
}

/**
 * 均匀模拟：每题独立等概率作答，统计推荐分布。
 * 用于发现「总被推荐」的枢纽歌曲与「永远不会被推荐」的歌曲，不代表真实用户偏好。
 */
export function simulate(
  model: QuizModel,
  samples: number,
  seed = 20260926,
  topN = 5,
): SimulationReport {
  const rng = createRng(seed);
  const firstCount = new Map<number, number>();
  const topCount = new Map<number, number>();
  for (const song of model.songs) {
    firstCount.set(song.id, 0);
    topCount.set(song.id, 0);
  }

  for (let i = 0; i < samples; i += 1) {
    const answers = model.questions.map((q) =>
      Math.floor(rng() * q.options.length),
    );
    const { z } = userVector(model, answers);
    const picked = rankSongs(model, scoreSongs(model, z), topN);
    picked.forEach((j, rank) => {
      const id = model.songs[j].id;
      if (rank === 0) firstCount.set(id, (firstCount.get(id) ?? 0) + 1);
      topCount.set(id, (topCount.get(id) ?? 0) + 1);
    });
  }

  return { samples, seed, topN, firstCount, topCount };
}

/** 基尼系数：0 表示完全均匀，1 表示全部集中在一首歌 */
export function gini(counts: Iterable<number>): number {
  const values = [...counts].sort((a, b) => a - b);
  const n = values.length;
  const total = values.reduce((a, b) => a + b, 0);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  values.forEach((v, i) => {
    weighted += (i + 1) * v;
  });
  return (2 * weighted) / (n * total) - (n + 1) / n;
}
