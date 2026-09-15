import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockCsrfValid = true;
let mockTurnstileResult: { success: boolean; error?: string } = {
  success: true,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSignInError: any = null;
const signInMock = vi.fn();

vi.mock("@/lib/server/server-utils", () => ({
  verifyCSRFToken: vi.fn(async () => mockCsrfValid),
  verifyTurnstileToken: vi.fn(async () => mockTurnstileResult),
}));

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => {
        signInMock(...args);
        return Promise.resolve({ error: mockSignInError });
      },
    },
  })),
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID = {
  email: "someone@example.com",
  password: "hunter2hunter2",
  turnstileToken: "tt",
};

beforeEach(() => {
  mockCsrfValid = true;
  mockTurnstileResult = { success: true };
  mockSignInError = null;
  signInMock.mockClear();
});

describe("POST /api/auth/login — 前置校验顺序", () => {
  it("CSRF 校验失败返回 403，且不尝试登录", async () => {
    mockCsrfValid = false;
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(403);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("人机验证失败返回 403，且不尝试登录", async () => {
    mockTurnstileResult = { success: false, error: "人机验证失败" };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(403);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("缺少邮箱返回 400", async () => {
    const res = await POST(makeRequest({ ...VALID, email: undefined }));
    expect(res.status).toBe(400);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("缺少密码返回 400", async () => {
    const res = await POST(makeRequest({ ...VALID, password: undefined }));
    expect(res.status).toBe(400);
  });

  it("邮箱不是字符串返回 400", async () => {
    const res = await POST(makeRequest({ ...VALID, email: 123 }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login — 登录结果", () => {
  it("凭证正确时返回成功", async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(signInMock).toHaveBeenCalledWith({
      email: VALID.email,
      password: VALID.password,
    });
  });

  // 不区分「邮箱不存在」与「密码错误」，避免账号枚举
  it("凭证错误时返回统一文案的 401", async () => {
    mockSignInError = { message: "Invalid login credentials" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await POST(makeRequest(VALID));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("邮箱或密码错误");
    expect(JSON.stringify(body)).not.toContain("Invalid login credentials");
    spy.mockRestore();
  });

  it("请求体不是合法 JSON 时返回 500 而非崩溃", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
