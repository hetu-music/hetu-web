import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// ─── mock next/headers 的 cookies() ────────────────────────────────────────
// 与 server-utils.test.ts 相同的内存 cookie jar。
const cookieStore = new Map<string, string>();

function makeCookieJar() {
  return {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { value };
    },
    getAll: () =>
      Array.from(cookieStore.entries()).map(([name, value]) => ({
        name,
        value,
      })),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (arg: string | { name: string }) => {
      const name = typeof arg === "string" ? arg : arg.name;
      cookieStore.delete(name);
    },
  };
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => makeCookieJar()),
}));

async function callGet(): Promise<string> {
  const res = await GET();
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

describe("GET /api/public/csrf-token", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it("cookie 为空时签发新 token 并写入 cookie", async () => {
    const token = await callGet();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(cookieStore.get("csrf-token")).toBe(token);
  });

  it("cookie 已有 token 时复用，不重新签发", async () => {
    cookieStore.set("csrf-token", "existing-token-value");

    const token = await callGet();

    expect(token).toBe("existing-token-value");
    expect(cookieStore.get("csrf-token")).toBe("existing-token-value");
  });

  // 这是导致管理员随机 403 的回归点：此前每次调用都轮换 token，
  // 先取到 token 的调用方手里的副本会被后来的调用作废。
  it("多次调用返回同一个 token", async () => {
    const first = await callGet();
    const second = await callGet();
    const third = await callGet();

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("cookie 只有空白字符时视为无效，重新签发", async () => {
    cookieStore.set("csrf-token", "   ");

    const token = await callGet();

    expect(token).not.toBe("   ");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
