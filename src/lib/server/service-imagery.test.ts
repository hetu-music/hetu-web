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

import { getServiceClient, getUserClient } from "@/lib/db/supabase-server";
import {
  createImagery,
  createImageryCategory,
  createImageryMeaning,
  deleteMeaning,
  deleteOccurrence,
  getImageryMeanings,
  getOccurrencesForImagery,
  getOccurrencesForSong,
  getSongsForImagery,
  createOccurrence,
  createOccurrencesBatch,
  getImageryWithCounts,
  updateImagery,
  updateImageryCategory,
  updateMeaning,
  updateOccurrence,
  getImageryLastModified,
} from "./service-imagery";

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
});

describe("getImageryWithCounts", () => {
  it("categoryIds 里的数字字符串被转换，非数字字符串被过滤掉", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            { id: 1, name: "明月", count: 5, categoryIds: [1, "2", "abc"] },
          ],
          error: null,
        }),
      ]),
    );
    const result = await getImageryWithCounts();
    expect(result[0].categoryIds).toEqual([1, 2]);
  });

  it("categoryIds 里的 null 会被 Number(null) 转成 0 而不是被过滤（现有行为，非本次改动范围）", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [{ id: 1, name: "明月", count: 5, categoryIds: [1, null] }],
          error: null,
        }),
      ]),
    );
    const result = await getImageryWithCounts();
    expect(result[0].categoryIds).toEqual([1, 0]);
  });

  it("service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getImageryWithCounts()).toEqual([]);
  });

  it("查询抛异常时捕获并返回空数组，不向上传播", async () => {
    const throwingClient = {
      from: vi.fn(() => {
        throw new Error("network down");
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getServiceClient).mockReturnValue(throwingClient as any);
    expect(await getImageryWithCounts()).toEqual([]);
  });
});

describe("getOccurrencesForImagery（数据行映射）", () => {
  it("嵌套的 music/imagery/category/meaning 关联被拍平为 OccurrenceWithSong", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            {
              id: 1,
              song_id: 10,
              imagery_id: 20,
              category_id: 30,
              meaning_id: null,
              lyric_timetag: ["01:00"],
              music: { title: "标题", album: "专辑" },
              imagery: { name: "明月" },
              imagery_categories: { name: "自然" },
              imagery_meanings: null,
            },
          ],
          error: null,
        }),
      ]),
    );
    const result = await getOccurrencesForImagery(20);
    expect(result[0]).toMatchObject({
      id: 1,
      song_title: "标题",
      song_album: "专辑",
      imagery_name: "明月",
      category_name: "自然",
      meaning_label: null,
    });
  });

  it("查询出错时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getOccurrencesForImagery(1)).toEqual([]);
  });
});

describe("createImageryCategory（层级深度校验）", () => {
  it("父分类已是 L3 时拒绝创建（最多 3 层）", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 3 }, error: null }), // 查父分类 level
      ]),
    );
    await expect(
      createImageryCategory(
        { name: "子分类", parent_id: 1, description: null },
        "token",
      ),
    ).rejects.toMatchObject({ code: "MAX_DEPTH_EXCEEDED" });
  });

  it("父分类为 L2 时允许创建 L3 子分类", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 2 }, error: null }), // 查父分类 level
        makeQueryBuilder({
          data: { id: 5, name: "子分类", parent_id: 1, level: 3 },
          error: null,
        }), // 插入
      ]),
    );
    const created = await createImageryCategory(
      { name: "子分类", parent_id: 1, description: null },
      "token",
    );
    expect(created).toMatchObject({ id: 5, level: 3 });
  });

  it("无 parent_id（顶级分类）时跳过深度校验，直接创建", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, name: "顶级", parent_id: null, level: 1 },
          error: null,
        }),
      ]),
    );
    const created = await createImageryCategory(
      { name: "顶级", description: null },
      "token",
    );
    expect(created).toMatchObject({ level: 1 });
  });
});

