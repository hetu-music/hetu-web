import { vi } from "vitest";

export type MockResult<T = unknown> = { data: T; error: unknown };

/**
 * 创建一个可链式调用的假 Supabase 查询构建器。
 *
 * 所有链式方法（select/insert/update/delete/eq/order/range/limit/...）都返回自身，
 * 既可以链式调用到 .single()/.maybeSingle() 取结果，也可以直接 `await` 构建器本身
 * （Supabase 的真实查询构建器是 PromiseLike 的，`fetchAll` 等工具函数依赖这一点）。
 *
 * 最终都 resolve 为传入的 result，不做真实的过滤/排序模拟——
 * 测试里想验证"传了什么参数"，用 builder.eq / builder.insert 等 vi.fn() 的
 * mock.calls 断言即可。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeQueryBuilder<T = unknown>(result: MockResult<T>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: MockResult<T>) => unknown,
      reject?: (reason?: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

/**
 * 按表名分派的假 SupabaseClient：`.from(table)` 取 routes[table] 里的下一个 builder，
 * 用完后重复返回最后一个；没给的表返回 `{ data: [], error: null }`。
 *
 * 一次写入要经过好几张表时用它：只按各表自己的调用顺序给结果，
 * 被测函数在别的表上多查一次、少查一次都不会把后面的结果错位。
 */
export function createTableMockClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routes: Record<string, any | any[]>,
  { rpc = {} }: { rpc?: Record<string, MockResult> } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const used = new Map<string, number>();
  const from = vi.fn((table: string) => {
    const entry = routes[table];
    if (entry === undefined) return makeQueryBuilder({ data: [], error: null });
    const list = Array.isArray(entry) ? entry : [entry];
    const index = used.get(table) ?? 0;
    used.set(table, index + 1);
    return list[Math.min(index, list.length - 1)];
  });
  return {
    from,
    rpc: vi.fn((name: string) =>
      Promise.resolve(rpc[name] ?? { data: null, error: null }),
    ),
  };
}

/**
 * 创建一个假 SupabaseClient：`.from(table)` 按调用顺序依次返回传入的 builder 列表，
 * 队列耗尽后重复返回最后一个 builder（避免函数里多调用一次 .from() 就直接报错）。
 *
 * 用法：被测函数里按顺序调用了几次 `.from()`，就按同样顺序传入几个
 * `makeQueryBuilder({data, error})`。
 *
 * `.rpc(name)` 按函数名取 rpc 里给的结果，没给的返回 `{ data: null, error: null }`
 *（如开草稿：`{ rpc: { ensure_draft: { data: 7, error: null } } }`）。
 */
export function createMockSupabaseClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builders: any[],
  { rpc = {} }: { rpc?: Record<string, MockResult> } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let index = 0;
  const from = vi.fn(() => {
    const builder = builders[Math.min(index, builders.length - 1)];
    index += 1;
    return builder;
  });
  return {
    from,
    rpc: vi.fn((name: string) =>
      Promise.resolve(rpc[name] ?? { data: null, error: null }),
    ),
  };
}
