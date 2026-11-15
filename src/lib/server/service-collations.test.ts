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

vi.mock("@/lib/utils/utils-convert", () => ({
  toTraditional: vi.fn((s: string) => `繁:${s}`),
}));

import { getServiceClient, getUserClient } from "@/lib/db/supabase-server";
import { toTraditional } from "@/lib/utils/utils-convert";
import {
  CollationError,
  createCollation,
  deleteCollation,
  getSongCollations,
  lyricRow,
  songRow,
  updateCollation,
} from "./service-collations";

const baseRow = {
  id: 1,
  version_id: 3,
  anchor: "lyrics",
  anchor_index: 3,
  anchor_time: "12.5",
  anchor_quote: "原句",
  kind: "slip",
  date: null,
  quote: "原文",
  sung: "实唱",
  body: "说明",
  created_by: "u1",
  collator: { name: "校者" },
  revisers: [],
};

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
  vi.mocked(toTraditional).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("getSongCollations", () => {
  const version = () =>
    makeQueryBuilder({ data: { version_id: 3 }, error: null });

  it("歌不在线上时返回空数组，不读校记", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({ data: null, error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);
    expect(await getSongCollations(7, "zh-CN")).toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("published_songs");
  });

  it("后台读工作版本", async () => {
    const client = createMockSupabaseClient([
      version(),
      makeQueryBuilder({ data: [], error: null }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);
    await getSongCollations(7, "zh-CN", "working");
    expect(client.from).toHaveBeenNthCalledWith(1, "working_songs");
  });

  it("service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getSongCollations(7, "zh-CN")).toEqual([]);
  });

  it("查询出错时返回空数组而不抛错", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getSongCollations(7, "zh-CN")).toEqual([]);
  });

  it("data 为 null 时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({ data: null, error: null }),
      ]),
    );
    expect(await getSongCollations(7, "zh-CN")).toEqual([]);
  });

  it("按线上版本筛选、按 id 排序，并把行映射成 SongCollation", async () => {
    const builder = makeQueryBuilder({ data: [baseRow], error: null });
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([version(), builder]),
    );
    const [c] = await getSongCollations(7, "zh-CN");
    expect(builder.eq).toHaveBeenCalledWith("version_id", 3);
    expect(builder.order).toHaveBeenCalledWith("id");
    expect(c).toEqual({
      id: 1,
      anchor: "lyrics",
      anchorIndex: 3,
      anchorTime: 12.5,
      anchorQuote: "原句",
      kind: "slip",
      date: null,
      quote: "原文",
      sung: "实唱",
      body: "说明",
      collator: "校者",
      revisers: [],
    });
    expect(toTraditional).not.toHaveBeenCalled();
  });

  it("繁体页把原句、原文、实唱、说明转繁，null 保持 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({
          data: [{ ...baseRow, sung: null, anchor_time: null }],
          error: null,
        }),
      ]),
    );
    const [c] = await getSongCollations(7, "zh-TW");
    expect(c.anchorQuote).toBe("繁:原句");
    expect(c.quote).toBe("繁:原文");
    expect(c.sung).toBeNull();
    expect(c.body).toBe("繁:说明");
    expect(c.anchorTime).toBeNull();
  });

  it("转繁失败（返回 null）时退回原文", async () => {
    vi.mocked(toTraditional).mockReturnValueOnce(null as unknown as string);
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({ data: [baseRow], error: null }),
      ]),
    );
    const [c] = await getSongCollations(7, "zh-TW");
    expect(c.anchorQuote).toBe("原句");
  });

  it("订者按第一次修改的先后排，账号已删的不列；无 created_by 不署校者", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({
          data: [
            {
              ...baseRow,
              id: 1,
              revisers: [
                { created_at: "2026-11-03T00:00:00Z", user: { name: "丙" } },
                { created_at: "2026-11-01T00:00:00Z", user: { name: "乙" } },
                { created_at: "2026-11-02T00:00:00Z", user: null },
              ],
            },
            {
              ...baseRow,
              id: 2,
              created_by: null,
              collator: { name: "不该出现" },
              revisers: null,
            },
          ],
          error: null,
        }),
      ]),
    );
    const list = await getSongCollations(7, "zh-CN");
    expect(list.map((c) => [c.collator, c.revisers])).toEqual([
      ["校者", ["乙", "丙"]],
      [null, []],
    ]);
  });

  it("body 为 null 时给空串", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        version(),
        makeQueryBuilder({ data: [{ ...baseRow, body: null }], error: null }),
      ]),
    );
    const [c] = await getSongCollations(7, "zh-CN");
    expect(c.body).toBe("");
  });
});

describe("lyricRow / songRow", () => {
  it("lyricRow 挂在歌词上，date 为空", () => {
    const input = {
      kind: "slip" as const,
      anchor_index: 0,
      anchor_time: null,
      anchor_quote: "句",
      quote: null,
      sung: null,
      body: "说明",
    };
    expect(lyricRow(input)).toEqual({ anchor: "lyrics", date: null, ...input });
  });

  it("songRow 挂在整首歌上，位置几列都空着", () => {
    const input = { kind: "draft" as const, date: "2010", body: "旧稿" };
    expect(songRow(input)).toEqual({
      anchor: "song",
      anchor_index: null,
      anchor_time: null,
      anchor_quote: null,
      quote: null,
      sung: null,
      ...input,
    });
  });
});