describe("updateImageryCategory（父子层级一致性校验）", () => {
  it("改为顶级（parent_id: null）但当前不是 L1 时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 2 }, error: null }), // 查当前分类 level
      ]),
    );
    await expect(
      updateImageryCategory(1, { parent_id: null }, "token"),
    ).rejects.toMatchObject({ code: "INVALID_PARENT_LEVEL" });
  });

  it("改为顶级且当前就是 L1 时允许", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 1 }, error: null }), // 当前 level
        makeQueryBuilder({
          data: { id: 1, parent_id: null, level: 1 },
          error: null,
        }), // 更新
      ]),
    );
    const updated = await updateImageryCategory(
      1,
      { parent_id: null },
      "token",
    );
    expect(updated).toMatchObject({ parent_id: null });
  });

  it("新父分类与当前分类不同级（相差不为 1）时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 3 }, error: null }), // 当前 level=3
        makeQueryBuilder({ data: { level: 3 }, error: null }), // 新父 level=3（应为2）
      ]),
    );
    await expect(
      updateImageryCategory(1, { parent_id: 2 }, "token"),
    ).rejects.toMatchObject({ code: "INVALID_PARENT_LEVEL" });
  });

  it("新父分类恰好同级（相差 1）时允许", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 3 }, error: null }), // 当前 level=3
        makeQueryBuilder({ data: { level: 2 }, error: null }), // 新父 level=2
        makeQueryBuilder({
          data: { id: 1, parent_id: 2, level: 3 },
          error: null,
        }), // 更新
      ]),
    );
    const updated = await updateImageryCategory(1, { parent_id: 2 }, "token");
    expect(updated).toMatchObject({ parent_id: 2 });
  });

  it("不传 parent_id 时完全跳过层级校验", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { id: 1, name: "改名" }, error: null }), // 直接更新
      ]),
    );
    const updated = await updateImageryCategory(1, { name: "改名" }, "token");
    expect(updated).toMatchObject({ name: "改名" });
  });
});

describe("createOccurrence（叶子分类校验）", () => {
  it("分类下还有子分类（非叶子）时拒绝挂载意象", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 99 }], error: null }), // 存在子分类
      ]),
    );
    await expect(
      createOccurrence(
        { song_id: 1, imagery_id: 2, category_id: 3, lyric_timetag: [] },
        "token",
      ),
    ).rejects.toMatchObject({ code: "NOT_LEAF_CATEGORY" });
  });

  it("叶子分类时正常创建并返回带关联信息的完整记录", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [], error: null }), // 无子分类，是叶子
        makeQueryBuilder({ data: { id: 7 }, error: null }), // 插入 occurrence
        makeQueryBuilder({
          data: {
            id: 7,
            song_id: 1,
            imagery_id: 2,
            category_id: 3,
            meaning_id: null,
            lyric_timetag: [],
            music: { title: "标题" },
            imagery: null,
            imagery_categories: null,
            imagery_meanings: null,
          },
          error: null,
        }), // 回查完整记录
      ]),
    );
    const result = await createOccurrence(
      { song_id: 1, imagery_id: 2, category_id: 3, lyric_timetag: [] },
      "token",
    );
    expect(result).toMatchObject({ id: 7, song_title: "标题" });
  });
});

describe("createOccurrencesBatch", () => {
  const items = [
    { imagery_id: 1, category_id: 10, lyric_timetag: ["00:01.00"] },
    { imagery_id: 2, category_id: 10, lyric_timetag: ["00:02.00"] },
  ];

  it("跳过该歌已标注的意象，只插入其余的", async () => {
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [], error: null }), // 叶子校验
        makeQueryBuilder({ data: [{ imagery_id: 1 }], error: null }), // 已有标注
        insertBuilder,
      ]),
    );
    const result = await createOccurrencesBatch(5, items, "token");
    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        imagery_id: 2,
        category_id: 10,
        lyric_timetag: ["00:02.00"],
        song_id: 5,
        meaning_id: null,
      },
    ]);
  });

  it("非叶子分类时拒绝整批", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 99 }], error: null }),
      ]),
    );
    await expect(
      createOccurrencesBatch(5, items, "token"),
    ).rejects.toMatchObject({ code: "NOT_LEAF_CATEGORY" });
  });

  it("song_id 外键失败时提示先发布歌曲", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [], error: null }),
        makeQueryBuilder({ data: [], error: null }),
        makeQueryBuilder({
          data: null,
          error: {
            code: "23503",
            message:
              'insert or update on table "imagery_occurrences" violates foreign key constraint "imagery_occurrences_song_id_fkey"',
          },
        }),
      ]),
    );
    await expect(
      createOccurrencesBatch(5, items, "token"),
    ).rejects.toMatchObject({ code: "SONG_NOT_PUBLISHED" });
  });

  it("空列表直接返回，不访问数据库", async () => {
    expect(await createOccurrencesBatch(5, [], "token")).toEqual({
      created: 0,
      skipped: 0,
    });
    expect(getUserClient).not.toHaveBeenCalled();
  });
});

