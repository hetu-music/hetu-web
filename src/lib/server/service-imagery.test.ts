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
  createMotif,
  deleteOccurrence,
  getOccurrencesForImagery,
  getOccurrencesForSong,
  createOccurrencesBatch,
  getImageryWithCounts,
  setWordMotifs,
  updateMotif,
  updateOccurrence,
  getImageryLastModified,
  resyncSongTimetags,
  getUnusedMotifs,
  deleteUnusedMotifs,
} from "./service-imagery";

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
});

describe("getImageryWithCounts", () => {
  it("读含争议歌曲、含 0 次的全量视图与词的母题登记", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: [], error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);
    await getImageryWithCounts();
    expect(client.from.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      "imagery_summary_all",
      "imagery_motifs",
    ]);
  });

  it("母题只看登记：默认母题、多义候选、并列组成分开；没登记的词默认母题为 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            { id: 1, name: "烟花", count: 3 },
            { id: 2, name: "新词", count: null },
          ],
          error: null,
        }),
        makeQueryBuilder({
          data: [
            { imagery_id: 1, category_id: 5, role: "alternative" },
            { imagery_id: 1, category_id: 9, role: "primary" },
            { imagery_id: 1, category_id: 7, role: "part" },
          ],
          error: null,
        }),
      ]),
    );
    expect(await getImageryWithCounts()).toEqual([
      {
        id: 1,
        name: "烟花",
        count: 3,
        primary: 9,
        alternatives: [5],
        parts: [7],
      },
      {
        id: 2,
        name: "新词",
        count: 0,
        primary: null,
        alternatives: [],
        parts: [],
      },
    ]);
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

describe("createMotif / updateMotif（只增改第三级）", () => {
  it("挂在类别（第二级）下时创建，level 固定为 3", async () => {
    const insertBuilder = makeQueryBuilder({
      data: { id: 9, name: "汗", parent_id: 2, level: 3, description: "汗水" },
      error: null,
    });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 2 }, error: null }),
        insertBuilder,
      ]),
    );
    const created = await createMotif(
      { name: "汗", parent_id: 2, description: "汗水" },
      "token",
    );
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      name: "汗",
      parent_id: 2,
      description: "汗水",
      level: 3,
    });
    expect(created).toMatchObject({ id: 9, level: 3 });
  });

  it("父级是门类或母题时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { level: 1 }, error: null }),
      ]),
    );
    await expect(
      createMotif({ name: "汗", parent_id: 1, description: "汗水" }, "token"),
    ).rejects.toMatchObject({ code: "INVALID_PARENT" });
  });

  it("不能改门类、类别", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 2, level: 2 }], error: null }),
      ]),
    );
    await expect(
      updateMotif(2, { name: "身体部位" }, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });

  it("移到别的类别下要校验新父级", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 9, level: 3 }], error: null }),
        makeQueryBuilder({ data: { level: 3 }, error: null }), // 新父级是母题
      ]),
    );
    await expect(
      updateMotif(9, { parent_id: 10 }, "token"),
    ).rejects.toMatchObject({ code: "INVALID_PARENT" });
  });
});

describe("setWordMotifs（改写词的候选母题）", () => {
  const motifRows = (ids: number[]) =>
    makeQueryBuilder({
      data: ids.map((id) => ({ id, level: 3 })),
      error: null,
    });

  it("换默认母题、去掉没标注的候选：先删、再把旧默认降为多义、最后写入", async () => {
    const remove = makeQueryBuilder({ data: null, error: null });
    const demote = makeQueryBuilder({ data: null, error: null });
    const upsert = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        motifRows([10, 20]),
        makeQueryBuilder({
          data: [
            { category_id: 10, role: "primary" },
            { category_id: 20, role: "alternative" },
            { category_id: 30, role: "alternative" },
          ],
          error: null,
        }),
        makeQueryBuilder({
          data: [{ category_id: 10 }, { category_id: 20 }],
          error: null,
        }),
        remove,
        demote,
        upsert,
      ]),
    );
    await setWordMotifs(
      7,
      { primary: 20, alternatives: [10], parts: [] },
      "token",
    );
    expect(remove.in).toHaveBeenCalledWith("category_id", [30]);
    expect(demote.update).toHaveBeenCalledWith({ role: "alternative" });
    expect(demote.eq).toHaveBeenCalledWith("category_id", 10);
    expect(upsert.upsert).toHaveBeenCalledWith(
      [
        { imagery_id: 7, category_id: 10, role: "alternative" },
        { imagery_id: 7, category_id: 20, role: "primary" },
      ],
      { onConflict: "imagery_id,category_id" },
    );
  });

  it("要去掉的母题下还有这个词的标注时拒绝", async () => {
    const client = createMockSupabaseClient([
      motifRows([10]),
      makeQueryBuilder({
        data: [
          { category_id: 10, role: "primary" },
          { category_id: 20, role: "alternative" },
        ],
        error: null,
      }),
      makeQueryBuilder({ data: [{ category_id: 20 }], error: null }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      setWordMotifs(7, { primary: 10, alternatives: [], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "MOTIF_IN_USE" });
    expect(client.from).toHaveBeenCalledTimes(3);
  });

  it("同一母题登记两次时拒绝，不访问数据库", async () => {
    await expect(
      setWordMotifs(7, { primary: 10, alternatives: [10], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "DUPLICATE_MOTIF" });
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it("只能登记母题（第三级）", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 2, level: 2 }], error: null }),
      ]),
    );
    await expect(
      setWordMotifs(7, { primary: 2, alternatives: [], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });
});