const row = songRow({ kind: "note", date: null, body: "x" });

const draft = { rpc: { ensure_draft: { data: 42, error: null } } };
/** 校记 → 所在的歌：任一版本里有它即可 */
const owner = (songId: number | null) =>
  makeQueryBuilder({
    data: songId === null ? null : { version: { song_id: songId } },
    error: null,
  });

describe("createCollation", () => {
  it("用户客户端不可用时抛错", async () => {
    vi.mocked(getUserClient).mockReturnValue(null);
    await expect(createCollation(7, row, "tok")).rejects.toThrow(
      "Supabase client unavailable",
    );
  });

  it("开草稿，用会话 token 写在草稿上并返回新 id", async () => {
    const builder = makeQueryBuilder({ data: { id: 42 }, error: null });
    const client = createMockSupabaseClient([builder], draft);
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await createCollation(7, row, "tok")).toBe(42);
    expect(getUserClient).toHaveBeenCalledWith("tok");
    expect(client.rpc).toHaveBeenCalledWith("ensure_draft", { p_song_id: 7 });
    expect(builder.insert).toHaveBeenCalledWith({ version_id: 42, ...row });
  });

  it("歌不存在（开不了草稿）转成 404 的 CollationError", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([], {
        rpc: {
          ensure_draft: {
            data: null,
            error: { code: "P0002", message: "歌曲不存在" },
          },
        },
      }),
    );
    const err = await createCollation(7, row, "tok").catch((e) => e);
    expect(err).toBeInstanceOf(CollationError);
    expect(err.status).toBe(404);
  });

  it("外键失败（草稿在两次请求之间没了）也是 404", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(
        [makeQueryBuilder({ data: null, error: { code: "23503" } })],
        draft,
      ),
    );
    const err = await createCollation(7, row, "tok").catch((e) => e);
    expect(err).toBeInstanceOf(CollationError);
    expect(err.status).toBe(404);
  });

  it("其它数据库错误原样抛出", async () => {
    const dbError = { code: "42501", message: "rls" };
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(
        [makeQueryBuilder({ data: null, error: dbError })],
        draft,
      ),
    );
    await expect(createCollation(7, row, "tok")).rejects.toBe(dbError);
  });
});

describe("updateCollation", () => {
  it("找到所在的歌、开草稿，只改草稿里同一种 anchor 的那一条", async () => {
    const builder = makeQueryBuilder({ data: { id: 5 }, error: null });
    const client = createMockSupabaseClient([owner(7), builder], draft);
    vi.mocked(getUserClient).mockReturnValue(client);
    expect(await updateCollation(5, row, "tok")).toBe(7);
    expect(client.rpc).toHaveBeenCalledWith("ensure_draft", { p_song_id: 7 });
    expect(builder.update).toHaveBeenCalledWith(row);
    expect(builder.eq).toHaveBeenCalledWith("version_id", 42);
    expect(builder.eq).toHaveBeenCalledWith("id", 5);
    expect(builder.eq).toHaveBeenCalledWith("anchor", "song");
  });

  it("哪个版本里都没有时抛 404，不开草稿", async () => {
    const client = createMockSupabaseClient([owner(null)], draft);
    vi.mocked(getUserClient).mockReturnValue(client);
    const err = await updateCollation(5, row, "tok").catch((e) => e);
    expect(err).toBeInstanceOf(CollationError);
    expect(err.status).toBe(404);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("草稿里已删掉时抛 404", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(
        [owner(7), makeQueryBuilder({ data: null, error: null })],
        draft,
      ),
    );
    const err = await updateCollation(5, row, "tok").catch((e) => e);
    expect(err).toBeInstanceOf(CollationError);
    expect(err.status).toBe(404);
  });

  it("数据库错误原样抛出", async () => {
    const dbError = { message: "boom" };
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient(
        [owner(7), makeQueryBuilder({ data: null, error: dbError })],
        draft,
      ),
    );
    await expect(updateCollation(5, row, "tok")).rejects.toBe(dbError);
  });
});

describe("deleteCollation", () => {
  it("删在草稿上并返回所在的歌", async () => {
    const builder = makeQueryBuilder({ data: { id: 5 }, error: null });
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([owner(9), builder], draft),
    );
    expect(await deleteCollation(5, "tok")).toBe(9);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("version_id", 42);
    expect(builder.eq).toHaveBeenCalledWith("id", 5);
  });

  it("找不到时抛 404", async () => {
    vi.mocked(getUserClient).mockReturnValue(
      createMockSupabaseClient([owner(null)], draft),
    );
    const err = await deleteCollation(5, "tok").catch((e) => e);
    expect(err).toBeInstanceOf(CollationError);
    expect(err.status).toBe(404);
  });
});
