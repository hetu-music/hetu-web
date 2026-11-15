import { describe, expect, it } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";
import {
  applySyncPlan,
  loadSyncState,
  MappingConflictError,
  setSongMapping,
} from "./store";
import type { DbSong, SyncPlan } from "./sync";

const song = (id: number): DbSong => ({
  id,
  title: `歌${id}`,
  album: null,
  discnumber: 1,
  track: 1,
  length: 200,
  has_audio: false,
});

function emptyPlan(over: Partial<SyncPlan> = {}): SyncPlan {
  return {
    upserts: [],
    deletes: [],
    unchanged: 0,
    mediaUpdates: [],
    suspicious: [],
    review: [],
    missing: [],
    hasAudioChanges: [],
    unusedNav: [],
    ...over,
  };
}

describe("loadSyncState", () => {
  it("读取线上的歌和映射；映射的 song_id 读出来叫 id", async () => {
    const songs = makeQueryBuilder({ data: [song(1)], error: null });
    const mappings = makeQueryBuilder({
      data: [{ id: 1, navid_id: "a" }],
      error: null,
    });
    const client = createMockSupabaseClient([songs, mappings]);
    expect(await loadSyncState(client)).toEqual({
      songs: [song(1)],
      mappings: [{ id: 1, navid_id: "a" }],
    });
    expect(client.from).toHaveBeenNthCalledWith(1, "published_songs");
    expect(client.from).toHaveBeenNthCalledWith(2, "song_audio");
    expect(mappings.select).toHaveBeenCalledWith(
      "id:song_id,navid_id,suffix,duration",
    );
    expect(mappings.order).toHaveBeenCalledWith("song_id");
  });

  it("任何一页读取失败都直接抛错，不返回残缺数据", async () => {
    const dbError = new Error("timeout");
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: null, error: dbError }),
    ]);
    await expect(loadSyncState(client)).rejects.toBe(dbError);
  });
});

describe("applySyncPlan", () => {
  it("写入映射、删除失效映射；has_audio 由视图算出，不另写", async () => {
    const upsert = makeQueryBuilder({ data: null, error: null });
    const del = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([upsert, del]);

    const result = await applySyncPlan(
      client,
      emptyPlan({
        upserts: [
          {
            song: song(1),
            nav: { id: "a", title: "歌1", suffix: "mp3", duration: 226 },
            previous: null,
            loose: false,
          },
        ],
        deletes: [{ id: 2, navid_id: "gone" }],
        hasAudioChanges: [
          { song: song(1), next: true },
          { song: song(2), next: false },
        ],
      }),
    );

    expect(upsert.upsert).toHaveBeenCalledWith(
      [{ song_id: 1, navid_id: "a", suffix: "mp3", duration: 226 }],
      { onConflict: "song_id" },
    );
    expect(del.in).toHaveBeenCalledWith("song_id", [2]);
    expect(client.from).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      upserted: 1,
      deleted: 1,
      mediaUpdated: 0,
      hasAudioChanged: [1, 2],
    });
  });

  it("只更新保留映射的格式、时长", async () => {
    const upsert = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([upsert]);
    const rows = [{ id: 3, navid_id: "c", suffix: "flac", duration: 309 }];

    const result = await applySyncPlan(
      client,
      emptyPlan({ mediaUpdates: rows }),
    );

    expect(upsert.upsert).toHaveBeenCalledWith(
      [{ song_id: 3, navid_id: "c", suffix: "flac", duration: 309 }],
      { onConflict: "song_id" },
    );
    expect(result.mediaUpdated).toBe(1);
  });

  it("空计划不访问数据库", async () => {
    const client = createMockSupabaseClient([]);
    await applySyncPlan(client, emptyPlan());
    expect(client.from).not.toHaveBeenCalled();
  });

  it("写入失败时抛错", async () => {
    const dbError = new Error("denied");
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: null, error: dbError }),
    ]);
    await expect(
      applySyncPlan(client, emptyPlan({ deletes: [{ id: 1, navid_id: "x" }] })),
    ).rejects.toBe(dbError);
  });
});

describe("setSongMapping", () => {
  it("关联曲目：写入映射与格式、时长", async () => {
    const owner = makeQueryBuilder({ data: null, error: null });
    const upsert = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([owner, upsert]);

    await setSongMapping(client, 1, {
      id: "a",
      title: "歌1",
      suffix: "mp3",
      duration: 226,
    });

    expect(owner.eq).toHaveBeenCalledWith("navid_id", "a");
    expect(owner.neq).toHaveBeenCalledWith("song_id", 1);
    expect(upsert.upsert).toHaveBeenCalledWith(
      { song_id: 1, navid_id: "a", suffix: "mp3", duration: 226 },
      { onConflict: "song_id" },
    );
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it("曲目已被其他歌曲关联时抛 MappingConflictError，不写入", async () => {
    const upsert = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: { song_id: 9 }, error: null }),
      upsert,
    ]);
    await expect(
      setSongMapping(client, 1, { id: "a", title: "歌1" }),
    ).rejects.toMatchObject({
      name: "MappingConflictError",
      songId: 9,
    });
    expect(upsert.upsert).not.toHaveBeenCalled();
    expect(new MappingConflictError(9).message).toContain("#9");
  });

  it("解除关联时删除映射", async () => {
    const del = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([del]);

    await setSongMapping(client, 1, null);

    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("song_id", 1);
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
