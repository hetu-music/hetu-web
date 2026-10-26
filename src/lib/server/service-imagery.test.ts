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
  deleteOccurrence,
  getOccurrencesForImagery,
  getOccurrencesForSong,
  createOccurrence,
  createOccurrencesBatch,
  getImageryWithCounts,
  updateImagery,
  updateImageryCategory,
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

  it("公开口径读曲库视图，后台口径读含争议歌曲、含 0 次的全量视图", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: [], error: null }),
      makeQueryBuilder({ data: [], error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);
    await getImageryWithCounts();
    await getImageryWithCounts("all");
    expect(client.from.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      "imagery_summary",
      "imagery_summary_all",
    ]);
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
  it("嵌套的 music/imagery/category 关联被拍平为 OccurrenceWithSong", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            {
              id: 1,
              song_id: 10,
              imagery_id: 20,
              category_id: 30,
              lyric_timetag: ["01:00"],
              music: { title: "标题", album: "专辑" },
              imagery: { name: "明月" },
              imagery_categories: { name: "自然" },
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
      createOccurrence({ song_id: 1, imagery_id: 2, category_id: 3 }, "token"),
    ).rejects.toMatchObject({ code: "NOT_LEAF_CATEGORY" });
  });

  it("词不在歌词里时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [], error: null }), // 是叶子
        makeQueryBuilder({ data: { lyrics: "[00:01.00]清风" }, error: null }),
        makeQueryBuilder({ data: [], error: null }), // 该歌已有标注
        makeQueryBuilder({ data: [{ name: "明月" }], error: null }),
      ]),
    );
    await expect(
      createOccurrence({ song_id: 1, imagery_id: 2, category_id: 3 }, "token"),
    ).rejects.toMatchObject({ code: "IMAGERY_NOT_IN_LYRICS" });
  });

  it("叶子分类时正常创建，按歌词写入时间标签，返回带关联信息的完整记录", async () => {
    const lyrics = { data: { lyrics: "[00:01.00]明月照我" }, error: null };
    const updateBuilder = makeQueryBuilder({ data: null, error: null });
    const insertBuilder = makeQueryBuilder({ data: { id: 7 }, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [], error: null }), // 无子分类，是叶子
        makeQueryBuilder(lyrics),
        makeQueryBuilder({ data: [], error: null }), // 该歌还没有标注
        makeQueryBuilder({ data: [{ name: "明月" }], error: null }),
        makeQueryBuilder({
          data: [{ imagery_id: 2, category_id: 3, role: "primary" }],
          error: null,
        }), // 该词已登记这个母题
        insertBuilder,
        makeQueryBuilder(lyrics), // 重算时间标签
        makeQueryBuilder({
          data: [
            {
              id: 7,
              imagery_id: 2,
              lyric_timetag: [],
              imagery: { name: "明月" },
            },
          ],
          error: null,
        }),
        updateBuilder,
        makeQueryBuilder({
          data: {
            id: 7,
            song_id: 1,
            imagery_id: 2,
            category_id: 3,
            lyric_timetag: [],
            music: { title: "标题" },
            imagery: null,
            imagery_categories: null,
          },
          error: null,
        }), // 回查完整记录
      ]),
    );
    const result = await createOccurrence(
      { song_id: 1, imagery_id: 2, category_id: 3 },
      "token",
    );
    expect(result).toMatchObject({ id: 7, song_title: "标题" });
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      song_id: 1,
      imagery_id: 2,
      category_id: 3,
      lyric_timetag: [],
    });
    expect(updateBuilder.update).toHaveBeenCalledWith({
      lyric_timetag: ["00:01.00"],
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", 7);
  });
});

