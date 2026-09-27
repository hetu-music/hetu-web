import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSupabaseClient,
  makeQueryBuilder,
} from "@/test/mockSupabase";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/server/server-utils", () => ({
  purgeCloudflareCache: vi.fn(async () => undefined),
  purgeEdgeOneCache: vi.fn(async () => undefined),
  serverErrorResponse: vi.fn(
    (_scope: string, _error: unknown, message = "服务器错误", status = 500) =>
      Response.json({ error: message }, { status }),
  ),
}));

vi.mock("@/lib/db/supabase-server", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@/lib/navidrome/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/navidrome/client")>();
  return {
    ...actual,
    navidromeConfigFromEnv: vi.fn(),
    fetchNavidromeLibrary: vi.fn(),
    fetchNavidromeSong: vi.fn(),
  };
});

vi.mock("@/lib/navidrome/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/navidrome/store")>();
  return {
    ...actual,
    loadSyncState: vi.fn(),
    applySyncPlan: vi.fn(),
    setSongMapping: vi.fn(),
  };
});

import { revalidatePath, revalidateTag } from "next/cache";
import { getServiceClient } from "@/lib/db/supabase-server";
import {
  fetchNavidromeLibrary,
  fetchNavidromeSong,
  navidromeConfigFromEnv,
  NavidromeError,
} from "@/lib/navidrome/client";
import {
  applySyncPlan,
  loadSyncState,
  MappingConflictError,
  setSongMapping,
} from "@/lib/navidrome/store";
import type { DbSong, NavSong } from "@/lib/navidrome/sync";
import {
  purgeCloudflareCache,
  purgeEdgeOneCache,
} from "@/lib/server/server-utils";
import {
  AudioNotFoundError,
  AudioServiceUnavailableError,
  audioErrorResponse,
  getAudioOverview,
  runAudioSync,
  updateAudioMapping,
} from "./service-navidrome";

const config = { url: "https://nav.example.com", user: "u", password: "p" };
const song: DbSong = {
  id: 1,
  title: "回家",
  album: "回家",
  discnumber: 1,
  track: 1,
  length: 266,
  has_audio: false,
};
const track: NavSong = {
  id: "t1",
  title: "回家",
  album: "河图单曲2008 & 之前",
  duration: 265,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServiceClient).mockReturnValue(createMockSupabaseClient([]));
  vi.mocked(navidromeConfigFromEnv).mockReturnValue(config);
  vi.mocked(fetchNavidromeLibrary).mockResolvedValue([track]);
  vi.mocked(loadSyncState).mockResolvedValue({ songs: [song], mappings: [] });
});

describe("getAudioOverview", () => {
  it("返回曲库、歌曲、映射和同步计划", async () => {
    const overview = await getAudioOverview();
    expect(overview.library).toEqual([track]);
    expect(overview.plan.upserts.map((u) => u.nav.id)).toEqual(["t1"]);
    expect(overview.plan.hasAudioChanges).toEqual([{ song, next: true }]);
  });

  it("缺少 Navidrome 配置时抛出服务不可用", async () => {
    vi.mocked(navidromeConfigFromEnv).mockReturnValue(null);
    await expect(getAudioOverview()).rejects.toBeInstanceOf(
      AudioServiceUnavailableError,
    );
  });

  it("数据库客户端不可用时抛出服务不可用", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    await expect(getAudioOverview()).rejects.toBeInstanceOf(
      AudioServiceUnavailableError,
    );
  });

  it("曲库为空时中止，避免把所有映射判为失效", async () => {
    vi.mocked(fetchNavidromeLibrary).mockResolvedValue([]);
    await expect(getAudioOverview()).rejects.toThrow("曲目为空");
  });
});

