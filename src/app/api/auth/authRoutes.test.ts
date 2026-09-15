/**
 * 注册 / OTP 验证 / 账号资料 / 登出 四个 auth 路由的集中测试。
 * 它们共用同一套 supabase mock，合并在一起避免重复脚手架。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

let mockUser: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
} | null = { id: "user-1", email: "someone@example.com" };
let mockCsrfValid = true;
let mockTurnstile: { success: boolean; error?: string } = { success: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSignUpError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockVerifyOtpError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockSignOutError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUpdateError: any = null;
const signUpMock = vi.fn();
const clearAuthCookiesMock = vi.fn((..._args: unknown[]) =>
  Promise.resolve(undefined),
);

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
      signUp: (...args: unknown[]) => {
        signUpMock(...args);
        return Promise.resolve({ error: mockSignUpError });
      },
      verifyOtp: vi.fn(async () => ({ error: mockVerifyOtpError })),
      signOut: vi.fn(async () => ({ error: mockSignOutError })),
    },
    from: vi.fn(() => makeQueryBuilder({ data: null, error: mockUpdateError })),
  })),
}));

vi.mock("@/lib/server/server-utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/server-utils")>();
  return {
    ...actual,
    verifyCSRFToken: vi.fn(async () => mockCsrfValid),
    verifyTurnstileToken: vi.fn(async () => mockTurnstile),
    // vi.mock 工厂会被提升到文件顶部，不能在这里直接引用上面的 const，
    // 必须包一层在调用时才解析。
    clearAuthCookies: (...args: unknown[]) => clearAuthCookiesMock(...args),
  };
});

import { POST as register } from "./register/route";
import { POST as verifyOtp } from "./verify-otp/route";
import { POST as updateAccount } from "./account/route";
import { POST as logout } from "./logout/route";

function makeRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/auth/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = { id: "user-1", email: "someone@example.com" };
  mockCsrfValid = true;
  mockTurnstile = { success: true };
  mockSignUpError = null;
  mockVerifyOtpError = null;
  mockSignOutError = null;
  mockUpdateError = null;
  signUpMock.mockClear();
  clearAuthCookiesMock.mockClear();
});

describe("POST /api/auth/register", () => {
  const VALID = {
    email: "new@example.com",
    password: "abcd1234",
    turnstileToken: "tt",
  };

  it("CSRF 失败返回 403 且不注册", async () => {
    mockCsrfValid = false;
    expect((await register(makeRequest("register", VALID))).status).toBe(403);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("人机验证失败返回 403 且不注册", async () => {
    mockTurnstile = { success: false };
    expect((await register(makeRequest("register", VALID))).status).toBe(403);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("密码不足 8 位被拒绝", async () => {
    const res = await register(
      makeRequest("register", { ...VALID, password: "ab12345" }),
    );
    expect(res.status).toBe(400);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("密码缺少数字被拒绝", async () => {
    const res = await register(
      makeRequest("register", { ...VALID, password: "abcdefghi" }),
    );
    expect(res.status).toBe(400);
  });

  it("密码缺少字母被拒绝", async () => {
    const res = await register(
      makeRequest("register", { ...VALID, password: "123456789" }),
    );
    expect(res.status).toBe(400);
  });

  it("合法输入时调用注册", async () => {
    const res = await register(makeRequest("register", VALID));
    expect(res.status).toBe(200);
    expect(signUpMock).toHaveBeenCalledWith({
      email: VALID.email,
      password: VALID.password,
    });
  });

  it("注册失败时返回 400", async () => {
    mockSignUpError = { message: "User already registered" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await register(makeRequest("register", VALID))).status).toBe(400);
    spy.mockRestore();
  });
});

describe("POST /api/auth/verify-otp", () => {
  const VALID = { email: "new@example.com", otp: "123456" };

  it("CSRF 失败返回 403", async () => {
    mockCsrfValid = false;
    expect((await verifyOtp(makeRequest("verify-otp", VALID))).status).toBe(
      403,
    );
  });

  it("验证码非 6 位数字被拒绝", async () => {
    for (const otp of ["12345", "1234567", "abcdef", ""]) {
      const res = await verifyOtp(makeRequest("verify-otp", { ...VALID, otp }));
      expect(res.status).toBe(400);
    }
  });

  it("邮箱为空被拒绝", async () => {
    const res = await verifyOtp(
      makeRequest("verify-otp", { ...VALID, email: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("验证码正确时返回成功", async () => {
    expect((await verifyOtp(makeRequest("verify-otp", VALID))).status).toBe(
      200,
    );
  });

  it("过期错误给出可操作的提示", async () => {
    mockVerifyOtpError = { message: "Token has expired" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await verifyOtp(makeRequest("verify-otp", VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("过期");
    spy.mockRestore();
  });

  it("验证码错误给出可操作的提示", async () => {
    mockVerifyOtpError = { message: "Invalid token" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await verifyOtp(makeRequest("verify-otp", VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("验证码错误");
    spy.mockRestore();
  });
});

describe("POST /api/auth/account", () => {
  const VALID = { displayName: "荼靡" };

  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await updateAccount(makeRequest("account", VALID))).status).toBe(
      401,
    );
  });

  it("CSRF 失败返回 403", async () => {
    mockCsrfValid = false;
    expect((await updateAccount(makeRequest("account", VALID))).status).toBe(
      403,
    );
  });

  it("用户名少于 2 个字符被拒绝", async () => {
    const res = await updateAccount(
      makeRequest("account", { displayName: "甲" }),
    );
    expect(res.status).toBe(400);
  });

  it("用户名为空被拒绝", async () => {
    const res = await updateAccount(
      makeRequest("account", { displayName: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("合法用户名更新成功", async () => {
    expect((await updateAccount(makeRequest("account", VALID))).status).toBe(
      200,
    );
  });

  it("可同时更新展示开关与简介", async () => {
    const res = await updateAccount(
      makeRequest("account", { ...VALID, display: false, intro: "简介" }),
    );
    expect(res.status).toBe(200);
  });

  it("更新失败返回 400", async () => {
    mockUpdateError = { message: "duplicate key" };
    expect((await updateAccount(makeRequest("account", VALID))).status).toBe(
      400,
    );
  });
});

describe("POST /api/auth/logout", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await logout(makeRequest("logout", {}))).status).toBe(401);
  });

  it("CSRF 失败返回 403，且不清理 cookie", async () => {
    mockCsrfValid = false;
    expect((await logout(makeRequest("logout", {}))).status).toBe(403);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it("登出成功并清理认证 cookie", async () => {
    const res = await logout(makeRequest("logout", {}));
    expect(res.status).toBe(200);
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });

  it("signOut 失败时返回 500 且不清理 cookie", async () => {
    mockSignOutError = { message: "network" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await logout(makeRequest("logout", {}));
    expect(res.status).toBe(500);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