describe("createOccurrencesBatch", () => {
  const items = [
    { imagery_id: 1, category_id: 10 },
    { imagery_id: 2, category_id: 10 },
  ];
  // 校验母题：用到的都是第三级
  const motifOk = () =>
    makeQueryBuilder({
      data: [10, 11, 12, 20].map((id) => ({ id, level: 3 })),
      error: null,
    });
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
        motifOk(),
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
        motifOk(),
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

  it("有一项不是母题（第三级）时拒绝整批", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        // 空着的二级分类也没有子分类，原先按「叶子」判断会放过
        makeQueryBuilder({ data: [{ id: 10, level: 2 }], error: null }),
      ]),
    );
    await expect(
      createOccurrencesBatch(5, items, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });

  it("歌曲未发布时在创建意象之前就拒绝", async () => {
    const client = createMockSupabaseClient([
      motifOk(),
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
      motifOk(),
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
        motifOk(),
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
        motifOk(),
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

describe("updateOccurrence / deleteOccurrence", () => {
  const relations = () =>
    makeQueryBuilder({
      data: {
        id: 1,
        song_id: 1,
        imagery_id: 2,
        category_id: 20,
        lyric_timetag: [],
        music: null,
        imagery: null,
        imagery_categories: null,
      },
      error: null,
    });

  it("改挂到非母题时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 5, level: 2 }], error: null }),
      ]),
    );
    await expect(
      updateOccurrence(1, { category_id: 5 }, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });

  // 改完都按歌词重算整首：歌词没有时间轴时读两次就返回
  const noTimeline = () => [
    makeQueryBuilder({ data: { lyrics: null }, error: null }),
    makeQueryBuilder({ data: [], error: null }),
  ];

  it("词在原母题下已没有标注、原母题是它的默认母题时，默认母题跟到新母题上", async () => {
    const siblings = makeQueryBuilder({ data: null, error: null });
    const unregister = makeQueryBuilder({ data: null, error: null });
    const promote = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 20, level: 3 }], error: null }),
        makeQueryBuilder({
          data: { song_id: 1, imagery_id: 2, category_id: 10 },
          error: null,
        }), // 当前：「汗」挂在母题汗（10）
        makeQueryBuilder({
          data: [{ imagery_id: 2, category_id: 10, role: "primary" }],
          error: null,
        }), // 登记
        makeQueryBuilder({ data: null, error: null }), // 登记身躯为「有时也指」
        siblings, // 删掉补写的「同时算进」
        makeQueryBuilder({ data: { id: 1 }, error: null }), // 更新
        makeQueryBuilder({ data: { role: "primary" }, error: null }), // 原母题的登记
        makeQueryBuilder({ data: [], error: null }), // 原母题下已没有标注
        unregister,
        promote,
        makeQueryBuilder({
          data: [{ category_id: 20, role: "primary" }],
          error: null,
        }), // 补写「同时算进」：这个词没有
        ...noTimeline(),
        relations(),
      ]),
    );
    await updateOccurrence(1, { category_id: 20 }, "token");
    expect(siblings.neq).toHaveBeenCalledWith("id", 1);
    expect(unregister.eq).toHaveBeenCalledWith("category_id", 10);
    expect(promote.upsert).toHaveBeenCalledWith(
      { imagery_id: 2, category_id: 20, role: "primary" },
      { onConflict: "imagery_id,category_id" },
    );
  });

  it("原母题下还有这个词的标注时，默认母题不动", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: [{ id: 20, level: 3 }], error: null }),
      makeQueryBuilder({
        data: { song_id: 1, imagery_id: 2, category_id: 10 },
        error: null,
      }),
      makeQueryBuilder({
        data: [{ imagery_id: 2, category_id: 10, role: "primary" }],
        error: null,
      }),
      makeQueryBuilder({ data: null, error: null }),
      makeQueryBuilder({ data: null, error: null }), // 删掉补写的
      makeQueryBuilder({ data: { id: 1 }, error: null }),
      makeQueryBuilder({ data: { role: "primary" }, error: null }),
      makeQueryBuilder({ data: [{ id: 5 }], error: null }), // 别的歌还挂在原母题
      makeQueryBuilder({
        data: [
          { category_id: 10, role: "primary" },
          { category_id: 20, role: "alternative" },
        ],
        error: null,
      }),
      ...noTimeline(),
      relations(),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await updateOccurrence(1, { category_id: 20 }, "token");
    expect(client.from).toHaveBeenCalledTimes(12);
  });

  it("改挂到词的「通常算作」上时，补写它「同时算进」的各条", async () => {
    const siblings = makeQueryBuilder({ data: null, error: null });
    const parts = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: [{ id: 10, level: 3 }], error: null }),
        makeQueryBuilder({
          data: { song_id: 1, imagery_id: 1, category_id: 30 },
          error: null,
        }), // 「风雨」原来挂在「有时也指」30 上
        makeQueryBuilder({
          data: [
            { imagery_id: 1, category_id: 10, role: "primary" },
            { imagery_id: 1, category_id: 11, role: "part" },
            { imagery_id: 1, category_id: 30, role: "alternative" },
          ],
          error: null,
        }), // 已登记，不用再登记
        siblings,
        makeQueryBuilder({ data: { id: 1 }, error: null }),
        makeQueryBuilder({ data: { role: "alternative" }, error: null }),
        makeQueryBuilder({ data: [], error: null }),
        makeQueryBuilder({
          data: [
            { category_id: 10, role: "primary" },
            { category_id: 11, role: "part" },
            { category_id: 30, role: "alternative" },
          ],
          error: null,
        }),
        parts,
        ...noTimeline(),
        relations(),
      ]),
    );
    await updateOccurrence(1, { category_id: 10 }, "token");
    expect(siblings.eq).toHaveBeenCalledWith("imagery_id", 1);
    expect(parts.upsert).toHaveBeenCalledWith(
      [{ song_id: 1, imagery_id: 1, category_id: 11, lyric_timetag: [] }],
      { onConflict: "song_id,imagery_id,category_id", ignoreDuplicates: true },
    );
  });

  it("换成词典里没有的词：核对歌词后创建，再改这条标注", async () => {
    const createWord = makeQueryBuilder({
      data: [{ id: 31, name: "孤灯" }],
      error: null,
    });
    const siblings = makeQueryBuilder({ data: null, error: null });
    const update = makeQueryBuilder({ data: { id: 1 }, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { song_id: 1, imagery_id: 2, category_id: 10 },
          error: null,
        }), // 当前
        ...noTimeline(), // 核对歌词：没有时间轴
        makeQueryBuilder({ data: [], error: null }), // 按名查找
        createWord,
        makeQueryBuilder({ data: [], error: null }), // 新词还没有登记
        makeQueryBuilder({ data: null, error: null }), // 登记默认母题
        siblings, // 旧词补写的「同时算进」
        update,
        makeQueryBuilder({
          data: [{ category_id: 10, role: "primary" }],
          error: null,
        }),
        ...noTimeline(),
        relations(),
      ]),
    );
    await updateOccurrence(1, { imagery_name: "孤灯" }, "token");
    expect(createWord.insert).toHaveBeenCalledWith([{ name: "孤灯" }]);
    expect(siblings.eq).toHaveBeenCalledWith("imagery_id", 2);
    expect(update.update).toHaveBeenCalledWith({
      imagery_id: 31,
      category_id: 10,
    });
  });

  it("deleteOccurrence 连同补写的「同时算进」一起删，再重算整首", async () => {
    const remove = makeQueryBuilder({
      data: [{ category_id: 5 }, { category_id: 6 }],
      error: null,
    });
    const updateBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { song_id: 1, imagery_id: 8 }, error: null }), // 「岁月」
        remove,
        makeQueryBuilder({
          data: { lyrics: "[00:01.00]岁月如月\n[00:02.00]岁月" },
          error: null,
        }),
        makeQueryBuilder({
          data: [
            {
              id: 2,
              imagery_id: 9,
              category_id: 7,
              lyric_timetag: ["00:01.00"],
              imagery: { name: "月" },
            },
          ],
          error: null,
        }),
        updateBuilder,
      ]),
    );
    const result = await deleteOccurrence(1, "token");
    expect(remove.eq).toHaveBeenCalledWith("song_id", 1);
    expect(remove.eq).toHaveBeenCalledWith("imagery_id", 8);
    // 删掉长词后，被它覆盖的短词拿回那几行
    expect(updateBuilder.update).toHaveBeenCalledWith({
      lyric_timetag: ["00:01.00", "00:02.00"],
    });
    expect(result).toEqual({ songId: 1, motifIds: [5, 6] });
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

