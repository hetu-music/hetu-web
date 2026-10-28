import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeQueryBuilder, type MockResult } from "@/test/mockSupabase";

// 别名归并另有单测（utils-credits），这里默认不登记任何别名
vi.mock("@/lib/server/service-credit-aliases", () => ({
  getCreditAliases: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return {
    ...actual,
    getServiceClient: vi.fn(),
  };
});

// unstable_cache 依赖 Next.js 的增量缓存，测试里直接透传，每次调用都重新查询
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  DIMENSIONS,
  QUESTIONS,
  QUIZ_VERSION,
  SIGNATURE_IMAGERY,
  decodeResultSlug,
  encodeAnswers,
  encodeResultSlug,
  snapshotToRow,
  type QuizSnapshot,
} from "@/lib/quiz";
import { toTraditional } from "@/lib/utils/utils-convert";
import {
  getQuizPoolSize,
  getQuizQuestions,
  getQuizResult,
  getQuizResultGlyphs,
  listQuizRecords,
  saveQuizRecord,
} from "./service-quiz";

// ─── 测试数据：每个维度一首「专精」歌曲，歌词与意象时间标签一一对应 ─────────

type Rows = {
  categories: unknown[];
  imagery: unknown[];
  occurrences: unknown[];
  songs: Array<Record<string, unknown>>;
  lyrics: Array<{ id: number; lyrics: string | null }>;
};

function makeRows(): Rows {
  const categories: Array<Record<string, unknown>> = [];
  let catId = 1;
  const leafOf: number[] = [];
  for (const dim of DIMENSIONS) {
    const l2 = catId++;
    categories.push({
      id: l2,
      name: dim.categories[0],
      parent_id: null,
      level: 2,
    });
    const leaf = catId++;
    categories.push({
      id: leaf,
      // 天象的母题取名「月」，让「明月」计入招牌意象「月」
      name: dim.key === "tianxiang" ? "月" : `${dim.label}子类`,
      parent_id: l2,
      level: 3,
    });
    leafOf.push(leaf);
  }

  const imagery = [
    { id: 1, name: "明月" },
    { id: 2, name: "杂项" },
  ];
  const songs: Rows["songs"] = [];
  const occurrences: Array<Record<string, unknown>> = [];
  const lyrics: Rows["lyrics"] = [];

  DIMENSIONS.forEach((dim, i) => {
    const songId = 100 + i;
    songs.push({
      id: songId,
      title: `专精${dim.label}`,
      artist: ["河图"],
      album: `专辑${i}`,
      hascover: true,
      has_audio: true,
      type: ["原创"],
      date: "2012-01-01",
    });
    const lrc: string[] = [];
    DIMENSIONS.forEach((_, k) => {
      const n = k === i ? 10 : 1;
      for (let c = 0; c < n; c += 1) {
        const tag = `0${k}:${String(10 + c).padStart(2, "0")}.00`;
        occurrences.push({
          song_id: songId,
          category_id: leafOf[k],
          imagery_id: dim.key === "tianxiang" && k === i ? 1 : 2,
          lyric_timetag: [tag],
        });
        lrc.push(`[${tag}]${dim.label}${k}句${c}`);
      }
    });
    lyrics.push({ id: songId, lyrics: lrc.join("\n") });
  });

  return { categories, imagery, occurrences, songs, lyrics };
}

/**
 * 按表名分发查询：候选池读共用的意象索引，歌词按 id 读 music 表。
 */
function mockClient(
  rows: Rows,
  lyricsResult?: MockResult,
  extra: Record<string, () => unknown> = {},
) {
  const ok = (data: unknown): MockResult => ({ data, error: null });
  const byTable: Record<string, () => unknown> = {
    [TABLES.IMAGERY_CAT]: () => makeQueryBuilder(ok(rows.categories)),
    [TABLES.IMAGERY]: () => makeQueryBuilder(ok(rows.imagery)),
    [TABLES.IMAGERY_OCC]: () => makeQueryBuilder(ok(rows.occurrences)),
    [TABLES.MUSIC_CATALOG]: () => makeQueryBuilder(ok(rows.songs)),
    [TABLES.SONG_EMOTIONS]: () => makeQueryBuilder(ok([])),
    [TABLES.EMOTIONS]: () => makeQueryBuilder(ok([])),
    [TABLES.MUSIC]: () => makeQueryBuilder(lyricsResult ?? ok(rows.lyrics)),
    ...extra,
  };
  const from = vi.fn((table: string) => byTable[table]());
  vi.mocked(getServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof getServiceClient
  >);
  return from;
}

