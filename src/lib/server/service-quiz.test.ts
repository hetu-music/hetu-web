import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeQueryBuilder, type MockResult } from "@/test/mockSupabase";

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
import { DIMENSIONS, QUESTIONS, encodeAnswers } from "@/lib/quiz";
import {
  getQuizPoolSize,
  getQuizQuestions,
  getQuizResult,
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
      name: `${dim.label}子类`,
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
 * 按表名分发查询；music 表同时承担候选池与歌词两种查询，按 select 字段区分。
 */
function mockClient(rows: Rows, lyricsResult?: MockResult) {
  const ok = (data: unknown): MockResult => ({ data, error: null });
  const byTable: Record<string, () => unknown> = {
    [TABLES.IMAGERY_CAT]: () => makeQueryBuilder(ok(rows.categories)),
    [TABLES.IMAGERY]: () => makeQueryBuilder(ok(rows.imagery)),
    [TABLES.IMAGERY_OCC]: () => makeQueryBuilder(ok(rows.occurrences)),
    [TABLES.MUSIC]: () => ({
      select: vi.fn((fields: string) =>
        makeQueryBuilder(
          fields.includes("lyrics")
            ? (lyricsResult ?? ok(rows.lyrics))
            : ok(rows.songs),
        ),
      ),
    }),
  };
  const from = vi.fn((table: string) => byTable[table]());
  vi.mocked(getServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof getServiceClient
  >);
  return from;
}

/** 每题选该维度权重最大的选项，使该维度成为主导 */
function answersFavoring(key: string): string {
  return encodeAnswers(
    QUESTIONS.map((q) => {
      let best = 0;
      q.options.forEach((o, i) => {
        const w = (o.dims as Record<string, number>)[key] ?? 0;
        const bw = (q.options[best].dims as Record<string, number>)[key] ?? 0;
        if (w > bw) best = i;
      });
      return best;
    }),
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
    expect(first.options[1]).toContain("溫");
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
  it("作答短串不合法时返回 null，不查询数据库", async () => {
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
    const code = answersFavoring("tianxiang");
    const result = await getQuizResult(code.toLowerCase(), "zh-CN");

    expect(result).not.toBeNull();
    expect(result?.code).toBe(code);
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
    // 全选第一项：天象最高，楼台次之
    const result = await getQuizResult("A".repeat(QUESTIONS.length), "zh-CN");
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