describe("resyncSongTimetags（发布新歌词后重算）", () => {
  it("时间轴变了：改写标签，返回变动的母题；歌词里没有的词清空标签并报出", async () => {
    const updateBuilder = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { lyrics: "[00:03.00]明月几时有\n[00:05.00]把酒问青天" },
          error: null,
        }),
        makeQueryBuilder({
          data: [
            {
              id: 1,
              imagery_id: 7,
              category_id: 70,
              lyric_timetag: ["00:01.00"],
              imagery: { name: "明月" },
            },
            {
              id: 2,
              imagery_id: 8,
              category_id: 80,
              lyric_timetag: ["00:05.00"],
              imagery: { name: "青天" },
            },
            {
              id: 3,
              imagery_id: 9,
              category_id: 90,
              lyric_timetag: ["00:02.00"],
              imagery: { name: "流水" },
            },
          ],
          error: null,
        }),
        updateBuilder,
      ]),
    );
    const result = await resyncSongTimetags(1, "token");
    expect(updateBuilder.update.mock.calls).toEqual([
      [{ lyric_timetag: ["00:03.00"] }],
      [{ lyric_timetag: [] }],
    ]);
    expect(result).toEqual({ motifIds: [70, 90], notFound: ["流水"] });
  });

  it("歌词没有时间轴时不动", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: { lyrics: "明月几时有" }, error: null }),
      makeQueryBuilder({
        data: [
          {
            id: 1,
            imagery_id: 7,
            category_id: 70,
            lyric_timetag: ["00:01.00"],
            imagery: { name: "明月" },
          },
        ],
        error: null,
      }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await resyncSongTimetags(1, "token")).toEqual({
      motifIds: [],
      notFound: [],
    });
    expect(client.from).toHaveBeenCalledTimes(2);
  });
});

