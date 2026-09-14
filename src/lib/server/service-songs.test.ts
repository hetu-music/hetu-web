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
    const songs = await getSongs("music", undefined, false, "zh-TW");
    expect(songs[0].title).toBe("中國話");
  });

  it("Admin 路径（带 accessToken）：user client 不可用返回空数组", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    const songs = await getSongs("temp", "token123");
    expect(songs).toEqual([]);
  });

  it("Admin 路径查询出错时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "db error" } }),
      ]),
    );
    await expect(getSongs("temp", "token123")).rejects.toThrow(
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

  it("歌词解析失败时降级为提示文案，不影响其他字段返回", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { id: 1, title: "标题", lyrics: "[bad" },
          error: null,
        }),
      ]),
    );
    // processLyrics 对畸形输入本身是容错的（不会真的抛异常），
    // 这里主要验证 normalLyrics 字段被正确填充、函数本身不会中断。
    const song = await getSongById(1);
    expect(song).not.toBeNull();
    expect(typeof song?.normalLyrics).toBe("string");
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
    const song = await getSongById(1, "music", undefined, "zh-TW");
    expect(song?.title).toBe("中國話");
    expect(song?.album).toBe("簡體專輯");
    expect(song?.artist).toEqual(["中國歌手"]);
  });
});

describe("createSong", () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  it("user client 不可用时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    await expect(createSong({ title: "新歌" })).rejects.toThrow(
      "User client unavailable",
    );
  });

  it("插入成功返回创建的歌曲", async () => {
    const created = { id: 1, title: "新歌" };
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: created, error: null }),
      ]),
    );
    const song = await createSong({ title: "新歌" });
    expect(song).toEqual(created);
  });

  it("插入出错时抛异常", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "insert failed" } }),
      ]),
    );
    await expect(createSong({ title: "新歌" })).rejects.toThrow(
      "Failed to create song",
    );
  });
});

describe("updateSong（乐观锁）", () => {
  beforeEach(() => {
    vi.mocked(getUserClient).mockReset();
  });

  it("PGRST116（0 行匹配）时判定为乐观锁冲突，抛 409", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: null,
          error: { code: "PGRST116", message: "Results contain 0 rows" },
        }),
      ]),
    );
    await expect(
      updateSong(1, { title: "改名", updated_at: "2024-01-01T00:00:00Z" }),
    ).rejects.toMatchObject({ message: "乐观锁冲突", status: 409 });
  });

  it("其他数据库错误时抛通用错误，不误判为乐观锁冲突", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: null,
          error: { code: "23505", message: "duplicate key" },
        }),
      ]),
    );
    await expect(updateSong(1, { title: "改名" })).rejects.toThrow(
      "Failed to update song",
    );
  });

  it("更新成功返回最新数据", async () => {
    const updated = { id: 1, title: "改名" };
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: updated, error: null }),
      ]),
    );
    const song = await updateSong(1, { title: "改名" });
    expect(song).toEqual(updated);
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

  it("把 temp 的 updated_at 映射为 id → Date", async () => {
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
