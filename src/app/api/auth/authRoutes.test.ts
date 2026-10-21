/**
 * 注册 / 验证码 / 找回密码 / 账号资料 / 改邮箱 / 登出 这些 auth 路由的集中测试。
 * 它们共用同一套 supabase mock，合并在一起避免重复脚手架。
 * 登录与改密码各有自己的测试文件。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeQueryBuilder } from "@/test/mockSupabase";

type MockUser = {
  id: string;
  email?: string;
  new_email?: string;
  app_metadata?: Record<string, unknown>;
};
type MockError = { code?: string; message: string } | null;

const BASE_USER: MockUser = { id: "user-1", email: "someone@example.com" };
let mockUser: MockUser | null = null;
let mockCsrfValid = true;
let mockTurnstile: { success: boolean; error?: string } = { success: true };
let mockSignUpError: MockError = null;
let mockVerifyOtpError: MockError = null;
/** verifyOtp 成功时是否带回会话（改邮箱只验过一个码时不带） */
let mockVerifyOtpSession: object | null = {};
let mockResendError: MockError = null;
let mockResetError: MockError = null;
let mockUpdateUserError: MockError = null;
let mockSignOutError: MockError = null;
let mockUpdateError: MockError = null;
let mockVerifyPasswordError: MockError = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastBuilder: any = null;

const signUpMock = vi.fn();
const verifyOtpMock = vi.fn();
const resendMock = vi.fn();
const resetMock = vi.fn();
const updateUserMock = vi.fn();
const signOutMock = vi.fn();
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
      verifyOtp: (...args: unknown[]) => {
        verifyOtpMock(...args);
        return Promise.resolve({
          data: { session: mockVerifyOtpError ? null : mockVerifyOtpSession },
          error: mockVerifyOtpError,
        });
      },
      resend: (...args: unknown[]) => {
        resendMock(...args);
        return Promise.resolve({ error: mockResendError });
      },
      resetPasswordForEmail: (...args: unknown[]) => {
        resetMock(...args);
        return Promise.resolve({ error: mockResetError });
      },
      updateUser: (...args: unknown[]) => {
        updateUserMock(...args);
        return Promise.resolve({ error: mockUpdateUserError });
      },
      signOut: (...args: unknown[]) => {
        signOutMock(...args);
        return Promise.resolve({ error: mockSignOutError });
      },
    },
    from: vi.fn(() => {
      lastBuilder = makeQueryBuilder({ data: null, error: mockUpdateError });
      return lastBuilder;
    }),
  })),
  verifyPassword: vi.fn(async () => mockVerifyPasswordError),
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
import { POST as resend } from "./resend/route";
import { POST as recovery } from "./recovery/route";
import { POST as recoveryReset } from "./recovery/reset/route";
import { POST as updateAccount } from "./account/route";
import { POST as changeEmail } from "./email/route";
import { POST as verifyEmail } from "./email/verify/route";
import { POST as resendEmail } from "./email/resend/route";
import { POST as logout } from "./logout/route";