describe("createOccurrencesBatch", () => {
  const items = [
    { imagery_id: 1, category_id: 10 },
    { imagery_id: 2, category_id: 10 },
  ];
  const leafOk = () => makeQueryBuilder({ data: [], error: null });
  const published = () => makeQueryBuilder({ data: { id: 5 }, error: null });
  // 歌词没有时间轴：不拦、不重算，测的是其余逻辑。依次是歌词、已有标注、按 id 查的词名
  const lyricsCheck = (byId = true) => [
    makeQueryBuilder({ data: { lyrics: null }, error: null }),
    makeQueryBuilder({ data: [], error: null }),
    ...(byId ? [makeQueryBuilder({ data: [], error: null })] : []),
  ];
  const noExisting = () => makeQueryBuilder({ data: [], error: null });
  const motifs = (
    rows: Array<{ imagery_id: number; category_id: number; role: string }>,
  ) => makeQueryBuilder({ data: rows, error: null });

  it("跳过该歌已标注的意象，只插入其余的", async () => {
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        leafOk(),
        published(),
        ...lyricsCheck(),
        makeQueryBuilder({ data: [{ imagery_id: 1 }], error: null }), // 已有标注
        motifs([{ imagery_id: 2, category_id: 10, role: "primary" }]),
        insertBuilder,
      ]),
    );
    const result = await createOccurrencesBatch(5, items, "token");
    expect(result).toEqual({ created: 1, skipped: 1, newImagery: 0 });
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        imagery_id: 2,
        category_id: 10,
        lyric_timetag: [],
        song_id: 5,
      },
    ]);
  });

  it("新意象名：复用同名意象、创建缺失的，并合并指向同一意象的项", async () => {
    const createBuilder = makeQueryBuilder({
      data: [{ id: 31, name: "孤灯" }],
      error: null,
    });
    const registerBuilder = makeQueryBuilder({ data: null, error: null });
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        leafOk(),
        published(),
        ...lyricsCheck(),
        makeQueryBuilder({ data: [{ id: 3, name: "月" }], error: null }), // 按名查找
        createBuilder,
        noExisting(),
        motifs([{ imagery_id: 3, category_id: 10, role: "primary" }]),
        registerBuilder,
        insertBuilder,
      ]),
    );
    const result = await createOccurrencesBatch(
      5,
      [
        // 「明月」改成了已有的「月」，与另一条「月」合并
        { imagery_name: "月", category_id: 10 },
        { imagery_id: 3, category_id: 11 },
        { imagery_name: "孤灯", category_id: 12 },
      ],
      "token",
    );
    expect(result).toEqual({ created: 2, skipped: 0, newImagery: 1 });
    expect(createBuilder.insert).toHaveBeenCalledWith([{ name: "孤灯" }]);
    // 新词以这次选的母题为默认母题
    expect(registerBuilder.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 31, category_id: 12, role: "primary" }],
      { onConflict: "imagery_id,category_id", ignoreDuplicates: true },
    );
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        imagery_id: 3,
        category_id: 10,
        lyric_timetag: [],
        song_id: 5,
      },
      {
        imagery_id: 31,
        category_id: 12,
        lyric_timetag: [],
        song_id: 5,
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

  it("歌曲未发布时在创建意象之前就拒绝", async () => {
    const client = createMockSupabaseClient([
      leafOk(),
      makeQueryBuilder({ data: null, error: null }), // 正式曲库中没有
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      createOccurrencesBatch(
        5,
        [{ imagery_name: "孤灯", category_id: 10 }],
        "token",
      ),
    ).rejects.toMatchObject({ code: "SONG_NOT_PUBLISHED" });
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it("词不在歌词里时在创建意象之前就拒绝", async () => {
    const client = createMockSupabaseClient([
      leafOk(),
      published(),
      makeQueryBuilder({ data: { lyrics: "[00:01.00]明月" }, error: null }),
      makeQueryBuilder({ data: [], error: null }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      createOccurrencesBatch(
        5,
        [
          { imagery_name: "明月", category_id: 10 },
          { imagery_name: "孤灯", category_id: 10 },
        ],
        "token",
      ),
    ).rejects.toThrow("歌词里没有「孤灯」");
    expect(client.from).toHaveBeenCalledTimes(4);
  });

  it("所选母题不在候选里时登记为多义候选；挂默认母题的并列词补写其余组成", async () => {
    const registerBuilder = makeQueryBuilder({ data: null, error: null });
    const insertBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        leafOk(),
        published(),
        ...lyricsCheck(),
        noExisting(),
        motifs([
          // 1「风雨」：默认风（10），并列雨（11）
          { imagery_id: 1, category_id: 10, role: "primary" },
          { imagery_id: 1, category_id: 11, role: "part" },
          // 2：默认母题是 20，这次选了 10
          { imagery_id: 2, category_id: 20, role: "primary" },
        ]),
        registerBuilder,
        insertBuilder,
      ]),
    );
    const result = await createOccurrencesBatch(5, items, "token");
    expect(result).toEqual({ created: 2, skipped: 0, newImagery: 0 });
    expect(registerBuilder.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 2, category_id: 10, role: "alternative" }],
      { onConflict: "imagery_id,category_id", ignoreDuplicates: true },
    );
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ imagery_id: 1, category_id: 10 }),
      expect.objectContaining({ imagery_id: 1, category_id: 11 }),
      expect.objectContaining({ imagery_id: 2, category_id: 10 }),
    ]);
  });

  it("插入时 song_id 外键失败也提示先发布歌曲", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        leafOk(),
        published(),
        ...lyricsCheck(),
        noExisting(),
        motifs([
          { imagery_id: 1, category_id: 10, role: "primary" },
          { imagery_id: 2, category_id: 10, role: "primary" },
        ]),
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
      newImagery: 0,
    });
    expect(getUserClient).not.toHaveBeenCalled();
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
        makeQueryBuilder({ data: { song_id: 1, imagery_id: 2 }, error: null }), // 当前
        makeQueryBuilder({ data: { id: 1 }, error: null }), // 更新
        makeQueryBuilder({
          data: {
            id: 1,
            song_id: 1,
            imagery_id: 2,
            category_id: 3,
            lyric_timetag: [],
            music: null,
            imagery: null,
            imagery_categories: null,
          },
          error: null,
        }), // 回查
      ]),
    );
    const result = await updateOccurrence(1, { imagery_id: 2 }, "token");
    expect(result).toMatchObject({ id: 1 });
  });

  it("deleteOccurrence 后重算整首：被删长词覆盖的短词拿回那几行", async () => {
    const updateBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ song_id: 1 }], error: null }), // 删除「岁月」
        makeQueryBuilder({
          data: { lyrics: "[00:01.00]岁月如月\n[00:02.00]岁月" },
          error: null,
        }),
        makeQueryBuilder({
          data: [
            {
              id: 2,
              imagery_id: 9,
              lyric_timetag: ["00:01.00"],
              imagery: { name: "月" },
            },
          ],
          error: null,
        }),
        updateBuilder,
      ]),
    );
    await deleteOccurrence(1, "token");
    expect(updateBuilder.update).toHaveBeenCalledWith({
      lyric_timetag: ["00:01.00", "00:02.00"],
    });
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

describe("getOccurrencesForSong", () => {
  it("查询出错时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getOccurrencesForSong(1)).toEqual([]);
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
