import { describe, expect, it } from "vitest";
import { decodeAnswers, encodeAnswers } from "./codec";
import { DIMENSIONS, DIMENSION_KEYS } from "./dimensions";
import { buildModel, evaluate, userVector } from "./model";
import { buildPool, type PoolRows } from "./pool";
import { QUESTIONS } from "./questions";
import { createRng, gini, simulate } from "./simulate";
import type { QuizQuestion } from "./types";

// ─── 测试数据：每个维度一首「专精」歌曲 ─────────────────────────────────────

function makeRows(): PoolRows {
  const categories: PoolRows["categories"] = [];
  let id = 1;
  for (const dim of DIMENSIONS) {
    const l2 = id++;
    categories.push({
      id: l2,
      name: dim.categories[0],
      parent_id: null,
      level: 2,
    });
    categories.push({
      id: id++,
      name: `${dim.label}-子类`,
      parent_id: l2,
      level: 3,
    });
  }
  const leafOf = (i: number) => categories[i * 2 + 1].id;

  const imagery = [
    { id: 1, name: "明月" },
    { id: 2, name: "杂项" },
  ];
  const songs: PoolRows["songs"] = [];
  const occurrences: PoolRows["occurrences"] = [];
  DIMENSIONS.forEach((dim, i) => {
    const songId = 100 + i;
    songs.push({
      id: songId,
      title: `专精·${dim.label}`,
      artist: ["河图"],
      album: `专辑${i}`,
      hascover: true,
      has_audio: true,
      type: ["原创"],
    });
    // 主维度 10 条，其余维度各 1 条
    DIMENSIONS.forEach((_, k) => {
      const n = k === i ? 10 : 1;
      for (let c = 0; c < n; c += 1) {
        occurrences.push({
          song_id: songId,
          category_id: leafOf(k),
          imagery_id: dim.key === "tianxiang" && k === i ? 1 : 2,
          lyric_timetag: [`00:${String(10 + c).padStart(2, "0")}.00`],
        });
      }
    });
  });
  // 不应入池：翻唱、衍生版本、标注不足
  songs.push({
    id: 900,
    title: "翻唱曲",
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type: ["翻唱"],
  });
  songs.push({
    id: 901,
    title: "专精·天象（纯歌版）",
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type: ["原创"],
  });
  songs.push({
    id: 902,
    title: "标注太少",
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type: ["原创"],
  });
  for (const songId of [900, 901]) {
    for (let c = 0; c < 12; c += 1) {
      occurrences.push({
        song_id: songId,
        category_id: leafOf(0),
        imagery_id: 2,
        lyric_timetag: null,
      });
    }
  }
  occurrences.push({
    song_id: 902,
    category_id: leafOf(0),
    imagery_id: 2,
    lyric_timetag: null,
  });

  return { categories, imagery, occurrences, songs };
}

describe("codec", () => {
  it("作答与短串互转", () => {
    const answers = QUESTIONS.map((_, i) => i % 4);
    const code = encodeAnswers(answers);
    expect(code).toHaveLength(QUESTIONS.length);
    expect(decodeAnswers(code, QUESTIONS)).toEqual(answers);
    expect(decodeAnswers(code.toLowerCase(), QUESTIONS)).toEqual(answers);
  });

  it("拒绝长度或选项不合法的短串", () => {
    expect(decodeAnswers(null, QUESTIONS)).toBeNull();
    expect(decodeAnswers("AB", QUESTIONS)).toBeNull();
    expect(decodeAnswers("Z".repeat(QUESTIONS.length), QUESTIONS)).toBeNull();
  });
});

describe("questions", () => {
  it("每题四个选项，维度与意象均已定义", () => {
    expect(() => buildModel([], QUESTIONS)).not.toThrow();
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4);
  });

  it("每个维度都能被作答拉高", () => {
    const covered = new Set(
      QUESTIONS.flatMap((q) => q.options.flatMap((o) => Object.keys(o.dims))),
    );
    expect([...covered].sort()).toEqual([...DIMENSION_KEYS].sort());
  });
});

describe("buildPool", () => {
  it("只收原创/合作、非衍生版本、标注充足的歌曲", () => {
    const pool = buildPool(makeRows());
    expect(pool.map((s) => s.id)).toEqual(DIMENSIONS.map((_, i) => 100 + i));
  });

  it("三级分类归入维度，别名归入招牌意象", () => {
    const song = buildPool(makeRows())[0];
    expect(song.dimCounts.tianxiang).toBe(10);
    expect(song.dimCounts.shanhe).toBe(1);
    expect(song.imageryCounts["月"]).toBe(10);
    expect(song.occurrences[0]).toMatchObject({
      dim: "tianxiang",
      imagery: "明月",
      timetag: "00:10.00",
    });
  });
});

