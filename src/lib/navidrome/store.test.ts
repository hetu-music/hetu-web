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
    suspicious: [],
    review: [],
    missing: [],
    hasAudioChanges: [],
    unusedNav: [],
    ...over,
  };
}

describe("loadSyncState", () => {
  it("读取歌曲和映射", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: [song(1)], error: null }),
      makeQueryBuilder({ data: [{ id: 1, navid_id: "a" }], error: null }),
    ]);
    expect(await loadSyncState(client)).toEqual({
      songs: [song(1)],
      mappings: [{ id: 1, navid_id: "a" }],
    });
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
  it("写入映射、删除失效映射并更新 has_audio", async () => {
    const upsert = makeQueryBuilder({ data: null, error: null });
    const del = makeQueryBuilder({ data: null, error: null });
    const setTrue = makeQueryBuilder({ data: null, error: null });
    const setFalse = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([upsert, del, setTrue, setFalse]);

    const result = await applySyncPlan(
      client,
      emptyPlan({
        upserts: [
          {
            song: song(1),
            nav: { id: "a", title: "歌1" },
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

    expect(upsert.upsert).toHaveBeenCalledWith([{ id: 1, navid_id: "a" }], {
      onConflict: "id",
    });
    expect(del.in).toHaveBeenCalledWith("id", [2]);
    expect(setTrue.update).toHaveBeenCalledWith({ has_audio: true });
    expect(setTrue.in).toHaveBeenCalledWith("id", [1]);
    expect(setFalse.update).toHaveBeenCalledWith({ has_audio: false });
    expect(result).toEqual({
      upserted: 1,
      deleted: 1,
      hasAudioChanged: [1, 2],
    });
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
  it("关联曲目并置 has_audio 为 true", async () => {
    const owner = makeQueryBuilder({ data: null, error: null });
    const upsert = makeQueryBuilder({ data: null, error: null });
    const update = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([owner, upsert, update]);

    await setSongMapping(client, 1, "a");

    expect(owner.eq).toHaveBeenCalledWith("navid_id", "a");
    expect(owner.neq).toHaveBeenCalledWith("id", 1);
    expect(upsert.upsert).toHaveBeenCalledWith(
      { id: 1, navid_id: "a" },
      { onConflict: "id" },
    );
    expect(update.update).toHaveBeenCalledWith({ has_audio: true });
  });

  it("曲目已被其他歌曲关联时抛 MappingConflictError，不写入", async () => {
    const upsert = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: { id: 9 }, error: null }),
      upsert,
    ]);
    await expect(setSongMapping(client, 1, "a")).rejects.toMatchObject({
      name: "MappingConflictError",
      songId: 9,
    });
    expect(upsert.upsert).not.toHaveBeenCalled();
    expect(new MappingConflictError(9).message).toContain("#9");
  });

  it("解除关联时删除映射并置 has_audio 为 false", async () => {
    const del = makeQueryBuilder({ data: null, error: null });
    const update = makeQueryBuilder({ data: null, error: null });
    const client = createMockSupabaseClient([del, update]);

    await setSongMapping(client, 1, null);

    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("id", 1);
    expect(update.update).toHaveBeenCalledWith({ has_audio: false });
  });
});
