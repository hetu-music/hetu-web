import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAll, TABLES } from "./supabase-server";

const PAGE_SIZE = 1000;

/**
 * 构造一个按 range() 调用次序依次返回预设结果的假客户端。
 * fetchAll 依赖「查到的行数 < 每页上限」来判断是否已取完，
 * 因此这里要如实记录每次请求的 range 区间。
 */
function makePagedClient(pages: { data: unknown[] | null; error?: unknown }[]) {
  const ranges: [number, number][] = [];
  let call = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    from: vi.fn(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {
        select: vi.fn(() => builder),
        order: vi.fn(() => builder),
        not: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        range: vi.fn((from: number, to: number) => {
          ranges.push([from, to]);
          return builder;
        }),
        then: (resolve: (v: unknown) => unknown) => {
          const page = pages[Math.min(call, pages.length - 1)];
          call += 1;
          return Promise.resolve({
            data: page.data,
            error: page.error ?? null,
          }).then(resolve);
        },
      };
      return builder;
    }),
  };
  return { client, ranges, callCount: () => call };
}

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("fetchAll — 分页", () => {
  it("单页取完（不足一页）时只请求一次", async () => {
    const { client, callCount } = makePagedClient([{ data: rows(42) }]);
    const result = await fetchAll(client, TABLES.MUSIC, "id");

    expect(result).toHaveLength(42);
    expect(callCount()).toBe(1);
  });

  // 这是 PostgREST 单次最多 1000 行导致「静默截断」的防线
  it("满一页时继续翻页，直到取回不足一页为止", async () => {
    const { client, ranges, callCount } = makePagedClient([
      { data: rows(PAGE_SIZE) },
      { data: rows(PAGE_SIZE) },
      { data: rows(137) },
    ]);

    const result = await fetchAll(client, TABLES.MUSIC, "id");

    expect(result).toHaveLength(PAGE_SIZE * 2 + 137);
    expect(callCount()).toBe(3);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("正好整页后返回空页时停止", async () => {
    const { client, callCount } = makePagedClient([
      { data: rows(PAGE_SIZE) },
      { data: [] },
    ]);

    const result = await fetchAll(client, TABLES.MUSIC, "id");

    expect(result).toHaveLength(PAGE_SIZE);
    expect(callCount()).toBe(2);
  });

  it("首页即为空时返回空数组", async () => {
    const { client } = makePagedClient([{ data: [] }]);
    expect(await fetchAll(client, TABLES.MUSIC, "id")).toEqual([]);
  });

  it("data 为 null 时返回空数组而非抛异常", async () => {
    const { client } = makePagedClient([{ data: null }]);
    expect(await fetchAll(client, TABLES.MUSIC, "id")).toEqual([]);
  });
});

describe("fetchAll — 错误处理", () => {
  it("查询出错时记录日志并返回已取到的部分", async () => {
    const { client } = makePagedClient([
      { data: rows(PAGE_SIZE) },
      { data: null, error: { message: "boom" } },
    ]);

    const result = await fetchAll(client, TABLES.MUSIC, "id");

    // 已知限制：出错时返回部分结果而非抛出，调用方无法区分「取完了」和「中断了」
    expect(result).toHaveLength(PAGE_SIZE);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("首页即出错时返回空数组", async () => {
    const { client } = makePagedClient([
      { data: null, error: { message: "boom" } },
    ]);
    expect(await fetchAll(client, TABLES.MUSIC, "id")).toEqual([]);
  });
});

describe("fetchAll — 额外过滤条件", () => {
  it("extraFilter 会作用在每一页的查询上", async () => {
    const { client } = makePagedClient([
      { data: rows(PAGE_SIZE) },
      { data: rows(10) },
    ]);
    const extraFilter = vi.fn((q) => q.order("id", { ascending: true }));

    await fetchAll(client, TABLES.MUSIC, "id", extraFilter);

    expect(extraFilter).toHaveBeenCalledTimes(2);
  });
});

describe("TABLES 常量", () => {
  it("表名集中定义，避免业务代码里散落字面量", () => {
    expect(TABLES.MUSIC).toBe("music");
    expect(TABLES.ADMIN).toBe("temp");
    expect(TABLES.IMAGERY_OCC).toBe("imagery_occurrences");
  });
});