describe("getImageryMeanings", () => {
  it("service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getImageryMeanings()).toEqual([]);
  });

  it("查询出错时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getImageryMeanings()).toEqual([]);
  });

  it("正常返回按 label 排序的含义列表", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [{ id: 1, label: "思念", description: null }],
          error: null,
        }),
      ]),
    );
    expect(await getImageryMeanings()).toEqual([
      { id: 1, label: "思念", description: null },
    ]);
  });
});

describe("createImagery / updateImagery", () => {
  it("createImagery：user client 不可用时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    await expect(createImagery("明月", "token")).rejects.toThrow();
  });

  it("createImagery：插入出错时把 supabase error 原样抛出", async () => {
    const dbError = { message: "duplicate" };
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: dbError }),
      ]),
    );
    await expect(createImagery("明月", "token")).rejects.toBe(dbError);
  });

  it("updateImagery：更新成功返回新数据", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { id: 1, name: "新名字" }, error: null }),
      ]),
    );
    const result = await updateImagery(1, "新名字", "token");
    expect(result).toMatchObject({ name: "新名字" });
  });
});

describe("createImageryMeaning / updateMeaning / deleteMeaning", () => {
  it("createImageryMeaning 创建成功", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, label: "思念", description: null },
          error: null,
        }),
      ]),
    );
    const result = await createImageryMeaning("思念", null, "token");
    expect(result).toMatchObject({ label: "思念" });
  });

  it("updateMeaning 更新成功", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, label: "改名", description: null },
          error: null,
        }),
      ]),
    );
    const result = await updateMeaning(1, "改名", null, "token");
    expect(result).toMatchObject({ label: "改名" });
  });

  it("deleteMeaning 出错时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "in use" } }),
      ]),
    );
    await expect(deleteMeaning(1, "token")).rejects.toBeTruthy();
  });

  it("deleteMeaning 成功时不抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: null, error: null })]),
    );
    await expect(deleteMeaning(1, "token")).resolves.toBeUndefined();
  });
});

describe("updateOccurrence / deleteOccurrence（叶子分类校验同样适用于更新）", () => {
  it("更新时切换到非叶子分类会被拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 1 }], error: null }), // 目标分类下还有子分类
      ]),
    );
    await expect(
      updateOccurrence(1, { category_id: 5 }, "token"),
    ).rejects.toMatchObject({ code: "NOT_LEAF_CATEGORY" });
  });

  it("不改 category_id 时跳过叶子校验，直接更新", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { id: 1 }, error: null }), // 更新
        makeQueryBuilder({
          data: {
            id: 1,
            song_id: 1,
            imagery_id: 2,
            category_id: 3,
            meaning_id: null,
            lyric_timetag: [],
            music: null,
            imagery: null,
            imagery_categories: null,
            imagery_meanings: null,
          },
          error: null,
        }), // 回查
      ]),
    );
    const result = await updateOccurrence(
      1,
      { lyric_timetag: ["01:00"] },
      "token",
    );
    expect(result).toMatchObject({ id: 1 });
  });

  it("deleteOccurrence 出错时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    await expect(deleteOccurrence(1, "token")).rejects.toBeTruthy();
  });
});

describe("getOccurrencesForSong / getSongsForImagery", () => {
  it("getOccurrencesForSong 查询出错时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getOccurrencesForSong(1)).toEqual([]);
  });

  it("getSongsForImagery 按 song id 去重，只保留第一次出现", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            { song_id: 1, music: { id: 1, title: "标题A", lyricist: null } },
            { song_id: 1, music: { id: 1, title: "标题A", lyricist: null } }, // 重复
            { song_id: 2, music: { id: 2, title: "标题B", lyricist: ["甲"] } },
          ],
          error: null,
        }),
      ]),
    );
    const result = await getSongsForImagery(1);
    expect(result.map((s) => s.id)).toEqual([1, 2]);
  });

  it("getSongsForImagery service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getSongsForImagery(1)).toEqual([]);
  });
});

describe("getImageryLastModified", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
  });

  it("service client 不可用时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getImageryLastModified()).toBeNull();
  });

  it("返回最新一条的 created_at", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { created_at: "2026-02-02T09:00:00+00:00" },
          error: null,
        }),
      ]),
    );
    const d = await getImageryLastModified();
    expect(d?.toISOString()).toBe("2026-02-02T09:00:00.000Z");
  });

  it("时间戳非法时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { created_at: "garbage" }, error: null }),
      ]),
    );
    expect(await getImageryLastModified()).toBeNull();
  });
});
