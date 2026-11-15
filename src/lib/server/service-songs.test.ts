import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

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
    getUserClient: vi.fn(),
  };
});

import { getServiceClient, getUserClient } from "@/lib/db/supabase-server";
import { getCreditAliases } from "@/lib/server/service-credit-aliases";
import {
  createSong,
  getSongById,
  getSongs,
  getSongsByIds,
  getSongLastModifiedMap,
  updateSong,
} from "./service-songs";

describe("getSongs", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
    vi.mocked(getUserClient).mockReset();
  });

  it("service client 不可用时返回空数组，而不是抛异常", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    const songs = await getSongs();
    expect(songs).toEqual([]);
  });

  it("公共主表：用 service client 全量获取并按 date 排序", async () => {
    const rows = [
      { id: 1, title: "旧歌", date: "2020-01-01" },
      { id: 2, title: "新歌", date: "2023-01-01" },
    ];
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: rows, error: null })]),
    );
    const songs = await getSongs();
    expect(songs.map((s) => s.id)).toEqual([2, 1]); // 新歌在前
  });

  it("zh-TW locale 时标题被转换为繁体", async () => {
    const rows = [{ id: 1, title: "中国话", date: "2020-01-01" }];
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: rows, error: null })]),
    );
    const songs = await getSongs("published_songs", undefined, false, "zh-TW");
    expect(songs[0].title).toBe("中國話");
  });

  it("Admin 路径（带 accessToken）：user client 不可用返回空数组", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    const songs = await getSongs("working_songs", "token123");
    expect(songs).toEqual([]);
  });

  it("Admin 路径查询出错时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "db error" } }),
      ]),
    );
    await expect(getSongs("working_songs", "token123")).rejects.toThrow(
      "Failed to fetch songs",
    );
  });
});

describe("getSongById", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
    vi.mocked(getUserClient).mockReset();
  });

  it("客户端不可用时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getSongById(1)).toBeNull();
  });

  it("查询出错时返回 null（不抛异常）", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "not found" } }),
      ]),
    );
    expect(await getSongById(1)).toBeNull();
  });

  it("查询结果为空时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: null, error: null })]),
    );
    expect(await getSongById(1)).toBeNull();
  });

  it("date 存在时计算 year 字段", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, title: "标题", date: "2021-06-01" },
          error: null,
        }),
      ]),
    );
    const song = await getSongById(1);
    expect(song?.year).toBe(2021);
  });

  it("zh-TW locale 时多个字段整体转换为繁体", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: {
            id: 1,
            title: "中国话",
            album: "简体专辑",
            artist: ["中国歌手"],
          },
          error: null,
        }),
      ]),
    );
    const song = await getSongById(1, "published_songs", undefined, "zh-TW");
    expect(song?.title).toBe("中國話");
    expect(song?.album).toBe("簡體專輯");
    expect(song?.artist).toEqual(["中國歌手"]);
  });

  it("公开页：署名换成主名，原署留给版记（繁体一并转换，缺的字段不补）", async () => {
    vi.mocked(getCreditAliases).mockResolvedValueOnce(
      new Map([["萧忆情Alex", "萧忆情"]]),
    );
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: {
            id: 1,
            title: "标题",
            artist: ["萧忆情Alex"],
            lyricist: ["河图"],
          },
          error: null,
        }),
      ]),
    );
    const song = await getSongById(1, "published_songs", undefined, "zh-TW");
    expect(song?.artist).toEqual(["蕭憶情"]);
    expect(song?.credited).toEqual({ artist: ["蕭憶情Alex"] });
    expect(song?.aliasOf).toEqual({ 蕭憶情Alex: "蕭憶情" });
  });

  it("后台读工作版本时署名保持原样", async () => {
    vi.mocked(getCreditAliases).mockResolvedValueOnce(
      new Map([["萧忆情Alex", "萧忆情"]]),
    );
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, title: "标题", artist: ["萧忆情Alex"] },
          error: null,
        }),
      ]),
    );
    const song = await getSongById(1, "working_songs", "token");
    expect(song?.artist).toEqual(["萧忆情Alex"]);
    expect(song?.credited).toBeUndefined();
    // 后台路径不读别名表，排队的返回值要清掉，免得漏给后面的用例
    vi.mocked(getCreditAliases).mockReset();
  });
});

