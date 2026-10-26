import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return { ...actual, getServiceClient: vi.fn(), getUserClient: vi.fn() };
});

vi.mock("@/lib/server/llm", () => ({ chatJson: vi.fn() }));

import { getServiceClient, getUserClient } from "@/lib/db/supabase-server";
import { chatJson } from "@/lib/server/llm";
import {
  getSongEmotions,
  setSongEmotions,
  suggestSongEmotions,
} from "./service-emotions";

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
});

describe("getSongEmotions", () => {
  it("按 rank 取出基调 id，主基调在前；有一行是 AI 预标就算未确认", async () => {
    const builder = makeQueryBuilder({
      data: [
        { emotion_id: 6, source: "ai" },
        { emotion_id: 7, source: "ai" },
      ],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([builder]),
    );
    expect(await getSongEmotions(1)).toEqual({ ids: [6, 7], source: "ai" });
    expect(builder.order).toHaveBeenCalledWith("rank");
  });

  it("还没标时来源为 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: [], error: null })]),
    );
    expect(await getSongEmotions(1)).toEqual({ ids: [], source: null });
  });

  it("查询出错时返回空数组", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getSongEmotions(1)).toEqual({ ids: [], source: null });
  });
});

describe("setSongEmotions", () => {
  const published = () => makeQueryBuilder({ data: { id: 1 }, error: null });

  it("整首替换：先删旧的，再按顺序写入 rank", async () => {
    const deleteBuilder = makeQueryBuilder({ data: null, error: null });
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([published(), deleteBuilder, insertBuilder]),
    );
    expect(await setSongEmotions(1, [6, 7], "token")).toEqual([6, 7]);
    expect(deleteBuilder.eq).toHaveBeenCalledWith("song_id", 1);
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { song_id: 1, emotion_id: 6, rank: 1, source: "human" },
      { song_id: 1, emotion_id: 7, rank: 2, source: "human" },
    ]);
  });

  it("空数组只清空，不写入", async () => {
    const client = createMockSupabaseClient([
      published(),
      makeQueryBuilder({ data: null, error: null }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await setSongEmotions(1, [], "token");
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["重复", [6, 6]],
    ["超过三个", [1, 2, 3, 4]],
  ])("基调%s时拒绝，不访问数据库", async (_, ids) => {
    await expect(setSongEmotions(1, ids, "token")).rejects.toMatchObject({
      code: "INVALID_EMOTIONS",
    });
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it("歌曲未发布时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: null, error: null })]),
    );
    await expect(setSongEmotions(1, [6], "token")).rejects.toMatchObject({
      code: "SONG_NOT_PUBLISHED",
    });
  });

  it("词表里没有的基调（外键失败）报可读的错误", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        published(),
        makeQueryBuilder({ data: null, error: null }),
        makeQueryBuilder({ data: null, error: { code: "23503" } }),
      ]),
    );
    await expect(setSongEmotions(1, [99], "token")).rejects.toMatchObject({
      code: "INVALID_EMOTIONS",
    });
  });
});

describe("suggestSongEmotions", () => {
  const emotions = [
    { id: 6, name: "悲怆", description: "", tone: "暗", energy: "扬", sort: 6 },
    { id: 7, name: "执守", description: "", tone: "暗", energy: "扬", sort: 7 },
  ];

  it("把模型给的基调名映射回 id，丢掉词表外与重复的", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { title: "倾尽天下", lyrics: "[00:01.00]血染江山的画" },
          error: null,
        }),
        makeQueryBuilder({ data: emotions, error: null }),
      ]),
    );
    vi.mocked(chatJson).mockResolvedValue({
      emotions: ["悲怆", "豪迈", "悲怆", "执守"],
      reason: "血染江山",
    });
    expect(await suggestSongEmotions(9)).toEqual({
      emotionIds: [6, 7],
      reason: "血染江山",
    });
    expect(vi.mocked(chatJson).mock.calls[0][0].user).toContain("血染江山的画");
  });

  it("没有歌词时不调用模型", async () => {
    vi.mocked(chatJson).mockClear();
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { title: "无词", lyrics: null },
          error: null,
        }),
      ]),
    );
    expect(await suggestSongEmotions(9)).toBeNull();
    expect(chatJson).not.toHaveBeenCalled();
  });
});