function makeRequest(path: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/auth/${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockUser = BASE_USER;
  mockCsrfValid = true;
  mockTurnstile = { success: true };
  mockSignUpError = null;
  mockVerifyOtpError = null;
  mockVerifyOtpSession = {};
  mockResendError = null;
  mockResetError = null;
  mockUpdateUserError = null;
  mockSignOutError = null;
  mockUpdateError = null;
  mockVerifyPasswordError = null;
  lastBuilder = null;
  for (const m of [
    signUpMock,
    verifyOtpMock,
    resendMock,
    resetMock,
    updateUserMock,
    signOutMock,
    clearAuthCookiesMock,
  ]) {
    m.mockClear();
  }
  vi.spyOn(console, "error").mockImplementation(() => undefined);
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

  it("密码不足 8 位、缺数字、缺字母都被拒绝", async () => {
    for (const password of ["ab12345", "abcdefghi", "123456789"]) {
      const res = await register(
        makeRequest("register", { ...VALID, password }),
      );
      expect(res.status).toBe(400);
    }
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("合法输入时调用注册", async () => {
    const res = await register(makeRequest("register", VALID));
    expect(res.status).toBe(200);
    expect(signUpMock).toHaveBeenCalledWith({
      email: VALID.email,
      password: VALID.password,
    });
  });

  it("注册失败时返回中文提示", async () => {
    mockSignUpError = {
      code: "signup_disabled",
      message: "Signups not allowed",
    };
    const res = await register(makeRequest("register", VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("暂未开放注册");
  });

  it("发信被限流返回 429", async () => {
    mockSignUpError = {
      code: "over_email_send_rate_limit",
      message: "rate limit",
    };
    expect((await register(makeRequest("register", VALID))).status).toBe(429);
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
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: VALID.email,
      token: VALID.otp,
      type: "signup",
    });
  });

  it("错码或过期给出可操作的提示，并带回错误码", async () => {
    mockVerifyOtpError = {
      code: "otp_expired",
      message: "Token has expired or is invalid",
    };
    const res = await verifyOtp(makeRequest("verify-otp", VALID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("验证码错误或已过期");
    expect(body.code).toBe("otp_expired");
  });
});

describe("POST /api/auth/resend", () => {
  const VALID = { email: "new@example.com", turnstileToken: "tt" };

  it("要人机验证", async () => {
    mockTurnstile = { success: false };
    expect((await resend(makeRequest("resend", VALID))).status).toBe(403);
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("重发注册验证码", async () => {
    expect((await resend(makeRequest("resend", VALID))).status).toBe(200);
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: VALID.email,
    });
  });
});

describe("POST /api/auth/recovery", () => {
  const VALID = { email: "someone@example.com", turnstileToken: "tt" };

  it("要人机验证", async () => {
    mockTurnstile = { success: false };
    expect((await recovery(makeRequest("recovery", VALID))).status).toBe(403);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("邮箱格式不对时不发信", async () => {
    const res = await recovery(
      makeRequest("recovery", { ...VALID, email: "nope" }),
    );
    expect(res.status).toBe(400);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("发送找回密码的验证码", async () => {
    expect((await recovery(makeRequest("recovery", VALID))).status).toBe(200);
    expect(resetMock).toHaveBeenCalledWith(VALID.email);
  });
});

describe("POST /api/auth/recovery/reset", () => {
  const VALID = {
    email: "someone@example.com",
    otp: "123456",
    password: "newpass123",
  };

  it("新密码不合规时不消耗验证码", async () => {
    const res = await recoveryReset(
      makeRequest("recovery/reset", { ...VALID, password: "short1" }),
    );
    expect(res.status).toBe(400);
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("验证码不对时不改密码，并带回 otp_expired 让前端退回填码", async () => {
    mockVerifyOtpError = { code: "otp_expired", message: "expired" };
    const res = await recoveryReset(makeRequest("recovery/reset", VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("otp_expired");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("验码、改密，再退出其他设备", async () => {
    const res = await recoveryReset(makeRequest("recovery/reset", VALID));
    expect(res.status).toBe(200);
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: VALID.email,
      token: VALID.otp,
      type: "recovery",
    });
    expect(updateUserMock).toHaveBeenCalledWith({ password: VALID.password });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
  });

  it("改密失败时退掉刚建立的会话", async () => {
    mockUpdateUserError = { code: "weak_password", message: "weak" };
    const res = await recoveryReset(makeRequest("recovery/reset", VALID));
    expect(res.status).toBe(400);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });

  it("新密码与原密码相同当作成功", async () => {
    mockUpdateUserError = { code: "same_password", message: "same" };
    const res = await recoveryReset(makeRequest("recovery/reset", VALID));
    expect(res.status).toBe(200);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
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

  it("用户名为空、少于 2 个字符、超过 30 个字符都被拒绝", async () => {
    for (const displayName of ["", "甲", "  甲 ", "字".repeat(31)]) {
      const res = await updateAccount(makeRequest("account", { displayName }));
      expect(res.status).toBe(400);
    }
  });

  it("简介超过 200 字被拒绝", async () => {
    const res = await updateAccount(
      makeRequest("account", { ...VALID, intro: "字".repeat(201) }),
    );
    expect(res.status).toBe(400);
  });

  it("合法用户名更新成功", async () => {
    expect((await updateAccount(makeRequest("account", VALID))).status).toBe(
      200,
    );
    expect(lastBuilder.update).toHaveBeenCalledWith({ name: "荼靡" });
  });

  it("普通用户带上 display 也不会写进去", async () => {
    const res = await updateAccount(
      makeRequest("account", { ...VALID, display: true, intro: "简介" }),
    );
    expect(res.status).toBe(200);
    expect(lastBuilder.update).toHaveBeenCalledWith({
      name: "荼靡",
      intro: "简介",
    });
  });

  it("管理员可以设 display", async () => {
    mockUser = { ...BASE_USER, app_metadata: { is_admin: true } };
    await updateAccount(makeRequest("account", { ...VALID, display: true }));
    expect(lastBuilder.update).toHaveBeenCalledWith({
      name: "荼靡",
      display: true,
    });
  });

  it("用户名被占用返回 409，不回数据库原文", async () => {
    mockUpdateError = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "users_name_unique"',
    };
    const res = await updateAccount(makeRequest("account", VALID));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("这个用户名已经有人用了");
    expect(JSON.stringify(body)).not.toContain("users_name_unique");
  });

  it("其他更新失败返回 400，不回数据库原文", async () => {
    mockUpdateError = {
      code: "42501",
      message: 'permission denied for table "users"',
    };
    const res = await updateAccount(makeRequest("account", VALID));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("permission denied");
  });
});

describe("POST /api/auth/email", () => {
  const VALID = { email: "new@example.com", password: "pass1234" };

  it("新邮箱与当前邮箱相同被拒绝", async () => {
    const res = await changeEmail(
      makeRequest("email", { ...VALID, email: "SOMEONE@example.com" }),
    );
    expect(res.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("密码不对时不发验证码", async () => {
    mockVerifyPasswordError = { code: "invalid_credentials", message: "x" };
    const res = await changeEmail(makeRequest("email", VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("当前密码错误");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("密码对时请求改邮箱", async () => {
    expect((await changeEmail(makeRequest("email", VALID))).status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledWith({ email: VALID.email });
  });

  it("新邮箱已被占用时给出中文提示", async () => {
    mockUpdateUserError = { code: "email_exists", message: "exists" };
    const res = await changeEmail(makeRequest("email", VALID));
    expect((await res.json()).error).toBe("该邮箱已被使用");
  });
});

describe("POST /api/auth/email/verify", () => {
  beforeEach(() => {
    mockUser = { ...BASE_USER, new_email: "new@example.com" };
  });

  it("没有待验证的更改时返回 400", async () => {
    mockUser = { id: "user-1", email: "someone@example.com" };
    const res = await verifyEmail(
      makeRequest("email/verify", { target: "new", otp: "123456" }),
    );
    expect(res.status).toBe(400);
  });

  it("按 target 取邮箱地址，不收前端传的", async () => {
    await verifyEmail(
      makeRequest("email/verify", {
        target: "current",
        otp: "123456",
        email: "evil@example.com",
      }),
    );
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: "someone@example.com",
      token: "123456",
      type: "email_change",
    });
  });

  it("只验过一个码时回 done: false", async () => {
    mockVerifyOtpSession = null;
    const res = await verifyEmail(
      makeRequest("email/verify", { target: "new", otp: "123456" }),
    );
    expect(await res.json()).toEqual({ done: false });
  });

  it("两个码都验过回 done: true", async () => {
    const res = await verifyEmail(
      makeRequest("email/verify", { target: "new", otp: "123456" }),
    );
    expect(await res.json()).toEqual({ done: true });
  });
});

describe("POST /api/auth/email/resend", () => {
  it("没有待验证的更改时返回 400", async () => {
    expect((await resendEmail(makeRequest("email/resend"))).status).toBe(400);
  });

  it("向新邮箱重发", async () => {
    mockUser = { ...BASE_USER, new_email: "new@example.com" };
    expect((await resendEmail(makeRequest("email/resend"))).status).toBe(200);
    expect(resendMock).toHaveBeenCalledWith({
      type: "email_change",
      email: "new@example.com",
    });
  });
});

describe("POST /api/auth/logout", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await logout(makeRequest("logout"))).status).toBe(401);
  });

  it("CSRF 失败返回 403，且不清理 cookie", async () => {
    mockCsrfValid = false;
    expect((await logout(makeRequest("logout"))).status).toBe(403);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it("不带参数：登出并清理认证 cookie", async () => {
    const res = await logout(makeRequest("logout"));
    expect(res.status).toBe(200);
    expect(clearAuthCookiesMock).toHaveBeenCalled();
  });

  it("signOut 失败时返回 500 且不清理 cookie", async () => {
    mockSignOutError = { message: "network" };
    const res = await logout(makeRequest("logout", {}));
    expect(res.status).toBe(500);
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it("scope: others 只退出其他设备，当前设备的 cookie 保留", async () => {
    const res = await logout(makeRequest("logout", { scope: "others" }));
    expect(res.status).toBe(200);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    expect(clearAuthCookiesMock).not.toHaveBeenCalled();
  });

  it("不认识的 scope 被拒绝", async () => {
    const res = await logout(makeRequest("logout", { scope: "global" }));
    expect(res.status).toBe(400);
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
