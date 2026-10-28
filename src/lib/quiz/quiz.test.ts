import { describe, expect, it } from "vitest";
import {
  decodeAnswers,
  decodeResultSlug,
  encodeAnswers,
  encodeResultSlug,
  resultSlugLength,
} from "./codec";
import { DIMENSIONS, DIMENSION_KEYS } from "./dimensions";
import {
  ENSEMBLE_PENALTY,
  MOOD_WEIGHT,
  TYPE_PENALTIES,
  buildModel,
  evaluate,
  scoreSongs,
  userVector,
} from "./model";
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
    // 天象的母题取名「月」，让「明月」计入招牌意象「月」
    categories.push({
      id: id++,
      name: dim.key === "tianxiang" ? "月" : `${dim.label}-子类`,
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
      date: "2012-01-01",
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
    date: "2012-01-01",
  });
  songs.push({
    id: 901,
    title: "专精·天象（纯歌版）",
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type: ["原创"],
    date: "2012-01-01",
  });
  songs.push({
    id: 902,
    title: "标注太少",
    artist: null,
    album: null,
    hascover: null,
    has_audio: null,
    type: ["原创"],
    date: "2012-01-01",
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

describe("result slug", () => {
  const counts = QUESTIONS.map((q) => q.options.length);

  it("作答与乱码互转，长度固定且不是保存记录用的 10 位", () => {
    const length = resultSlugLength(counts);
    expect(length).not.toBe(10);
    for (const answers of [
      QUESTIONS.map(() => 0),
      QUESTIONS.map((_, i) => i % 4),
      QUESTIONS.map(() => 3),
    ]) {
      const slug = encodeResultSlug(answers, counts);
      expect(slug).toMatch(/^[0-9A-Za-z]+$/);
      expect(slug).toHaveLength(length);
      expect(decodeResultSlug(slug, counts)).toEqual(answers);
    }
  });

  it("只差一题的两个结果，乱码大半不同", () => {
    const a = QUESTIONS.map(() => 0);
    const b = [...a];
    b[b.length - 1] = 1;
    const sa = encodeResultSlug(a, counts);
    const sb = encodeResultSlug(b, counts);
    const same = [...sa].filter((ch, i) => ch === sb[i]).length;
    expect(same).toBeLessThan(sa.length / 2);
  });

  it("拒绝长度、字符或校验不对的乱码", () => {
    const slug = encodeResultSlug(
      QUESTIONS.map(() => 1),
      counts,
    );
    expect(decodeResultSlug(null, counts)).toBeNull();
    expect(decodeResultSlug(slug.slice(1), counts)).toBeNull();
    expect(decodeResultSlug(`${slug.slice(1)}-`, counts)).toBeNull();
    const flipped = slug.slice(0, -1) + (slug.at(-1) === "a" ? "b" : "a");
    expect(decodeResultSlug(flipped, counts)).toBeNull();
    // 题目数变了，旧链接作废
    expect(decodeResultSlug(slug, [...counts, 4])).toBeNull();
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
  it("排除翻唱、衍生版本与标注不足的歌曲", () => {
    const pool = buildPool(makeRows());
    expect(pool.map((s) => s.id)).toEqual(DIMENSIONS.map((_, i) => 100 + i));
  });

  it("除翻唱、参与外的类型及未标类型的作品都入池", () => {
    const rows = makeRows();
    const leaf = rows.categories.find((c) => c.level === 3)?.id ?? 0;
    const extra: Array<[number, string[] | null]> = [
      [910, ["参与"]],
      [911, ["文宣"]],
      [912, ["商业"]],
      [913, ["墨宝"]],
      [914, null],
      [915, ["合作", "翻唱"]],
    ];
    for (const [id, type] of extra) {
      rows.songs.push({
        id,
        title: `作品${id}`,
        artist: null,
        album: null,
        hascover: null,
        has_audio: null,
        type,
        date: "2012-01-01",
      });
      for (let c = 0; c < 12; c += 1) {
        rows.occurrences.push({
          song_id: id,
          category_id: leaf,
          imagery_id: 2,
          lyric_timetag: null,
        });
      }
    }
    const ids = buildPool(rows).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([911, 912, 913, 914]));
    expect(ids).not.toContain(910);
    expect(ids).not.toContain(915);
  });

  it("排除日期未知的作品", () => {
    const rows = makeRows();
    rows.songs[0].date = null;
    const ids = buildPool(rows).map((s) => s.id);
    expect(ids).not.toContain(rows.songs[0].id);
    expect(ids).toHaveLength(DIMENSIONS.length - 1);
  });

  it("母题向上归入维度，并按母题计入招牌意象", () => {
    const song = buildPool(makeRows())[0];
    expect(song.dimCounts.tianxiang).toBe(10);
    expect(song.dimCounts.shanhe).toBe(1);
    expect(song.imageryCounts["月"]).toBe(10);
    expect(song.occurrences[0]).toMatchObject({
      dim: "tianxiang",
      imagery: "明月",
      signature: "月",
      timetag: "00:10.00",
    });
    // 不是招牌意象母题的标注不计入
    expect(song.occurrences.find((o) => o.dim === "shanhe")?.signature).toBe(
      null,
    );
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
          { text: "", dims: { tianxiang: 2 }, mood: { tone: 1, energy: 0 } },
          { text: "", dims: { shanhe: 1 }, mood: { tone: -1, energy: 1 } },
          {
            text: "",
            dims: { tianxiang: 1, qingsi: 2 },
            mood: { tone: 0, energy: -1 },
          },
        ],
      },
      {
        title: "乙",
        stem: "",
        options: [
          { text: "", dims: { tianxiang: 1 }, mood: { tone: 1, energy: 1 } },
          {
            text: "",
            dims: { qingsi: 2 },
            imagery: ["月"],
            mood: { tone: -1, energy: -1 },
          },
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
    expect(result.imagery).toContain("山");
    expect(result.imagery).toContain("江河");
    expect(result.imagery).not.toContain("酒");
  });

  it("z 分数并列时，人格取作为主维度被选中更多的维度", () => {
    // 天象与山河的解析分布完全相同；全选第一项时两者原始分都是 2（高于均值 4/3），
    // 但山河来自一次主维度，天象来自两次副维度。按定义顺序天象在前，并列规则应让山河胜出
    const neutral = { tone: 0, energy: 0 };
    const filler = {
      title: "",
      stem: "",
      options: [
        { text: "", dims: { caomu: 2, tianxiang: 1 }, mood: neutral },
        { text: "", dims: { caomu: 2, shanhe: 1 }, mood: neutral },
        { text: "", dims: { caomu: 2 }, mood: neutral },
      ],
    };
    const questions: QuizQuestion[] = [
      {
        title: "",
        stem: "",
        options: [
          { text: "", dims: { shanhe: 2 }, mood: neutral },
          { text: "", dims: { tianxiang: 2 }, mood: neutral },
          { text: "", dims: { qiyong: 2 }, mood: neutral },
        ],
      },
      filler,
      filler,
    ];
    const tied = buildModel([], questions);
    const result = evaluate(tied, [0, 0, 0]);
    const z = (key: string) => result.profile.find((p) => p.key === key)?.z;
    expect(z("shanhe")).toBe(z("tianxiang"));
    expect(result.profile[0].key).toBe("shanhe");
    expect(result.profile[1].key).toBe("tianxiang");
  });

  it("五人及以上演唱的歌扣除固定分值，其余不受影响", () => {
    const rows = makeRows();
    rows.songs[0].artist = ["甲", "乙", "丙", "丁"];
    rows.songs[1].artist = ["甲", "乙", "丙", "丁", "戊"];
    const pool = buildPool(rows);
    const plain = buildModel(pool, QUESTIONS, 0);
    const penalized = buildModel(pool, QUESTIONS);
    const { z } = userVector(plain, answersFavoring(DIMENSION_KEYS[1]));
    const before = scoreSongs(plain, z);
    const after = scoreSongs(penalized, z);
    plain.songs.forEach((song, j) => {
      const expected =
        song.id === rows.songs[1].id ? before[j] - ENSEMBLE_PENALTY : before[j];
      expect(after[j]).toBeCloseTo(expected, 12);
    });
  });

  it("商业、文宣作品按类型扣除固定分值，与多人合唱的降权叠加", () => {
    const rows = makeRows();
    rows.songs[2].type = ["商业"];
    rows.songs[3].type = ["商业"];
    rows.songs[3].artist = ["甲", "乙", "丙", "丁", "戊"];
    rows.songs[4].type = ["文宣"];
    const pool = buildPool(rows);
    const plain = buildModel(pool, QUESTIONS, 0, MOOD_WEIGHT, {});
    const penalized = buildModel(pool, QUESTIONS);
    const { z } = userVector(plain, answersFavoring(DIMENSION_KEYS[2]));
    const before = scoreSongs(plain, z);
    const after = scoreSongs(penalized, z);
    plain.songs.forEach((song, j) => {
      const penalty =
        song.id === rows.songs[2].id
          ? TYPE_PENALTIES["商业"]
          : song.id === rows.songs[3].id
            ? TYPE_PENALTIES["商业"] + ENSEMBLE_PENALTY
            : song.id === rows.songs[4].id
              ? TYPE_PENALTIES["文宣"]
              : 0;
      expect(after[j]).toBeCloseTo(before[j] - penalty, 12);
    });
  });
});

describe("情绪坐标", () => {
  const emotion = (
    song_id: number,
    rank: number,
    tone: string,
    energy: string,
  ) => ({
    song_id,
    rank,
    emotions: { tone, energy },
  });

  it("主基调权重 2、副基调 1，明 / 扬为正；没有基调的歌为 null", () => {
    const rows = makeRows();
    rows.songEmotions = [
      // 悲怆（暗扬）为主，执守（暗扬）、苍凉（暗抑）为副
      emotion(100, 1, "暗", "扬"),
      emotion(100, 2, "暗", "扬"),
      emotion(100, 3, "暗", "抑"),
    ];
    const pool = buildPool(rows);
    expect(pool.find((s) => s.id === 100)?.mood).toEqual({
      tone: -1,
      energy: 0.5,
    });
    expect(pool.find((s) => s.id === 101)?.mood).toBeNull();
  });

  it("意象相同时，情绪相近的歌排在前面；情绪不出现在匹配理由里", () => {
    const rows = makeRows();
    // 两首意象完全相同的歌：复制 100 号为 200 号，只有基调不同
    rows.songs.push({ ...rows.songs[0], id: 200, album: "另一张专辑" });
    rows.occurrences.push(
      ...rows.occurrences
        .filter((o) => o.song_id === 100)
        .map((o) => ({ ...o, song_id: 200 })),
    );
    rows.songEmotions = [
      emotion(100, 1, "暗", "抑"),
      emotion(200, 1, "明", "扬"),
    ];
    const questions: QuizQuestion[] = [
      {
        title: "情绪",
        stem: "",
        options: [
          { text: "", dims: { tianxiang: 1 }, mood: { tone: -1, energy: -1 } },
          { text: "", dims: { tianxiang: 1 }, mood: { tone: 1, energy: 1 } },
        ],
      },
    ];
    const model = buildModel(buildPool(rows), questions);
    const rank = (answer: number) => {
      const result = evaluate(model, [answer], model.songs.length);
      const order = result.matches.map((m) => m.songId);
      expect(
        result.matches
          .flatMap((m) => m.reasons)
          .every((r) => ["dimension", "imagery"].includes(r.kind)),
      ).toBe(true);
      return order.indexOf(100) - order.indexOf(200);
    };
    expect(rank(0)).toBeLessThan(0); // 选「暗·抑」：100 号在前
    expect(rank(1)).toBeGreaterThan(0); // 选「明·扬」：200 号在前
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