describe("userVector", () => {
  it("解析标准化与穷举分布一致", () => {
    // 两道小题可以穷举全部作答，验证均值为 0、方差为 1
    const questions: QuizQuestion[] = [
      {
        title: "甲",
        stem: "",
        options: [
          { text: "", dims: { tianxiang: 2 } },
          { text: "", dims: { shanhe: 1 } },
          { text: "", dims: { tianxiang: 1, qingsi: 2 } },
        ],
      },
      {
        title: "乙",
        stem: "",
        options: [
          { text: "", dims: { tianxiang: 1 } },
          { text: "", dims: { qingsi: 2 }, imagery: ["月"] },
        ],
      },
    ];
    const model = buildModel([], questions);
    const zs: Float64Array[] = [];
    for (let a = 0; a < 3; a += 1)
      for (let b = 0; b < 2; b += 1) zs.push(userVector(model, [a, b]).z);
    for (let f = 0; f < model.features.length; f += 1) {
      const values = zs.map((z) => z[f]);
      const mean = values.reduce((x, y) => x + y, 0) / values.length;
      const variance =
        values.reduce((x, y) => x + (y - mean) ** 2, 0) / values.length;
      expect(mean).toBeCloseTo(0, 10);
      if (model.userSd[f] > 0) expect(variance).toBeCloseTo(1, 10);
    }
  });

  it("作答数量不符时报错", () => {
    const model = buildModel([], QUESTIONS);
    expect(() => userVector(model, [0])).toThrow(RangeError);
  });
});

describe("evaluate", () => {
  const model = buildModel(buildPool(makeRows()), QUESTIONS);

  /** 找出让某维度 z 分数最高的作答：每题选该维度权重最大的选项 */
  function answersFavoring(key: string) {
    return QUESTIONS.map((q) => {
      let best = 0;
      q.options.forEach((o, i) => {
        const w = (o.dims as Record<string, number>)[key] ?? 0;
        const bw = (q.options[best].dims as Record<string, number>)[key] ?? 0;
        if (w > bw) best = i;
      });
      return best;
    });
  }

  it.each(DIMENSION_KEYS.map((k) => [k]))(
    "偏好 %s 的作答首选对应专精歌曲",
    (key) => {
      const result = evaluate(model, answersFavoring(key));
      expect(result.profile[0].key).toBe(key);
      const song = model.songs.find((s) => s.id === result.matches[0].songId);
      expect(song?.dimCounts[key]).toBe(10);
      expect(result.matches[0].reasons[0]).toEqual({ kind: "dimension", key });
    },
  );

  it("结果稳定、契合度递减且在 0–100 之间", () => {
    const answers = QUESTIONS.map((_, i) => (i * 3) % 4);
    const a = evaluate(model, answers);
    expect(evaluate(model, answers)).toEqual(a);
    expect(a.matches).toHaveLength(5);
    for (let i = 1; i < a.matches.length; i += 1) {
      expect(a.matches[i].score).toBeLessThanOrEqual(a.matches[i - 1].score);
    }
    for (const m of a.matches) {
      expect(m.percent).toBeGreaterThanOrEqual(0);
      expect(m.percent).toBeLessThanOrEqual(100);
    }
  });

  it("记录用户选中的招牌意象", () => {
    const result = evaluate(
      model,
      QUESTIONS.map(() => 0),
    );
    expect(result.imagery).toContain("月");
    expect(result.imagery).toContain("雨");
    expect(result.imagery).not.toContain("酒");
  });
});

describe("simulate", () => {
  it("相同种子结果相同，计数守恒", () => {
    const model = buildModel(buildPool(makeRows()), QUESTIONS);
    const a = simulate(model, 300, 7);
    const b = simulate(model, 300, 7);
    expect([...a.firstCount]).toEqual([...b.firstCount]);
    const sum = (m: Map<number, number>) =>
      [...m.values()].reduce((x, y) => x + y, 0);
    expect(sum(a.firstCount)).toBe(300);
    expect(sum(a.topCount)).toBe(300 * 5);
  });

  it("随机数落在 [0, 1)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i += 1) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("基尼系数：均匀为 0，完全集中趋近 1", () => {
    expect(gini([5, 5, 5, 5])).toBeCloseTo(0);
    expect(gini([0, 0, 0, 100])).toBeCloseTo(0.75);
  });
});