describe("整理空母题", () => {
  const categories = [
    { id: 1, name: "自然", parent_id: null, level: 1, description: null },
    { id: 2, name: "身体", parent_id: 1, level: 2, description: null },
    { id: 3, name: "空类", parent_id: 1, level: 2, description: null },
    { id: 10, name: "汗", parent_id: 2, level: 3, description: null },
    { id: 11, name: "身躯", parent_id: 2, level: 3, description: null },
    { id: 12, name: "虹", parent_id: 2, level: 3, description: null },
  ];
  // 「汗」先挂母题汗、后改成身躯：汗仍是它的默认母题，但已没有标注
  const lookups = () => [
    makeQueryBuilder({ data: categories, error: null }),
    makeQueryBuilder({
      data: [
        { imagery_id: 1, category_id: 10, role: "primary" },
        { imagery_id: 1, category_id: 11, role: "alternative" },
      ],
      error: null,
    }),
    makeQueryBuilder({
      data: [{ imagery_id: 1, category_id: 11 }],
      error: null,
    }),
    makeQueryBuilder({ data: [{ id: 1, name: "汗" }], error: null }),
  ];

  it("没有标注的第三级都列出，只剩词登记的也算；空着的二级分类不动", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(lookups()),
    );
    const result = await getUnusedMotifs("token");
    expect(result.map((c) => c.id)).toEqual([10, 12]);
    expect(result[0].words).toEqual([
      {
        id: 1,
        name: "汗",
        role: "primary",
        promoteTo: { id: 11, name: "身躯" },
      },
    ]);
    expect(result[1].words).toEqual([]);
  });

  it("删除：先删登记，再把多义候选提为默认母题，最后删母题", async () => {
    const unregister = makeQueryBuilder({ data: null, error: null });
    const promote = makeQueryBuilder({ data: null, error: null });
    const remove = makeQueryBuilder({
      data: [{ id: 10 }, { id: 12 }],
      error: null,
    });
    const client = createMockSupabaseClient([
      ...lookups(),
      unregister,
      promote,
      remove,
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    const result = await deleteUnusedMotifs([10, 11, 12], "token");
    expect(unregister.delete).toHaveBeenCalled();
    expect(unregister.in).toHaveBeenCalledWith("category_id", [10, 12]);
    expect(promote.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 1, category_id: 11, role: "primary" }],
      { onConflict: "imagery_id,category_id" },
    );
    expect(remove.in).toHaveBeenCalledWith("id", [10, 12]);
    expect(result).toEqual({
      deleted: [10, 12],
      promoted: [{ word: "汗", motif: "身躯" }],
    });
  });

  it("选中的都已有标注时不发删除", async () => {
    const client = createMockSupabaseClient(lookups());
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await deleteUnusedMotifs([11], "token")).toEqual({
      deleted: [],
      promoted: [],
    });
    expect(client.from).toHaveBeenCalledTimes(4);
  });
});