describe("runAudioSync", () => {
  it("按服务端重新计算的计划执行，并刷新 has_audio 变化的页面", async () => {
    vi.mocked(applySyncPlan).mockResolvedValue({
      upserted: 1,
      deleted: 0,
      hasAudioChanged: [1],
    });
    const result = await runAudioSync();
    expect(result.upserted).toBe(1);
    const plan = vi.mocked(applySyncPlan).mock.calls[0][1];
    expect(plan.upserts.map((u) => u.song.id)).toEqual([1]);
    expect(revalidatePath).toHaveBeenCalledWith("/zh-CN/song/1");
    expect(revalidateTag).toHaveBeenCalledWith("quiz-pool", { expire: 0 });
    expect(purgeCloudflareCache).toHaveBeenCalledWith(
      expect.arrayContaining(["/", "/song/1"]),
    );
  });

  it("CDN 清缓存按每批 30 条拆分", async () => {
    vi.mocked(applySyncPlan).mockResolvedValue({
      upserted: 0,
      deleted: 0,
      hasAudioChanged: Array.from({ length: 20 }, (_, i) => i + 1),
    });
    await runAudioSync();
    const calls = vi.mocked(purgeEdgeOneCache).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every(([paths]) => paths.length <= 30)).toBe(true);
  });

  it("has_audio 没有变化时不刷新缓存", async () => {
    vi.mocked(applySyncPlan).mockResolvedValue({
      upserted: 3,
      deleted: 0,
      hasAudioChanged: [],
    });
    await runAudioSync();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(purgeCloudflareCache).not.toHaveBeenCalled();
  });
});

describe("updateAudioMapping", () => {
  function withSongRow(row: unknown, error: unknown = null) {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([makeQueryBuilder({ data: row, error })]),
    );
  }

  it("关联存在的曲目，has_audio 变化时刷新页面", async () => {
    withSongRow({ id: 1, has_audio: false });
    vi.mocked(fetchNavidromeSong).mockResolvedValue(track);
    const result = await updateAudioMapping(1, "t1");
    expect(result.nav).toEqual(track);
    expect(setSongMapping).toHaveBeenCalledWith(expect.anything(), 1, "t1");
    expect(revalidatePath).toHaveBeenCalledWith("/zh-CN/song/1");
  });

  it("更换曲目但 has_audio 不变时不刷新页面", async () => {
    withSongRow({ id: 1, has_audio: true });
    vi.mocked(fetchNavidromeSong).mockResolvedValue(track);
    await updateAudioMapping(1, "t1");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("解除关联不查询 Navidrome", async () => {
    withSongRow({ id: 1, has_audio: true });
    const result = await updateAudioMapping(1, null);
    expect(result.nav).toBeNull();
    expect(fetchNavidromeSong).not.toHaveBeenCalled();
    expect(setSongMapping).toHaveBeenCalledWith(expect.anything(), 1, null);
  });

  it("歌曲不存在时抛出 AudioNotFoundError", async () => {
    withSongRow(null);
    await expect(updateAudioMapping(1, "t1")).rejects.toBeInstanceOf(
      AudioNotFoundError,
    );
  });

  it("曲目不存在时抛出 AudioNotFoundError，不写入", async () => {
    withSongRow({ id: 1, has_audio: false });
    vi.mocked(fetchNavidromeSong).mockResolvedValue(null);
    await expect(updateAudioMapping(1, "gone")).rejects.toBeInstanceOf(
      AudioNotFoundError,
    );
    expect(setSongMapping).not.toHaveBeenCalled();
  });

  it("查询歌曲出错时抛出原错误", async () => {
    const dbError = new Error("db down");
    withSongRow(null, dbError);
    await expect(updateAudioMapping(1, "t1")).rejects.toBe(dbError);
  });
});

describe("audioErrorResponse", () => {
  it.each([
    [new AudioServiceUnavailableError("x"), 503],
    [new AudioNotFoundError("x"), 404],
    [new MappingConflictError(2), 409],
    [
      new NavidromeError("Navidrome 返回错误：Wrong username or password", 40),
      502,
    ],
    [new Error("boom"), 500],
  ])("%s → %i", async (error, status) => {
    const res = audioErrorResponse("test", error);
    expect(res.status).toBe(status);
  });

  it("Navidrome 错误把原因透出给超级管理员", async () => {
    const res = audioErrorResponse(
      "test",
      new NavidromeError("Navidrome 返回错误：Wrong username or password", 40),
    );
    expect((await res.json()).error).toContain("Wrong username or password");
  });
});
