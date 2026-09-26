import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return {
    ...actual,
    getServiceClient: vi.fn(),
    getUserClient: vi.fn(),
  };
});

vi.mock("@/lib/server/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/llm")>();
  return { ...actual, chatJson: vi.fn(), isLlmConfigured: vi.fn(() => true) };
});

import { getServiceClient, getUserClient } from "@/lib/db/supabase-server";
import { chatJson, LlmError } from "@/lib/server/llm";
import {
  getImagerySuggestions,
  reviewImagerySuggestions,
} from "./service-imagery-suggest";

const lyrics = "[00:10.00]明月照亮天涯\n[00:20.00]人在江湖";
const dictionary = [
  { id: 1, name: "明月" },
  { id: 2, name: "天涯" },
  { id: 3, name: "人" },
];
const categoryRows = [
  { id: 1, name: "自然", parent_id: null },
  { id: 10, name: "天象", parent_id: 1 },
  { id: 11, name: "地理", parent_id: 1 },
];

function mockUserSong(data: unknown) {
  vi.mocked(getUserClient).mockReturnValue(
    createMockSupabaseClient([makeQueryBuilder({ data, error: null })]),
  );
}

/** fetchAll 按 imagery → occurrences → music → categories 的顺序调用 .from() */
function mockServiceTables(tables: {
  imagery?: unknown[];
  occurrences?: unknown[];
  music?: unknown[];
  categories?: unknown[];
}) {
  vi.mocked(getServiceClient).mockReturnValue(
    createMockSupabaseClient(
      [tables.imagery, tables.occurrences, tables.music, tables.categories]
        .filter((rows) => rows !== undefined)
        .map((rows) => makeQueryBuilder({ data: rows, error: null })),
    ),
  );
}

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
  vi.mocked(chatJson).mockReset();
});

describe("getImagerySuggestions", () => {
  it("暂存表中没有该歌时返回 null", async () => {
    mockUserSong(null);
    mockServiceTables({});
    expect(await getImagerySuggestions(5, "token")).toBeNull();
  });

  it("用其他歌的标注作先验生成候选，并排除该歌已标注的意象", async () => {
    mockUserSong({ id: 5, lyrics });
    mockServiceTables({
      imagery: dictionary,
      occurrences: [
        { song_id: 7, imagery_id: 1, category_id: 10 },
        { song_id: 5, imagery_id: 2, category_id: 11 },
      ],
      music: [
        { id: 5, lyrics },
        { id: 7, lyrics: "[00:01.00]明月与人" },
      ],
      categories: categoryRows,
    });

    const result = await getImagerySuggestions(5, "token");
    expect(result).toMatchObject({
      published: true,
      hasLyrics: true,
      llmEnabled: true,
      // 按拼音排序：地理（dì）在天象（tiān）之前
      categories: [
        { id: 11, label: "自然 / 地理" },
        { id: 10, label: "自然 / 天象" },
      ],
    });
    const byName = new Map(result?.suggestions.map((s) => [s.name, s]));
    expect(byName.has("天涯")).toBe(false); // 已标注
    expect(byName.get("明月")).toMatchObject({
      recommended: true,
      categoryIds: [10],
      seen: 1,
      annotated: 1,
    });
    expect(byName.get("人")).toMatchObject({ recommended: false, rate: 0 });
    expect(result?.dictionary).toContainEqual({
      id: 1,
      name: "明月",
      categoryIds: [10],
    });
  });

  it("歌曲只在暂存表中时标记为未发布", async () => {
    mockUserSong({ id: 5, lyrics: null });
    mockServiceTables({
      imagery: dictionary,
      occurrences: [],
      music: [],
      categories: categoryRows,
    });
    expect(await getImagerySuggestions(5, "token")).toMatchObject({
      published: false,
      hasLyrics: false,
      suggestions: [],
    });
  });

  it("词典为空时抛错，而不是返回空候选", async () => {
    mockUserSong({ id: 5, lyrics });
    mockServiceTables({
      imagery: [],
      occurrences: [],
      music: [],
      categories: [],
    });
    await expect(getImagerySuggestions(5, "token")).rejects.toThrow(
      "意象词典为空",
    );
  });

  it("客户端不可用时抛错", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    vi.mocked(getServiceClient).mockReturnValue(null);
    await expect(getImagerySuggestions(5, "token")).rejects.toThrow(
      "Supabase client unavailable",
    );
  });
});

describe("reviewImagerySuggestions", () => {
  const candidates = [
    { imageryId: 1, name: "明月", rate: 0.8, recommended: true },
    { imageryId: 3, name: "人", rate: 0.01, recommended: false },
  ];

  it("把歌词、候选和叶子分类发给模型，并还原输出", async () => {
    mockUserSong({ id: 5, title: "测试", lyrics });
    mockServiceTables({ imagery: categoryRows });
    vi.mocked(chatJson).mockResolvedValue({
      verdicts: [
        { id: 1, keep: true, reason: "景物" },
        { id: 2, keep: false, reason: "泛指" },
      ],
      additions: [{ name: "江湖", lines: [2], categoryId: 11, reason: "地理" }],
    });

    const result = await reviewImagerySuggestions(5, candidates, "token");
    expect(result).toEqual({
      verdicts: [
        { imageryId: 1, keep: true, reason: "景物" },
        { imageryId: 3, keep: false, reason: "泛指" },
      ],
      additions: [
        {
          name: "江湖",
          timetags: ["00:20.00"],
          lines: ["人在江湖"],
          categoryId: 11,
          reason: "地理",
        },
      ],
    });
    const { user } = vi.mocked(chatJson).mock.calls[0][0];
    expect(user).toContain("歌名：测试");
    expect(user).toContain("2. 人（默认不勾选，历史标注率 1%）");
    expect(user).toContain("11: 自然 / 地理");
  });

  it("歌曲不存在时返回 null，不调用模型", async () => {
    mockUserSong(null);
    mockServiceTables({});
    expect(await reviewImagerySuggestions(5, candidates, "token")).toBeNull();
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("没有歌词时直接报错，不调用模型", async () => {
    mockUserSong({ id: 5, title: "测试", lyrics: "" });
    mockServiceTables({});
    await expect(
      reviewImagerySuggestions(5, candidates, "token"),
    ).rejects.toBeInstanceOf(LlmError);
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("模型输出结构不符时转成 LlmError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockUserSong({ id: 5, title: "测试", lyrics });
    mockServiceTables({ imagery: categoryRows });
    vi.mocked(chatJson).mockResolvedValue({ verdicts: "oops" });
    await expect(
      reviewImagerySuggestions(5, candidates, "token"),
    ).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