describe("createSong", () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  it("user client 不可用时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    await expect(createSong({ title: "新歌" }, "token")).rejects.toThrow(
      "Supabase client unavailable",
    );
  });

  it("资料交给 create_song 建歌与草稿，链接另存，返回工作版本", async () => {
    const links = makeQueryBuilder({ data: null, error: null });
    const created = { id: 9, title: "新歌", has_draft: true, is_live: false };
    const client = createMockSupabaseClient(
      [links, makeQueryBuilder({ data: created, error: null })],
      { rpc: { create_song: { data: 9, error: null } } },
    );
    vi.mocked(getUserClient).mockReturnValue(client);

    const song = await createSong(
      { title: "新歌", nelink: " https://music.163.com/song?id=1 " },
      "token",
    );

    expect(client.rpc).toHaveBeenCalledWith("create_song", {
      p_fields: { title: "新歌" },
    });
    expect(client.from).toHaveBeenNthCalledWith(1, "song_links");
    expect(links.upsert).toHaveBeenCalledWith(
      { song_id: 9, platform: "netease", url: "https://music.163.com/song?id=1" },
      { onConflict: "song_id,platform" },
    );
    expect(song).toEqual(created);
  });

  it("没有权限时抛 403", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([], {
        rpc: {
          create_song: { data: null, error: { code: "42501", message: "没有权限" } },
        },
      }),
    );
    await expect(createSong({ title: "新歌" }, "token")).rejects.toMatchObject({
      message: "没有权限",
      status: 403,
    });
  });
});

describe("updateSong（草稿与乐观锁）", () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  const working = {
    id: 1,
    title: "旧名",
    nelink: null,
    updated_at: "2024-01-01T00:00:00Z",
  };

  it("歌不存在时抛 404", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: null, error: null })]),
    );
    await expect(updateSong(1, { title: "改名" }, "token")).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it("调用方读到的 updated_at 已过时：409，不开草稿", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: working, error: null }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);
    await expect(
      updateSong(1, { title: "改名", updated_at: "2023-12-31T00:00:00Z" }, "token"),
    ).rejects.toMatchObject({ message: "乐观锁冲突", status: 409 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("资料有改动：开草稿，按 updated_at 写进草稿，返回新的工作版本", async () => {
    const update = makeQueryBuilder({ data: { id: 42 }, error: null });
    const saved = { ...working, title: "改名", has_draft: true };
    const client = createMockSupabaseClient(
      [
        makeQueryBuilder({ data: working, error: null }),
        update,
        makeQueryBuilder({ data: saved, error: null }),
      ],
      { rpc: { ensure_draft: { data: 42, error: null } } },
    );
    vi.mocked(getUserClient).mockReturnValue(client);

    const song = await updateSong(
      1,
      { title: "改名", updated_at: working.updated_at },
      "token",
    );

    expect(client.rpc).toHaveBeenCalledWith("ensure_draft", { p_song_id: 1 });
    expect(client.from).toHaveBeenNthCalledWith(2, "song_versions");
    expect(update.update).toHaveBeenCalledWith({ title: "改名" });
    expect(update.eq).toHaveBeenCalledWith("id", 42);
    expect(update.eq).toHaveBeenCalledWith("updated_at", working.updated_at);
    expect(song).toEqual(saved);
  });

  it("草稿里那一行已被别人改过：409", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(
        [
          makeQueryBuilder({ data: working, error: null }),
          makeQueryBuilder({ data: null, error: null }),
        ],
        { rpc: { ensure_draft: { data: 42, error: null } } },
      ),
    );
    await expect(updateSong(1, { title: "改名" }, "token")).rejects.toMatchObject(
      { message: "乐观锁冲突", status: 409 },
    );
  });

  it("只改了链接：直接改 song_links，不开草稿", async () => {
    const links = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: working, error: null }),
      links,
      makeQueryBuilder({ data: working, error: null }),
    ]);
    vi.mocked(getUserClient).mockReturnValue(client);

    await updateSong(1, { title: "旧名", nelink: "https://n/1" }, "token");

    expect(client.rpc).not.toHaveBeenCalled();
    expect(links.upsert).toHaveBeenCalledWith(
      { song_id: 1, platform: "netease", url: "https://n/1" },
      { onConflict: "song_id,platform" },
    );
  });

  it("清空链接即删除那一行", async () => {
    const links = makeQueryBuilder({ data: null, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: { ...working, qmlink: "https://y/1" }, error: null }),
        links,
        makeQueryBuilder({ data: working, error: null }),
      ]),
    );
    await updateSong(1, { qmlink: "" }, "token");
    expect(links.delete).toHaveBeenCalled();
    expect(links.eq).toHaveBeenCalledWith("platform", "qq");
  });

  it("链接已挂在别的歌上：409，说明是哪个链接", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: working, error: null }),
        makeQueryBuilder({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        }),
      ]),
    );
    await expect(
      updateSong(1, { nelink: "https://n/2" }, "token"),
    ).rejects.toMatchObject({
      message: "这个链接已挂在别的歌上：https://n/2",
      status: 409,
    });
  });
});

