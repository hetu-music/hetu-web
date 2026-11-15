import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  createTableMockClient,
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
  resyncDraftTimetags,
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
            { imagery_id: 1, motif_id: 5, role: "alternative" },
            { imagery_id: 1, motif_id: 9, role: "primary" },
            { imagery_id: 1, motif_id: 7, role: "part" },
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

const ok = (data: unknown) => makeQueryBuilder({ data, error: null });

describe("getOccurrencesForImagery（数据行映射）", () => {
  it("读工作版本的视图，歌名、词名、母题名直接是列", async () => {
    const builder = ok([
      {
        id: 1,
        song_id: 10,
        imagery_id: 20,
        motif_id: 30,
        lyric_timetag: ["01:00"],
        song_title: "标题",
        song_album: "专辑",
        imagery_name: "明月",
        motif_name: "自然",
      },
    ]);
    const client = createMockSupabaseClient([builder]);
    vi.mocked(getServiceClient).mockReturnValue(client);
    const result = await getOccurrencesForImagery(20);
    // 未发布的歌也有标注：读每首歌的工作版本
    expect(client.from).toHaveBeenCalledWith("working_song_imagery");
    expect(builder.eq).toHaveBeenCalledWith("imagery_id", 20);
    expect(result[0]).toMatchObject({
      id: 1,
      song_title: "标题",
      song_album: "专辑",
      imagery_name: "明月",
      motif_name: "自然",
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
  const motifRows = (ids: number[]) => ok(ids.map((id) => ({ id, level: 3 })));

  it("换默认母题、去掉没标注的候选：先删、再把旧默认降为多义、最后写入", async () => {
    const remove = ok(null);
    const demote = ok(null);
    const upsert = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient({
        imagery_categories: motifRows([10, 20]),
        imagery_motifs: [
          ok([
            { motif_id: 10, role: "primary" },
            { motif_id: 20, role: "alternative" },
            { motif_id: 30, role: "alternative" },
          ]),
          remove,
          demote,
          upsert,
        ],
        // 在用的标注：工作版本挂 10，线上版本挂 20；30 哪儿都没用
        working_song_imagery: ok([{ imagery_id: 7, motif_id: 10 }]),
        published_song_imagery: ok([{ imagery_id: 7, motif_id: 20 }]),
      }),
    );
    await setWordMotifs(
      7,
      { primary: 20, alternatives: [10], parts: [] },
      "token",
    );
    expect(remove.in).toHaveBeenCalledWith("motif_id", [30]);
    expect(demote.update).toHaveBeenCalledWith({ role: "alternative" });
    expect(demote.eq).toHaveBeenCalledWith("motif_id", 10);
    expect(upsert.upsert).toHaveBeenCalledWith(
      [
        { imagery_id: 7, motif_id: 10, role: "alternative" },
        { imagery_id: 7, motif_id: 20, role: "primary" },
      ],
      { onConflict: "imagery_id,motif_id" },
    );
  });

  it("要去掉的母题下还有标注时拒绝：只有线上版本还在用也算", async () => {
    const remove = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient({
        imagery_categories: motifRows([10]),
        imagery_motifs: [
          ok([
            { motif_id: 10, role: "primary" },
            { motif_id: 20, role: "alternative" },
          ]),
          remove,
        ],
        working_song_imagery: ok([]),
        published_song_imagery: ok([{ imagery_id: 7, motif_id: 20 }]),
      }),
    );
    await expect(
      setWordMotifs(7, { primary: 10, alternatives: [], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "MOTIF_IN_USE" });
    expect(remove.delete).not.toHaveBeenCalled();
  });

  it("同一母题登记两次时拒绝，不访问数据库", async () => {
    await expect(
      setWordMotifs(7, { primary: 10, alternatives: [10], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "DUPLICATE_MOTIF" });
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it("只能登记母题（第三级）", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([ok([{ id: 2, level: 2 }])]),
    );
    await expect(
      setWordMotifs(7, { primary: 2, alternatives: [], parts: [] }, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });
});

/** 草稿的 version id；工作版本（开草稿前）是 3 */
const DRAFT = 42;
const draftRpc = { rpc: { ensure_draft: { data: DRAFT, error: null } } };

describe("createOccurrencesBatch", () => {
  const items = [
    { imagery_id: 1, motif_id: 10 },
    { imagery_id: 2, motif_id: 10 },
  ];
  // 校验母题：用到的都是第三级
  const motifOk = () => ok([10, 11, 12, 20].map((id) => ({ id, level: 3 })));
  const working = () => ok({ version_id: 3 });
  // 歌词没有时间轴：不拦、不重算，测的是其余逻辑
  const noTimeline = () => ok({ lyrics: null });
  /** song_imagery 上依次是：核对歌词时读工作版本的标注、草稿里已有的标注、插入、重算时读草稿 */
  const songImagery = (existing: unknown[], insert: unknown) => [
    ok([]),
    ok(existing),
    insert,
    ok([]),
  ];

  it("先按工作版本校验，再开草稿；跳过草稿里已标注的意象，只插入其余的", async () => {
    const insertBuilder = ok(null);
    const client = createTableMockClient(
      {
        imagery_categories: motifOk(),
        working_songs: working(),
        song_versions: noTimeline(),
        song_imagery: songImagery([{ imagery_id: 1 }], insertBuilder),
        imagery_motifs: ok([
          { imagery_id: 2, motif_id: 10, role: "primary" },
        ]),
      },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    const result = await createOccurrencesBatch(5, items, "token");
    expect(result).toEqual({ created: 1, skipped: 1, newImagery: 0 });
    expect(client.rpc).toHaveBeenCalledWith("ensure_draft", { p_song_id: 5 });
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { imagery_id: 2, motif_id: 10, lyric_timetag: [], version_id: DRAFT },
    ]);
  });

  it("新意象名：复用同名意象、创建缺失的，并合并指向同一意象的项", async () => {
    const createBuilder = ok([{ id: 31, name: "孤灯" }]);
    const registerBuilder = ok(null);
    const insertBuilder = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          imagery_categories: motifOk(),
          working_songs: working(),
          song_versions: noTimeline(),
          song_imagery: songImagery([], insertBuilder),
          imagery: [
            ok([]), // 核对歌词时按 id 查词名
            ok([{ id: 3, name: "月" }]), // 按名查找
            createBuilder,
          ],
          imagery_motifs: [
            ok([{ imagery_id: 3, motif_id: 10, role: "primary" }]),
            registerBuilder,
          ],
        },
        draftRpc,
      ),
    );
    const result = await createOccurrencesBatch(
      5,
      [
        // 「明月」改成了已有的「月」，与另一条「月」合并
        { imagery_name: "月", motif_id: 10 },
        { imagery_id: 3, motif_id: 11 },
        { imagery_name: "孤灯", motif_id: 12 },
      ],
      "token",
    );
    expect(result).toEqual({ created: 2, skipped: 0, newImagery: 1 });
    expect(createBuilder.insert).toHaveBeenCalledWith([{ name: "孤灯" }]);
    // 新词以这次选的母题为默认母题
    expect(registerBuilder.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 31, motif_id: 12, role: "primary" }],
      { onConflict: "imagery_id,motif_id", ignoreDuplicates: true },
    );
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { imagery_id: 3, motif_id: 10, lyric_timetag: [], version_id: DRAFT },
      { imagery_id: 31, motif_id: 12, lyric_timetag: [], version_id: DRAFT },
    ]);
  });

  it("有一项不是母题（第三级）时拒绝整批", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      // 空着的二级分类也没有子分类，原先按「叶子」判断会放过
      createMockSupabaseClient([ok([{ id: 10, level: 2 }])]),
    );
    await expect(
      createOccurrencesBatch(5, items, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });

  it("歌曲不存在时在创建意象、开草稿之前就拒绝；未发布的歌也能标", async () => {
    const client = createTableMockClient(
      { imagery_categories: motifOk(), working_songs: ok(null) },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      createOccurrencesBatch(
        5,
        [{ imagery_name: "孤灯", motif_id: 10 }],
        "token",
      ),
    ).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
    expect(client.from).toHaveBeenCalledWith("working_songs");
    expect(client.from).not.toHaveBeenCalledWith("imagery");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("词不在（工作版本的）歌词里时在创建意象、开草稿之前就拒绝", async () => {
    const client = createTableMockClient(
      {
        imagery_categories: motifOk(),
        working_songs: working(),
        song_versions: ok({ lyrics: "[00:01.00]明月" }),
        song_imagery: ok([]),
      },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      createOccurrencesBatch(
        5,
        [
          { imagery_name: "明月", motif_id: 10 },
          { imagery_name: "孤灯", motif_id: 10 },
        ],
        "token",
      ),
    ).rejects.toThrow("歌词里没有「孤灯」");
    expect(client.from).not.toHaveBeenCalledWith("imagery");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("所选母题不在候选里时登记为多义候选；挂默认母题的并列词补写其余组成", async () => {
    const registerBuilder = ok(null);
    const insertBuilder = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          imagery_categories: motifOk(),
          working_songs: working(),
          song_versions: noTimeline(),
          song_imagery: songImagery([], insertBuilder),
          imagery_motifs: [
            ok([
              // 1「风雨」：默认风（10），并列雨（11）
              { imagery_id: 1, motif_id: 10, role: "primary" },
              { imagery_id: 1, motif_id: 11, role: "part" },
              // 2：默认母题是 20，这次选了 10
              { imagery_id: 2, motif_id: 20, role: "primary" },
            ]),
            registerBuilder,
          ],
        },
        draftRpc,
      ),
    );
    const result = await createOccurrencesBatch(5, items, "token");
    expect(result).toEqual({ created: 2, skipped: 0, newImagery: 0 });
    expect(registerBuilder.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 2, motif_id: 10, role: "alternative" }],
      { onConflict: "imagery_id,motif_id", ignoreDuplicates: true },
    );
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ imagery_id: 1, motif_id: 10 }),
      expect.objectContaining({ imagery_id: 1, motif_id: 11 }),
      expect.objectContaining({ imagery_id: 2, motif_id: 10 }),
    ]);
  });

  it("插入时 version_id 外键失败（草稿在两次请求之间没了）提示歌曲不存在", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          imagery_categories: motifOk(),
          working_songs: working(),
          song_versions: noTimeline(),
          song_imagery: songImagery(
            [],
            makeQueryBuilder({
              data: null,
              error: {
                code: "23503",
                message:
                  'insert or update on table "song_imagery" violates foreign key constraint "song_imagery_version_id_fkey"',
              },
            }),
          ),
          imagery_motifs: ok([
            { imagery_id: 1, motif_id: 10, role: "primary" },
            { imagery_id: 2, motif_id: 10, role: "primary" },
          ]),
        },
        draftRpc,
      ),
    );
    await expect(
      createOccurrencesBatch(5, items, "token"),
    ).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
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
    ok({
      id: 1,
      song_id: 1,
      imagery_id: 2,
      motif_id: 20,
      lyric_timetag: [],
      song_title: "歌",
      song_album: null,
      imagery_name: "汗",
      motif_name: "身躯",
    });
  /** 工作版本里的这一行（开草稿前在版本 3 上） */
  const current = (imagery_id: number, motif_id: number) =>
    ok({ song_id: 1, version_id: 3, imagery_id, motif_id });
  const noTimeline = () => ok({ lyrics: null });

  it("改挂到非母题时拒绝", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([ok([{ id: 5, level: 2 }])]),
    );
    await expect(
      updateOccurrence(1, { motif_id: 5 }, "token"),
    ).rejects.toMatchObject({ code: "NOT_MOTIF" });
  });

  it("改在草稿上；词在原母题下已没有标注、原母题是它的默认母题时，默认母题跟到新母题上", async () => {
    const siblings = ok(null);
    const update = ok({ id: 1 });
    const unregister = ok(null);
    const promote = ok(null);
    const client = createTableMockClient(
      {
        imagery_categories: ok([{ id: 20, level: 3 }]),
        // 当前：「汗」挂在母题汗（10）；中间一次是判断原母题还有没有人用；改完在工作版本里查出来返回
        working_song_imagery: [current(2, 10), ok([]), relations()],
        published_song_imagery: ok([]),
        imagery_motifs: [
          ok([{ imagery_id: 2, motif_id: 10, role: "primary" }]), // 登记
          ok(null), // 登记身躯为「有时也指」
          ok({ role: "primary" }), // 原母题的登记
          unregister,
          promote,
          ok([{ motif_id: 20, role: "primary" }]), // 补写「同时算进」：这个词没有
        ],
        song_imagery: [siblings, update, ok([])],
        song_versions: noTimeline(),
      },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    await updateOccurrence(1, { motif_id: 20 }, "token");
    expect(client.rpc).toHaveBeenCalledWith("ensure_draft", { p_song_id: 1 });
    expect(siblings.eq).toHaveBeenCalledWith("version_id", DRAFT);
    expect(siblings.neq).toHaveBeenCalledWith("id", 1);
    expect(update.eq).toHaveBeenCalledWith("version_id", DRAFT);
    expect(update.eq).toHaveBeenCalledWith("id", 1);
    expect(unregister.eq).toHaveBeenCalledWith("motif_id", 10);
    expect(promote.upsert).toHaveBeenCalledWith(
      { imagery_id: 2, motif_id: 20, role: "primary" },
      { onConflict: "imagery_id,motif_id" },
    );
  });

  it("原母题下还有这个词的标注时，默认母题不动：只有线上版本还在用也算", async () => {
    const unregister = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          imagery_categories: ok([{ id: 20, level: 3 }]),
          working_song_imagery: [current(2, 10), ok([]), relations()],
          published_song_imagery: ok([{ imagery_id: 2, motif_id: 10 }]),
          imagery_motifs: [
            ok([{ imagery_id: 2, motif_id: 10, role: "primary" }]),
            ok(null),
            ok({ role: "primary" }),
            unregister,
          ],
          song_imagery: [ok(null), ok({ id: 1 }), ok([])],
          song_versions: noTimeline(),
        },
        draftRpc,
      ),
    );
    await updateOccurrence(1, { motif_id: 20 }, "token");
    expect(unregister.delete).not.toHaveBeenCalled();
  });

  it("没有改动时直接返回，不开草稿", async () => {
    const client = createTableMockClient(
      {
        imagery_categories: ok([{ id: 10, level: 3 }]),
        working_song_imagery: [current(2, 10), relations()],
      },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    await updateOccurrence(1, { motif_id: 10 }, "token");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("改挂到词的「通常算作」上时，在草稿里补写它「同时算进」的各条", async () => {
    const siblings = ok(null);
    const parts = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          imagery_categories: ok([{ id: 10, level: 3 }]),
          // 「风雨」原来挂在「有时也指」30 上
          working_song_imagery: [current(1, 30), ok([]), relations()],
          published_song_imagery: ok([]),
          imagery_motifs: [
            ok([
              { imagery_id: 1, motif_id: 10, role: "primary" },
              { imagery_id: 1, motif_id: 11, role: "part" },
              { imagery_id: 1, motif_id: 30, role: "alternative" },
            ]), // 已登记，不用再登记
            ok({ role: "alternative" }),
            ok([
              { motif_id: 10, role: "primary" },
              { motif_id: 11, role: "part" },
              { motif_id: 30, role: "alternative" },
            ]),
          ],
          song_imagery: [siblings, ok({ id: 1 }), parts, ok([])],
          song_versions: noTimeline(),
        },
        draftRpc,
      ),
    );
    await updateOccurrence(1, { motif_id: 10 }, "token");
    expect(siblings.eq).toHaveBeenCalledWith("imagery_id", 1);
    expect(parts.upsert).toHaveBeenCalledWith(
      [
        {
          version_id: DRAFT,
          imagery_id: 1,
          motif_id: 11,
          lyric_timetag: [],
        },
      ],
      {
        onConflict: "version_id,imagery_id,motif_id",
        ignoreDuplicates: true,
      },
    );
  });

  it("换成词典里没有的词：按工作版本核对歌词后创建，再改草稿里这条标注", async () => {
    const createWord = ok([{ id: 31, name: "孤灯" }]);
    const siblings = ok(null);
    const update = ok({ id: 1 });
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          working_song_imagery: [current(2, 10), relations()],
          song_versions: noTimeline(),
          song_imagery: [ok([]), siblings, update, ok([])],
          imagery: [ok([]), createWord],
          imagery_motifs: [
            ok([]), // 新词还没有登记
            ok(null), // 登记默认母题
            ok([{ motif_id: 10, role: "primary" }]),
          ],
        },
        draftRpc,
      ),
    );
    await updateOccurrence(1, { imagery_name: "孤灯" }, "token");
    expect(createWord.insert).toHaveBeenCalledWith([{ name: "孤灯" }]);
    expect(siblings.eq).toHaveBeenCalledWith("imagery_id", 2);
    expect(update.update).toHaveBeenCalledWith({
      imagery_id: 31,
      motif_id: 10,
    });
  });

  it("deleteOccurrence 在草稿里连同补写的「同时算进」一起删，再按草稿的歌词重算", async () => {
    const remove = ok([{ motif_id: 5 }, { motif_id: 6 }]);
    const updateBuilder = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        {
          working_song_imagery: ok({ song_id: 1, imagery_id: 8 }), // 「岁月」
          song_imagery: [
            remove,
            ok([
              {
                id: 2,
                imagery_id: 9,
                motif_id: 7,
                lyric_timetag: ["00:01.00"],
                imagery: { name: "月" },
              },
            ]),
            updateBuilder,
          ],
          song_versions: ok({ lyrics: "[00:01.00]岁月如月\n[00:02.00]岁月" }),
        },
        draftRpc,
      ),
    );
    const result = await deleteOccurrence(1, "token");
    expect(remove.eq).toHaveBeenCalledWith("version_id", DRAFT);
    expect(remove.eq).toHaveBeenCalledWith("imagery_id", 8);
    // 删掉长词后，被它覆盖的短词拿回那几行
    expect(updateBuilder.update).toHaveBeenCalledWith({
      lyric_timetag: ["00:01.00", "00:02.00"],
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith("version_id", DRAFT);
    expect(result).toEqual({ songId: 1, motifIds: [5, 6] });
  });

  it("deleteOccurrence：工作版本里没有这条时返回 null，不开草稿", async () => {
    const client = createTableMockClient(
      { working_song_imagery: ok(null) },
      draftRpc,
    );
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await deleteOccurrence(1, "token")).toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
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

describe("resyncDraftTimetags（发布前按草稿的歌词重算）", () => {
  const rows = (lyric_timetag: string[]) => [
    {
      id: 1,
      imagery_id: 7,
      motif_id: 70,
      lyric_timetag,
      imagery: { name: "明月" },
    },
  ];

  it("时间轴变了：改写草稿里的标签，返回变动的母题；歌词里没有的词清空标签并报出", async () => {
    const updateBuilder = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient({
        working_songs: ok({ version_id: DRAFT, has_draft: true }),
        song_versions: ok({
          lyrics: "[00:03.00]明月几时有\n[00:05.00]把酒问青天",
        }),
        song_imagery: [
          ok([
            ...rows(["00:01.00"]),
            {
              id: 2,
              imagery_id: 8,
              motif_id: 80,
              lyric_timetag: ["00:05.00"],
              imagery: { name: "青天" },
            },
            {
              id: 3,
              imagery_id: 9,
              motif_id: 90,
              lyric_timetag: ["00:02.00"],
              imagery: { name: "流水" },
            },
          ]),
          updateBuilder,
        ],
      }),
    );
    const result = await resyncDraftTimetags(1, "token");
    expect(updateBuilder.update.mock.calls).toEqual([
      [{ lyric_timetag: ["00:03.00"] }],
      [{ lyric_timetag: [] }],
    ]);
    expect(updateBuilder.eq).toHaveBeenCalledWith("version_id", DRAFT);
    expect(result).toEqual({ motifIds: [70, 90], notFound: ["流水"] });
  });

  it("没有草稿（下架后原样重新上线）时什么也不做", async () => {
    const client = createTableMockClient({
      working_songs: ok({ version_id: 3, has_draft: false }),
    });
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await resyncDraftTimetags(1, "token")).toEqual({
      motifIds: [],
      notFound: [],
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("歌词没有时间轴时不动", async () => {
    const update = ok(null);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient({
        working_songs: ok({ version_id: DRAFT, has_draft: true }),
        song_versions: ok({ lyrics: "明月几时有" }),
        song_imagery: [ok(rows(["00:01.00"])), update],
      }),
    );
    expect(await resyncDraftTimetags(1, "token")).toEqual({
      motifIds: [],
      notFound: [],
    });
    expect(update.update).not.toHaveBeenCalled();
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
  const routes = (
    extra: { motifs?: unknown[]; categories?: unknown[] } = {},
  ) => ({
    imagery_categories: [ok(categories), ...(extra.categories ?? [])],
    imagery_motifs: [
      ok([
        { imagery_id: 1, motif_id: 10, role: "primary" },
        { imagery_id: 1, motif_id: 11, role: "alternative" },
      ]),
      ...(extra.motifs ?? []),
    ],
    working_song_imagery: ok([{ imagery_id: 1, motif_id: 11 }]),
    published_song_imagery: ok([]),
    imagery: ok([{ id: 1, name: "汗" }]),
  });

  it("没有标注的第三级都列出，只剩词登记的也算；空着的二级分类不动", async () => {
    vi.mocked(getUserClient).mockReturnValue(createTableMockClient(routes()));
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

  it("草稿里不用了、线上版本还在用的母题不算空", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient({
        ...routes(),
        published_song_imagery: ok([{ imagery_id: 2, motif_id: 12 }]),
      }),
    );
    const result = await getUnusedMotifs("token");
    expect(result.map((c) => c.id)).toEqual([10]);
  });

  it("删除：先删登记，再把多义候选提为默认母题，最后删母题", async () => {
    const unregister = ok(null);
    const promote = ok(null);
    const remove = ok([{ id: 10 }, { id: 12 }]);
    vi.mocked(getUserClient).mockReturnValue(
      createTableMockClient(
        routes({ motifs: [unregister, promote], categories: [remove] }),
      ),
    );
    const result = await deleteUnusedMotifs([10, 11, 12], "token");
    expect(unregister.delete).toHaveBeenCalled();
    expect(unregister.in).toHaveBeenCalledWith("motif_id", [10, 12]);
    expect(promote.upsert).toHaveBeenCalledWith(
      [{ imagery_id: 1, motif_id: 11, role: "primary" }],
      { onConflict: "imagery_id,motif_id" },
    );
    expect(remove.in).toHaveBeenCalledWith("id", [10, 12]);
    expect(result).toEqual({
      deleted: [10, 12],
      promoted: [{ word: "汗", motif: "身躯" }],
    });
  });

  it("选中的都已有标注时不发删除", async () => {
    const client = createTableMockClient(routes());
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await deleteUnusedMotifs([11], "token")).toEqual({
      deleted: [],
      promoted: [],
    });
    expect(
      client.from.mock.calls.filter(
        (c: unknown[]) => c[0] === "imagery_categories",
      ),
    ).toHaveLength(1);
  });
});
