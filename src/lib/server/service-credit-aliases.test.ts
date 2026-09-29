import { beforeEach, describe, expect, it, vi } from "vitest";
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

import {
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import {
  createCreditAlias,
  deleteCreditAlias,
  getPublishedSongIdsCreditedAs,
  listCreditAliases,
  listCreditNames,
} from "./service-credit-aliases";

beforeEach(() => {
  vi.mocked(getServiceClient).mockReset();
  vi.mocked(getUserClient).mockReset();
});

function withUserClient(builders: unknown[]) {
  const client = createMockSupabaseClient(builders);
  vi.mocked(getUserClient).mockReturnValue(client);
  return client;
}

describe("listCreditAliases", () => {
  it("用用户会话读，按主名、别名排序", async () => {
    const rows = [{ alias: "HITA", name: "河图", created_at: "2026-09-29" }];
    const builder = makeQueryBuilder({ data: rows, error: null });
    const client = withUserClient([builder]);

    expect(await listCreditAliases("token")).toEqual(rows);
    expect(getUserClient).toHaveBeenCalledWith("token");
    expect(client.from).toHaveBeenCalledWith(TABLES.CREDIT_ALIASES);
    expect(builder.order.mock.calls).toEqual([["name"], ["alias"]]);
  });

  it("读取出错时抛出", async () => {
    const error = { code: "42501", message: "denied" };
    withUserClient([makeQueryBuilder({ data: null, error })]);
    await expect(listCreditAliases("token")).rejects.toBe(error);
  });

  it("客户端不可用时抛出", async () => {
    vi.mocked(getUserClient).mockReturnValue(null as never);
    await expect(listCreditAliases("token")).rejects.toThrow(
      "Supabase client unavailable",
    );
  });
});

describe("listCreditNames", () => {
  it("读暂存表，汇总各名字的歌数与角色", async () => {
    const builder = makeQueryBuilder({
      data: [
        { id: 1, lyricist: ["甲"], composer: ["乙"] },
        { id: 2, lyricist: ["甲"], arranger: ["甲"] },
      ],
      error: null,
    });
    const client = withUserClient([builder]);

    const names = await listCreditNames("token");
    expect(client.from).toHaveBeenCalledWith(TABLES.ADMIN);
    expect(builder.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(names).toEqual(
      expect.arrayContaining([
        { name: "甲", songs: 2, roles: ["lyricist", "arranger"] },
        { name: "乙", songs: 1, roles: ["composer"] },
      ]),
    );
  });
});

describe("createCreditAlias", () => {
  it("写入并返回新行", async () => {
    const row = { alias: "HITA", name: "河图", created_at: "2026-09-29" };
    const builder = makeQueryBuilder({ data: row, error: null });
    withUserClient([builder]);

    expect(await createCreditAlias("HITA", "河图", "token")).toEqual(row);
    expect(builder.insert).toHaveBeenCalledWith({
      alias: "HITA",
      name: "河图",
    });
  });

  it.each([
    ["23505", "ALIAS_EXISTS", "「HITA」已登记过别名"],
    ["23514", "INVALID_ALIAS", "别名不能与主名相同"],
    ["P0001", "INVALID_ALIAS", "不能多层归并"],
  ])("数据库拒绝（%s）时给出 %s", async (dbCode, code, message) => {
    withUserClient([
      makeQueryBuilder({
        data: null,
        error: { code: dbCode, message: "不能多层归并" },
      }),
    ]);
    await expect(
      createCreditAlias("HITA", "河图", "token"),
    ).rejects.toMatchObject({ code, message });
  });

  it("其他错误原样抛出", async () => {
    const error = { code: "08006", message: "connection failure" };
    withUserClient([makeQueryBuilder({ data: null, error })]);
    await expect(createCreditAlias("HITA", "河图", "token")).rejects.toBe(
      error,
    );
  });
});

describe("deleteCreditAlias", () => {
  it("删掉一行时返回 true", async () => {
    const builder = makeQueryBuilder({
      data: [{ alias: "HITA" }],
      error: null,
    });
    withUserClient([builder]);

    expect(await deleteCreditAlias("HITA", "token")).toBe(true);
    expect(builder.eq).toHaveBeenCalledWith("alias", "HITA");
  });

  it("没有这一行时返回 false", async () => {
    withUserClient([makeQueryBuilder({ data: null, error: null })]);
    expect(await deleteCreditAlias("HITA", "token")).toBe(false);
  });

  it("出错时抛出", async () => {
    const error = { code: "42501", message: "denied" };
    withUserClient([makeQueryBuilder({ data: null, error })]);
    await expect(deleteCreditAlias("HITA", "token")).rejects.toBe(error);
  });
});

describe("getPublishedSongIdsCreditedAs", () => {
  it("找出任一署名字段里有这个名字的已发布歌曲", async () => {
    const client = createMockSupabaseClient([
      makeQueryBuilder({
        data: [
          { id: 1, lyricist: ["河图"], composer: null },
          { id: 2, lyricist: ["甲"], composer: ["乙"] },
          { id: 3, lyricist: null, albumartist: ["河图"] },
        ],
        error: null,
      }),
    ]);
    vi.mocked(getServiceClient).mockReturnValue(client);

    expect(await getPublishedSongIdsCreditedAs("河图")).toEqual([1, 3]);
    expect(client.from).toHaveBeenCalledWith(TABLES.MUSIC);
  });

  it("客户端不可用时返回空", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getPublishedSongIdsCreditedAs("河图")).toEqual([]);
  });
});
