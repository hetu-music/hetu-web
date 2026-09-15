import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { GET, POST } from "./route";

const SECRET = "correct-horse-battery-staple";

function makeRequest(
  method: string,
  { secretHeader, query = "" }: { secretHeader?: string; query?: string } = {},
) {
  const headers = new Headers();
  if (secretHeader !== undefined) {
    headers.set("x-revalidate-secret", secretHeader);
  }
  return new NextRequest(`http://localhost/api/public/revalidate${query}`, {
    method,
    headers,
  });
}

beforeEach(() => {
  revalidatePathMock.mockClear();
  process.env.REVALIDATE_SECRET = SECRET;
});

describe("POST /api/public/revalidate — 鉴权", () => {
  it("缺少密钥头返回 401", async () => {
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("密钥错误返回 401", async () => {
    const res = await POST(makeRequest("POST", { secretHeader: "wrong" }));
    expect(res.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // 改造的核心：密钥不再接受 query string，避免进 access log
  it("密钥写在 query string 里不被接受", async () => {
    const res = await POST(makeRequest("POST", { query: `?secret=${SECRET}` }));
    expect(res.status).toBe(401);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("密钥正确时刷新各语言首页、意象页、故事页与 sitemap", async () => {
    const res = await POST(makeRequest("POST", { secretHeader: SECRET }));
    expect(res.status).toBe(200);

    const paths = revalidatePathMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/zh-CN");
    expect(paths).toContain("/zh-TW");
    expect(paths).toContain("/zh-CN/imagery");
    expect(paths).toContain("/zh-CN/story/qjtx");
    expect(paths).toContain("/sitemap.xml");
  });

  it("服务端未配置密钥时一律拒绝", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(makeRequest("POST", { secretHeader: "anything" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/public/revalidate — 单曲刷新", () => {
  it("缺少密钥头返回 401", async () => {
    const res = await GET(makeRequest("GET", { query: "?id=42" }));
    expect(res.status).toBe(401);
  });

  it("密钥正确但缺少 id 返回 400", async () => {
    const res = await GET(makeRequest("GET", { secretHeader: SECRET }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing id");
  });

  it("按 id 刷新对应语言的歌曲页", async () => {
    const res = await GET(
      makeRequest("GET", { secretHeader: SECRET, query: "?id=42" }),
    );
    expect(res.status).toBe(200);

    const paths = revalidatePathMock.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/zh-CN/song/42");
    expect(paths).toContain("/zh-TW/song/42");
  });

  it("id=all 时按路由模板整体刷新", async () => {
    const res = await GET(
      makeRequest("GET", { secretHeader: SECRET, query: "?id=all" }),
    );
    expect(res.status).toBe(200);

    const calls = revalidatePathMock.mock.calls;
    expect(calls).toContainEqual(["/zh-CN/song/[id]", "page"]);
    expect(await res.text()).toContain("All song pages");
  });
});
