import { DIMENSION_KEYS, SIGNATURE_IMAGERY } from "./dimensions";
import type {
  Answers,
  DimensionKey,
  MatchReason,
  PoolSong,
  QuizQuestion,
  QuizResult,
  SongMatch,
} from "./types";

/**
 * 匹配模型。
 *
 * 特征 = 9 个意象维度 + 若干招牌意象 + 情绪坐标（明暗、扬抑两条轴）。
 * 情绪只参与匹配，不出现在匹配理由与结果画像里。用户与歌曲各自标准化后比较「偏向」：
 *
 * - 用户：假设每题独立、选项等概率，特征加总的均值与方差可由选项权重直接解析算出，
 *   据此把原始分转为 z 分数。无需模拟，也无需手调中心值。
 * - 歌曲：维度取占比（消除歌词长短的影响），招牌意象取 log(1+次数)，
 *   情绪取由基调算出的坐标（没有基调的歌取池内均值），再在候选池内逐特征标准化。
 * - 匹配：加权余弦相似度。比较方向而非距离，避免靠近均值的「中庸」歌曲包揽第一。
 *   多人合唱的歌再减去一个固定值，见 ENSEMBLE_PENALTY。
 */

/** 招牌意象特征相对维度特征的权重 */
const IMAGERY_GROUP_WEIGHT = 0.6;
/** 情绪坐标每条轴相对维度特征的权重 */
export const MOOD_WEIGHT = 1;
const MOOD_AXES = ["tone", "energy"] as const;
/** 结果中同一专辑最多出现几首 */
const MAX_PER_ALBUM = 2;
/** 演唱者达到几人算多人合唱 */
const ENSEMBLE_SIZE = 5;
/**
 * 多人合唱的歌从相似度里减去的值（契合度约少 PENALTY × 50 个百分点）。
 * 这类歌多是群像、拼盘，意象堆得密，容易靠特征「撞」进前列，但作为推荐价值不高
 */
export const ENSEMBLE_PENALTY = 0.1;

type FeatureKey =
  | { kind: "dimension"; key: DimensionKey }
  | { kind: "imagery"; name: string }
  | { kind: "mood"; axis: (typeof MOOD_AXES)[number] };

export interface QuizModel {
  questions: readonly QuizQuestion[];
  features: FeatureKey[];
  weights: Float64Array;
  /** optionVectors[题][选项] = 该选项的原始特征向量 */
  optionVectors: Float64Array[][];
  userMean: Float64Array;
  userSd: Float64Array;
  songs: PoolSong[];
  /** 与 songs 对齐的标准化歌曲向量 */
  songVectors: Float64Array[];
  /** 与 songs 对齐的加权范数 */
  songNorms: Float64Array;
  /** 与 songs 对齐，从相似度里扣掉的值 */
  songPenalties: Float64Array;
}

function buildFeatures(): FeatureKey[] {
  return [
    ...DIMENSION_KEYS.map((key) => ({ kind: "dimension" as const, key })),
    ...SIGNATURE_IMAGERY.map((s) => ({
      kind: "imagery" as const,
      name: s.name,
    })),
    ...MOOD_AXES.map((axis) => ({ kind: "mood" as const, axis })),
  ];
}

function standardize(values: Float64Array[], f: number): void {
  const n = values.length;
  if (n === 0) return;
  let mean = 0;
  for (const v of values) mean += v[f];
  mean /= n;
  let variance = 0;
  for (const v of values) variance += (v[f] - mean) ** 2;
  const sd = Math.sqrt(variance / n);
  for (const v of values) v[f] = sd > 0 ? (v[f] - mean) / sd : 0;
}

function weightedNorm(v: Float64Array, w: Float64Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i += 1) s += w[i] * v[i] * v[i];
  return Math.sqrt(s);
}