describe("getSongsByIds", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
  });

  it("id 列表为空时直接返回，不触碰数据库", async () => {
    const songs = await getSongsByIds([]);
    expect(songs).toEqual([]);
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it("service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getSongsByIds([1, 2])).toEqual([]);
  });

  it("只查传入的 id，不做全表扫描", async () => {
    const builder = makeQueryBuilder({
      data: [
        { id: 2, title: "新歌", date: "2023-01-01" },
        { id: 1, title: "旧歌", date: "2020-01-01" },
      ],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([builder]),
    );

    const songs = await getSongsByIds([1, 2]);

    expect(builder.in).toHaveBeenCalledWith("id", [1, 2]);
    expect(songs.map((s) => s.id)).toEqual([2, 1]); // mapAndSortSongs 按 date 倒序
  });

  it("重复 id 只查询一次", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([builder]),
    );

    await getSongsByIds([7, 7, 7]);

    expect(builder.in).toHaveBeenCalledWith("id", [7]);
  });

  it("超过 200 个 id 时分批查询并合并结果", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    const first = makeQueryBuilder({
      data: [{ id: 1, title: "第一批", date: "2020-01-01" }],
      error: null,
    });
    const second = makeQueryBuilder({
      data: [{ id: 201, title: "第二批", date: "2021-01-01" }],
      error: null,
    });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([first, second]),
    );

    const songs = await getSongsByIds(ids);

    expect(first.in).toHaveBeenCalledWith("id", ids.slice(0, 200));
    expect(second.in).toHaveBeenCalledWith("id", ids.slice(200));
    expect(songs.map((s) => s.id)).toEqual([201, 1]);
  });

  it("查询出错时抛异常", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    await expect(getSongsByIds([1])).rejects.toThrow("Failed to fetch songs");
  });

  it("zh-TW locale 时转换为繁体", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [{ id: 1, title: "中国话", date: "2020-01-01" }],
          error: null,
        }),
      ]),
    );
    const songs = await getSongsByIds([1], "zh-TW");
    expect(songs[0].title).toBe("中國話");
  });
});

describe("getSongLastModifiedMap", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
  });

  it("service client 不可用时返回空 Map", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect((await getSongLastModifiedMap()).size).toBe(0);
  });

  it("把线上版本的 updated_at（发布时间）映射为 id → Date", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            { id: 1, updated_at: "2025-03-01T10:00:00+00:00" },
            { id: 2, updated_at: "2026-01-15T08:30:00+00:00" },
          ],
          error: null,
        }),
      ]),
    );

    const map = await getSongLastModifiedMap();

    expect(map.size).toBe(2);
    expect(map.get(1)?.toISOString()).toBe("2025-03-01T10:00:00.000Z");
    expect(map.get(2)?.toISOString()).toBe("2026-01-15T08:30:00.000Z");
  });

  it("updated_at 为空或非法时跳过该行，不写入无效 Date", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            { id: 1, updated_at: null },
            { id: 2, updated_at: "not-a-date" },
            { id: 3, updated_at: "2025-06-01T00:00:00+00:00" },
          ],
          error: null,
        }),
      ]),
    );

    const map = await getSongLastModifiedMap();

    expect(map.has(1)).toBe(false);
    expect(map.has(2)).toBe(false);
    expect(map.has(3)).toBe(true);
  });
});