const OPTION_COUNTS = QUESTIONS.map((q) => q.options.length);

/** 每题选该维度权重最大的选项，使该维度成为主导 */
function answersFavoring(key: string): string {
  return encodeResultSlug(
    QUESTIONS.map((q) => {
      let best = 0;
      q.options.forEach((o, i) => {
        const w = (o.dims as Record<string, number>)[key] ?? 0;
        const bw = (q.options[best].dims as Record<string, number>)[key] ?? 0;
        if (w > bw) best = i;
      });
      return best;
    }),
    OPTION_COUNTS,
  );
}

// React 的 cache() 在测试环境不做请求级去重，每次调用都会重新构建模型

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getQuizQuestions", () => {
  it("简体原样返回题目与选项文本", () => {
    const questions = getQuizQuestions("zh-CN");
    expect(questions).toHaveLength(QUESTIONS.length);
    expect(questions[0]).toEqual({
      title: QUESTIONS[0].title,
      stem: QUESTIONS[0].stem,
      options: QUESTIONS[0].options.map((o) => o.text),
    });
  });

  it("繁体转换题目文本", () => {
    const [first] = getQuizQuestions("zh-TW");
    expect(first.title).toBe("臨行");
    expect(first.options).toEqual(
      QUESTIONS[0].options.map((o) => toTraditional(o.text)),
    );
    expect(first.options).not.toEqual(QUESTIONS[0].options.map((o) => o.text));
  });
});

describe("getQuizResultGlyphs", () => {
  it("气韵与招牌意象的字都在，按字体分好", () => {
    const glyphs = getQuizResultGlyphs("zh-CN");
    for (const d of DIMENSIONS) {
      expect(glyphs.calligraphy).toContain(d.motto);
      expect(glyphs.serif).toContain(d.label);
      expect(glyphs.kaiti).toContain(d.description);
    }
    for (const s of SIGNATURE_IMAGERY) {
      expect(glyphs.calligraphy).toContain(s.name);
      expect(glyphs.serif).toContain(s.name);
    }
  });

  it("繁体页给繁体字", () => {
    const glyphs = getQuizResultGlyphs("zh-TW");
    expect(glyphs.calligraphy).toContain(toTraditional(DIMENSIONS[0].motto));
    expect(glyphs.kaiti).toContain(toTraditional(DIMENSIONS[0].description));
  });
});

describe("getQuizPoolSize", () => {
  it("返回候选池歌曲数", async () => {
    mockClient(makeRows());
    expect(await getQuizPoolSize()).toBe(DIMENSIONS.length);
  });

  it("service client 不可用时为 0，并记录错误", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getQuizPoolSize()).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("任一数据表为空时视为加载失败", async () => {
    const rows = makeRows();
    rows.occurrences = [];
    mockClient(rows);
    expect(await getQuizPoolSize()).toBe(0);
    expect(vi.mocked(console.error).mock.calls[0][1]).toMatchObject({
      message: expect.stringContaining("occurrences"),
    });
  });

  it("所有歌曲都不符合入池条件时视为加载失败", async () => {
    const rows = makeRows();
    rows.songs = rows.songs.map((s) => ({ ...s, type: ["翻唱"] }));
    mockClient(rows);
    expect(await getQuizPoolSize()).toBe(0);
    expect(vi.mocked(console.error).mock.calls[0][1]).toMatchObject({
      message: "候选池为空",
    });
  });
});