export function buildModel(
  pool: readonly PoolSong[],
  questions: readonly QuizQuestion[],
  /** 只给诊断脚本比较不同取值用 */
  ensemblePenalty = ENSEMBLE_PENALTY,
  moodWeight = MOOD_WEIGHT,
): QuizModel {
  const features = buildFeatures();
  const F = features.length;
  const dimIndex = new Map<string, number>();
  const imageryIndex = new Map<string, number>();
  features.forEach((feat, i) => {
    if (feat.kind === "dimension") dimIndex.set(feat.key, i);
    else if (feat.kind === "imagery") imageryIndex.set(feat.name, i);
  });

  const weights = new Float64Array(
    features.map((feat) =>
      feat.kind === "dimension"
        ? 1
        : feat.kind === "imagery"
          ? IMAGERY_GROUP_WEIGHT
          : moodWeight,
    ),
  );
  const moodIndex = new Map(
    features.flatMap((feat, i) =>
      feat.kind === "mood" ? [[feat.axis, i] as const] : [],
    ),
  );

  // ── 用户侧：选项向量与解析标准化参数 ──
  const optionVectors = questions.map((question) =>
    question.options.map((option) => {
      const vec = new Float64Array(F);
      for (const [key, w] of Object.entries(option.dims)) {
        const i = dimIndex.get(key);
        if (i === undefined) {
          throw new Error(`题目「${question.title}」含未知维度 ${key}`);
        }
        vec[i] += w ?? 0;
      }
      for (const name of option.imagery ?? []) {
        const i = imageryIndex.get(name);
        if (i === undefined) {
          throw new Error(`题目「${question.title}」含未知意象 ${name}`);
        }
        vec[i] += 1;
      }
      for (const axis of MOOD_AXES) {
        const i = moodIndex.get(axis);
        if (i !== undefined) vec[i] += option.mood[axis];
      }
      return vec;
    }),
  );

  const userMean = new Float64Array(F);
  const userVar = new Float64Array(F);
  for (const vectors of optionVectors) {
    const k = vectors.length;
    for (let f = 0; f < F; f += 1) {
      let m = 0;
      let m2 = 0;
      for (const v of vectors) {
        m += v[f];
        m2 += v[f] * v[f];
      }
      m /= k;
      m2 /= k;
      userMean[f] += m;
      userVar[f] += m2 - m * m;
    }
  }
  const userSd = userVar.map(Math.sqrt);

  // ── 歌曲侧：原始特征 → 池内标准化 ──
  // 没有基调的歌取有基调歌曲的均值，标准化后为 0，即情绪上不偏不倚
  const moodMean = Object.fromEntries(
    MOOD_AXES.map((axis) => {
      const values = pool.flatMap((s) => (s.mood ? [s.mood[axis]] : []));
      return [
        axis,
        values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      ];
    }),
  ) as Record<(typeof MOOD_AXES)[number], number>;
  const songVectors = pool.map((song) => {
    const vec = new Float64Array(F);
    features.forEach((feat, i) => {
      vec[i] =
        feat.kind === "dimension"
          ? song.dimCounts[feat.key] / Math.max(song.total, 1)
          : feat.kind === "imagery"
            ? Math.log1p(song.imageryCounts[feat.name] ?? 0)
            : (song.mood?.[feat.axis] ?? moodMean[feat.axis]);
    });
    return vec;
  });
  for (let f = 0; f < F; f += 1) standardize(songVectors, f);
  const songNorms = new Float64Array(
    songVectors.map((v) => weightedNorm(v, weights)),
  );
  const songPenalties = new Float64Array(
    pool.map((song) =>
      (song.artist?.length ?? 0) >= ENSEMBLE_SIZE ? ensemblePenalty : 0,
    ),
  );

  return {
    questions,
    features,
    weights,
    optionVectors,
    userMean,
    userSd,
    songs: [...pool],
    songVectors,
    songNorms,
    songPenalties,
  };
}

