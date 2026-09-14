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
  };
});

import { getServiceClient } from "@/lib/db/supabase-server";
import { getQjtxTimeline, getStoryLastModified } from "./service-story";

// getQjtxTimeline 用 React cache() 包装（同一请求内多次调用只查一次数据库）。
// React 的 cache() 依赖请求作用域（AsyncLocalStorage），在测试里每次 import
// 都是全新模块实例，这里直接验证「数据行 -> TimelineEvent」的映射逻辑本身是对的。

describe("getQjtxTimeline", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
  });

  it("service client 不可用时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getQjtxTimeline()).toEqual([]);
  });

  it("查询出错时返回空数组", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getQjtxTimeline()).toEqual([]);
  });

  it("detail_title 存在时映射出嵌套的 detail 对象，否则 detail 为 undefined", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: [
            {
              id: 1,
              year: "2010",
              month: null,
              content: ["发布专辑"],
              important: true,
              detail_title: "标题",
              detail_quote: "引言",
              detail_body: ["正文1"],
              detail_closing: "结语",
            },
            {
              id: 2,
              year: "2011",
              month: "03",
              content: [],
              important: false,
              detail_title: null,
              detail_quote: null,
              detail_body: null,
              detail_closing: null,
            },
          ],
          error: null,
        }),
      ]),
    );
    const result = await getQjtxTimeline();
    expect(result[0]).toMatchObject({
      id: "1",
      detail: {
        title: "标题",
        quote: "引言",
        body: ["正文1"],
        closing: "结语",
      },
    });
    expect(result[1]).toMatchObject({ id: "2", month: "03" });
    expect(result[1].detail).toBeUndefined();
  });
});

describe("getStoryLastModified", () => {
  beforeEach(() => {
    vi.mocked(getServiceClient).mockReset();
  });

  it("service client 不可用时返回 null", async () => {
    vi.mocked(getServiceClient).mockReturnValue(null);
    expect(await getStoryLastModified()).toBeNull();
  });

  it("返回最新一条的 created_at", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({
          data: { created_at: "2025-11-20T12:00:00+00:00" },
          error: null,
        }),
      ]),
    );
    const d = await getStoryLastModified();
    expect(d?.toISOString()).toBe("2025-11-20T12:00:00.000Z");
  });

  it("查询出错或无数据时返回 null，不抛异常", async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      createMockSupabaseClient([
        makeQueryBuilder({ data: null, error: { message: "boom" } }),
      ]),
    );
    expect(await getStoryLastModified()).toBeNull();
  });
});
