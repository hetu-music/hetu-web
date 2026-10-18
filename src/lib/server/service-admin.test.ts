import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

vi.mock("@/lib/db/supabase-server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/db/supabase-server")>();
  return { ...actual, getServiceClient: vi.fn() };
});

import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { Song } from "@/lib/types";
import {
  getOccurrenceCountsBySong,
  getPendingRequestCount,
  getPublishedSongRaw,
  getPublishStatuses,
} from "./service-admin";

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function withServiceClient(builders: unknown[]) {
  const client = createMockSupabaseClient(builders);
  vi.mocked(getServiceClient).mockReturnValue(client);
  return client;
}

describe("getPublishedSongRaw", () => {
  it("按 id 读正式表的原样行", async () => {
    const row = { id: 7, title: "倾尽天下", lyricist: ["河图"] };
    const builder = makeQueryBuilder({ data: row, error: null });
    const client = withServiceClient([builder]);

    expect(await getPublishedSongRaw(7)).toEqual(row);
    expect(client.from).toHaveBeenCalledWith(TABLES.MUSIC);
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("id", 7);
    expect(builder.maybeSingle).toHaveBeenCalled();
  });

  it("还没发布过时返回 null", async () => {
    withServiceClient([makeQueryBuilder({ data: null, error: null })]);
    expect(await getPublishedSongRaw(7)).toBeNull();
  });

  it("查询出错时记日志并返回 null", async () => {
    withServiceClient([
      makeQueryBuilder({ data: null, error: { message: "boom" } }),
    ]);
    expect(await getPublishedSongRaw(7)).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("客户端不可用时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null as never);
    expect(await getPublishedSongRaw(7)).toBeNull();
  });
});

describe("getPublishStatuses", () => {
  it("逐首对比正式表：未发布 / 有改动 / 已发布", async () => {
    const builder = makeQueryBuilder({
      data: [
        { id: 2, title: "旧标题" },
        { id: 3, title: "同名", album: "" },
      ],
      error: null,
    });
    const client = withServiceClient([builder]);

    const drafts = [
      { id: 1, title: "新歌" },
      { id: 2, title: "新标题" },
      // 空串与 null 视为相同，不算改动
      { id: 3, title: "同名", album: null },
    ] as unknown as Song[];

    expect(await getPublishStatuses(drafts)).toEqual({
      1: "unpublished",
      2: "changed",
      3: "published",
    });
    expect(client.from).toHaveBeenCalledWith(TABLES.MUSIC);
    expect(builder.select).toHaveBeenCalledWith("*");
  });

  it("客户端不可用时返回空对象", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null as never);
    expect(
      await getPublishStatuses([{ id: 1, title: "x" }] as unknown as Song[]),
    ).toEqual({});
  });
});

describe("getOccurrenceCountsBySong", () => {
  it("按歌汇总标注条数", async () => {
    const builder = makeQueryBuilder({
      data: [{ song_id: 1 }, { song_id: 2 }, { song_id: 1 }],
      error: null,
    });
    const client = withServiceClient([builder]);

    expect(await getOccurrenceCountsBySong()).toEqual({ 1: 2, 2: 1 });
    expect(client.from).toHaveBeenCalledWith(TABLES.IMAGERY_OCC);
    expect(builder.select).toHaveBeenCalledWith("song_id");
  });

  it("客户端不可用时返回空对象", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null as never);
    expect(await getOccurrenceCountsBySong()).toEqual({});
  });
});

describe("getPendingRequestCount", () => {
  it("超级管理员统计全部待处理反馈", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: 5, error: null }).then(resolve);
    const client = withServiceClient([builder]);

    expect(await getPendingRequestCount(true)).toBe(5);
    expect(client.from).toHaveBeenCalledWith(TABLES.USER_REQUESTS);
    expect(builder.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(builder.eq.mock.calls).toEqual([["status", "pending"]]);
  });

  it("普通管理员只统计歌曲纠错", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: 2, error: null }).then(resolve);
    withServiceClient([builder]);

    expect(await getPendingRequestCount(false)).toBe(2);
    expect(builder.eq.mock.calls).toEqual([
      ["status", "pending"],
      ["type", "song_feedback"],
    ]);
  });

  it("count 为空时返回 0", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: null, error: null }).then(resolve);
    withServiceClient([builder]);

    expect(await getPendingRequestCount(true)).toBe(0);
  });

  it("查询出错时记日志并返回 0", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: null, error: { message: "boom" } }).then(
        resolve,
      );
    withServiceClient([builder]);

    expect(await getPendingRequestCount(true)).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("客户端不可用时返回 0", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null as never);
    expect(await getPendingRequestCount(true)).toBe(0);
  });
});
