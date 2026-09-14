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
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    not: vi.fn(() => builder),
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
 * 创建一个假 SupabaseClient：`.from(table)` 按调用顺序依次返回传入的 builder 列表，
 * 队列耗尽后重复返回最后一个 builder（避免函数里多调用一次 .from() 就直接报错）。
 *
 * 用法：被测函数里按顺序调用了几次 `.from()`，就按同样顺序传入几个
 * `makeQueryBuilder({data, error})`。
 */
export function createMockSupabaseClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builders: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let index = 0;
  const from = vi.fn(() => {
    const builder = builders[Math.min(index, builders.length - 1)];
    index += 1;
    return builder;
  });
  return { from };
}