describe("getQuizResult", () => {
  it("乱码不合法时返回 null，不查询数据库", async () => {
    const from = mockClient(makeRows());
    expect(await getQuizResult(undefined, "zh-CN")).toBeNull();
    expect(await getQuizResult("AB", "zh-CN")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("候选池为空时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(
      await getQuizResult(answersFavoring("tianxiang"), "zh-CN"),
    ).toBeNull();
  });

  it("主导维度决定气韵，首选歌曲附带理由与印证歌词", async () => {
    mockClient(makeRows());
    const slug = answersFavoring("tianxiang");
    const result = await getQuizResult(slug, "zh-CN");

    expect(result).not.toBeNull();
    expect(result?.slug).toBe(slug);
    expect(result?.persona).toMatchObject({ label: "天象", motto: "仰观天象" });
    expect(result?.profile[0]).toMatchObject({
      key: "tianxiang",
      label: "天象",
    });
    expect(result?.imagery).toContain("月");
    expect(result?.matches).toHaveLength(5);

    const top = result?.matches[0];
    expect(top?.song).toMatchObject({
      id: 100,
      title: "专精天象",
      artist: ["河图"],
      album: "专辑0",
      has_audio: true,
    });
    expect(top?.reasons[0]).toBe("天象");
    expect(top?.reasons).toContain("「月」");
    expect(top?.lines).toEqual(["天象0句0"]);
  });

  it("次要维度为正时给出「兼有」", async () => {
    mockClient(makeRows());
    // 全选第一项：各题第一项的主维度分散在多个维度，次要维度为正
    const result = await getQuizResult(
      encodeResultSlug(
        QUESTIONS.map(() => 0),
        OPTION_COUNTS,
      ),
      "zh-CN",
    );
    expect(result?.secondary).not.toBeNull();
    expect(result?.secondary?.label).not.toBe(result?.persona.label);
  });

  it("繁体转换气韵、理由与歌词", async () => {
    mockClient(makeRows());
    const result = await getQuizResult(answersFavoring("loutai"), "zh-TW");
    expect(result?.persona.label).toBe("樓臺");
    const top = result?.matches[0];
    expect(top?.song.title).toBe("專精樓臺");
    expect(top?.song.album).toBe("專輯4");
    expect(top?.reasons[0]).toBe("樓臺");
    expect(top?.lines[0]).toBe("樓臺4句0");
  });

  it("歌词查询失败或缺失时仍返回结果，只是没有印证歌词", async () => {
    mockClient(makeRows(), { data: null, error: { message: "boom" } });
    const result = await getQuizResult(answersFavoring("qingsi"), "zh-CN");
    expect(result?.matches.length).toBeGreaterThan(0);
    expect(result?.matches.every((m) => m.lines.length === 0)).toBe(true);
  });

  it("时间标签无法解析或对不上歌词时跳过该句", async () => {
    const rows = makeRows();
    rows.occurrences = rows.occurrences.map((o) => ({
      ...(o as Record<string, unknown>),
      lyric_timetag: ["坏标签"],
    }));
    rows.lyrics[0].lyrics = null;
    mockClient(rows);
    const result = await getQuizResult(answersFavoring("tianxiang"), "zh-CN");
    expect(result?.matches[0].lines).toEqual([]);
  });
});

// ─── 保存的记录 ───────────────────────────────────────────────────────────────

const RECORD_ID = "aB3dE6gH9k";
const SAVED_AT = "2026-10-01T08:00:00+00:00";

const saved: QuizSnapshot = {
  persona: "shanhe",
  secondary: null,
  profile: [{ key: "shanhe", z: 2 }],
  imagery: [],
  matches: [
    // 仍在候选池里
    {
      songId: 101,
      percent: 90,
      reasons: [{ kind: "dimension", key: "shanhe" }],
    },
    // 已离开候选池，但还在曲库里
    { songId: 999, percent: 70, reasons: [] },
    // 曲库里也删了
    { songId: 998, percent: 60, reasons: [] },
  ],
};

function recordBuilder(data: unknown) {
  return () =>
    makeQueryBuilder({
      data: data && { id: RECORD_ID, created_at: SAVED_AT, ...data },
      error: null,
    });
}

describe("getQuizResult：10 位链接", () => {
  it("按快照渲染，不重算；离开候选池的歌到曲库里查，删掉的略去", async () => {
    const rows = makeRows();
    const outOfPool = {
      id: 999,
      title: "已出池",
      artist: ["河图"],
      album: null,
      hascover: false,
      lyrics: null,
    };
    const from = mockClient(
      rows,
      { data: [...rows.lyrics, outOfPool], error: null },
      { [TABLES.QUIZ_RESULTS]: recordBuilder(snapshotToRow(saved)) },
    );
    const result = await getQuizResult(RECORD_ID, "zh-CN");

    expect(from).toHaveBeenCalledWith(TABLES.QUIZ_RESULTS);
    expect(result?.slug).toBe(RECORD_ID);
    expect(result?.savedAt).toBe(SAVED_AT);
    expect(result?.persona.label).toBe("山河");
    expect(result?.secondary).toBeNull();
    expect(result?.matches.map((m) => m.song.id)).toEqual([101, 999]);
    expect(result?.matches.map((m) => m.percent)).toEqual([90, 70]);
    expect(result?.matches[0].reasons).toEqual(["山河"]);
    expect(result?.matches[0].lines).toEqual(["山河1句0"]);
    expect(result?.matches[1].song.title).toBe("已出池");
    expect(result?.matches[1].lines).toEqual([]);
  });

  it("记录不存在或主气韵认不出时返回 null", async () => {
    mockClient(makeRows(), undefined, {
      [TABLES.QUIZ_RESULTS]: recordBuilder(null),
    });
    expect(await getQuizResult(RECORD_ID, "zh-CN")).toBeNull();

    mockClient(makeRows(), undefined, {
      [TABLES.QUIZ_RESULTS]: recordBuilder({
        ...snapshotToRow(saved),
        persona: "gone",
      }),
    });
    expect(await getQuizResult(RECORD_ID, "zh-CN")).toBeNull();
  });

  it("7 位链接的结果没有保存时间", async () => {
    mockClient(makeRows());
    const result = await getQuizResult(answersFavoring("caomu"), "zh-CN");
    expect(result?.savedAt).toBeNull();
  });
});

describe("saveQuizRecord", () => {
  const slug = answersFavoring("tianxiang");
  const answers = decodeResultSlug(slug, OPTION_COUNTS) as number[];

  it("服务端重算后写入快照，带上题目版本和作答", async () => {
    mockClient(makeRows());
    const insert = makeQueryBuilder({ data: { id: RECORD_ID }, error: null });
    const supabase = { from: vi.fn(() => insert) };
    const id = await saveQuizRecord(supabase as never, "u1", answers);

    expect(id).toBe(RECORD_ID);
    expect(supabase.from).toHaveBeenCalledWith(TABLES.QUIZ_RESULTS);
    const row = insert.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      user_id: "u1",
      quiz_version: QUIZ_VERSION,
      code: encodeAnswers(answers),
      persona: "tianxiang",
    });
    expect(row.song_ids[0]).toBe(100);
    expect(row.song_ids).toHaveLength(row.percents.length);
    expect(row.reasons[0]).toContainEqual({ dim: "tianxiang" });
  });

  it("同一份作答已存过时返回原来那条", async () => {
    mockClient(makeRows());
    const conflict = makeQueryBuilder({ data: null, error: { code: "23505" } });
    const existing = makeQueryBuilder({
      data: { id: "oldOne0001" },
      error: null,
    });
    const supabase = {
      from: vi.fn().mockReturnValueOnce(conflict).mockReturnValueOnce(existing),
    };
    expect(await saveQuizRecord(supabase as never, "u1", answers)).toBe(
      "oldOne0001",
    );
    expect(existing.eq).toHaveBeenCalledWith("quiz_version", QUIZ_VERSION);
    expect(existing.eq).toHaveBeenCalledWith("code", encodeAnswers(answers));
  });

  it("其他写入错误照常抛出；候选池为空时返回 null", async () => {
    mockClient(makeRows());
    const failing = makeQueryBuilder({ data: null, error: { code: "42501" } });
    await expect(
      saveQuizRecord({ from: () => failing } as never, "u1", answers),
    ).rejects.toMatchObject({ code: "42501" });

    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(
      await saveQuizRecord({ from: () => failing } as never, "u1", answers),
    ).toBeNull();
  });
});

describe("listQuizRecords", () => {
  it("按语言给出气韵，认不出主气韵的记录略去", async () => {
    const list = makeQueryBuilder({
      data: [
        { id: "a", created_at: SAVED_AT, persona: "loutai", secondary: "gone" },
        { id: "b", created_at: SAVED_AT, persona: "gone", secondary: null },
      ],
      error: null,
    });
    const records = await listQuizRecords(
      { from: () => list } as never,
      "u1",
      "zh-TW",
    );
    expect(records).toEqual([
      {
        id: "a",
        savedAt: SAVED_AT,
        persona: { motto: toTraditional(DIMENSIONS[4].motto), label: "樓臺" },
        secondary: null,
      },
    ]);
    expect(list.eq).toHaveBeenCalledWith("user_id", "u1");
  });
});