/** 作答 → 用户原始特征与 z 分数 */
export function userVector(
  model: QuizModel,
  answers: Answers,
): { raw: Float64Array; z: Float64Array } {
  if (answers.length !== model.questions.length) {
    throw new RangeError("作答数量与题目数量不一致");
  }
  const F = model.features.length;
  const raw = new Float64Array(F);
  answers.forEach((choice, q) => {
    const vec = model.optionVectors[q][choice];
    if (!vec) throw new RangeError(`第 ${q + 1} 题选项越界`);
    for (let f = 0; f < F; f += 1) raw[f] += vec[f];
  });
  const z = new Float64Array(F);
  for (let f = 0; f < F; f += 1) {
    z[f] =
      model.userSd[f] > 0 ? (raw[f] - model.userMean[f]) / model.userSd[f] : 0;
  }
  return { raw, z };
}

/** 所有歌曲的余弦相似度（已扣除多人合唱的降权），与 model.songs 对齐 */
export function scoreSongs(model: QuizModel, z: Float64Array): Float64Array {
  const { weights, songVectors, songNorms, songPenalties } = model;
  const userNorm = weightedNorm(z, weights);
  const scores = new Float64Array(songVectors.length);
  if (userNorm === 0) return scores;
  songVectors.forEach((s, j) => {
    let dot = 0;
    for (let f = 0; f < z.length; f += 1) dot += weights[f] * z[f] * s[f];
    const cosine = songNorms[j] > 0 ? dot / (userNorm * songNorms[j]) : 0;
    scores[j] = cosine - songPenalties[j];
  });
  return scores;
}

/**
 * 按相似度降序排列歌曲下标；同分按歌曲 id 升序，保证结果稳定。
 * maxPerAlbum 限制同一专辑的入选数量，让结果更多样。
 */
export function rankSongs(
  model: QuizModel,
  scores: Float64Array,
  topN: number,
  maxPerAlbum = MAX_PER_ALBUM,
): number[] {
  const order = Array.from(scores.keys()).sort(
    (a, b) => scores[b] - scores[a] || model.songs[a].id - model.songs[b].id,
  );
  const perAlbum = new Map<string, number>();
  const picked: number[] = [];
  for (const j of order) {
    const album = model.songs[j].album;
    if (album) {
      const count = perAlbum.get(album) ?? 0;
      if (count >= maxPerAlbum) continue;
      perAlbum.set(album, count + 1);
    }
    picked.push(j);
    if (picked.length >= topN) break;
  }
  return picked;
}

/** 余弦相似度 → 展示用契合度 */
export function toPercent(score: number): number {
  return Math.round(Math.min(100, Math.max(0, 50 + 50 * score)));
}

/** 用户与歌曲在哪些特征上「同向偏好」，按贡献从大到小取前几项 */
function explain(
  model: QuizModel,
  z: Float64Array,
  songIndex: number,
  limit: number,
): MatchReason[] {
  const s = model.songVectors[songIndex];
  return (
    model.features
      .map((feat, f) => ({
        feat,
        c: model.weights[f] * z[f] * s[f],
        u: z[f],
        v: s[f],
      }))
      // 情绪只参与匹配，不作为理由展示
      .filter((x) => x.feat.kind !== "mood" && x.u > 0 && x.v > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, limit)
      .flatMap(({ feat }): MatchReason[] =>
        feat.kind === "dimension"
          ? [{ kind: "dimension", key: feat.key }]
          : feat.kind === "imagery"
            ? [{ kind: "imagery", name: feat.name }]
            : [],
      )
  );
}

export function evaluate(
  model: QuizModel,
  answers: Answers,
  topN = 5,
): QuizResult {
  const { raw, z } = userVector(model, answers);
  const scores = scoreSongs(model, z);
  const matches: SongMatch[] = rankSongs(model, scores, topN).map((j) => ({
    songId: model.songs[j].id,
    score: scores[j],
    percent: toPercent(scores[j]),
    reasons: explain(model, z, j, 3),
  }));

  const profile: QuizResult["profile"] = [];
  const imagery: string[] = [];
  model.features.forEach((feat, f) => {
    if (feat.kind === "dimension") profile.push({ key: feat.key, z: z[f] });
    else if (feat.kind === "imagery" && raw[f] > 0) imagery.push(feat.name);
  });
  profile.sort((a, b) => b.z - a.z);

  return { profile, imagery, matches };
}
