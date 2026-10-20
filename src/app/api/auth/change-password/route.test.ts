import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
} | null = { id: "user-1", email: "someone@example.com" };
let mockCsrfValid = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockVerifyError: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUpdateError: any = null;
const verifyPasswordMock = vi.fn();
const updateUserMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
      updateUser: (...args: unknown[]) => {
        updateUserMock(...args);
        return Promise.resolve({ error: mockUpdateError });
      },
      signOut: (...args: unknown[]) => {
        signOutMock(...args);
        return Promise.resolve({ error: null });
      },
    },
  })),
  verifyPassword: (...args: unknown[]) => {
    verifyPasswordMock(...args);
    return Promise.resolve(mockVerifyError);
  },
}));

vi.mock("@/lib/server/server-utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/server-utils")>();
  return { ...actual, verifyCSRFToken: vi.fn(async () => mockCsrfValid) };
});

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID = { oldPassword: "oldpass123", newPassword: "newpass456" };

beforeEach(() => {
  mockUser = { id: "user-1", email: "someone@example.com" };
  mockCsrfValid = true;
  mockVerifyError = null;
  mockUpdateError = null;
  verifyPasswordMock.mockClear();
  updateUserMock.mockClear();
  signOutMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/auth/change-password — 鉴权", () => {
  it("未登录返回 401", async () => {
    mockUser = null;
    expect((await POST(makeRequest(VALID))).status).toBe(401);
  });

  it("CSRF 校验失败返回 403，且不改密码", async () => {
    mockCsrfValid = false;
    expect((await POST(makeRequest(VALID))).status).toBe(403);
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/change-password — 新密码强度", () => {
  it("缺少参数返回 400", async () => {
    expect((await POST(makeRequest({}))).status).toBe(400);
  });

  it("少于 8 位被拒绝", async () => {
    const res = await POST(makeRequest({ ...VALID, newPassword: "ab12345" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("8位");
  });

  it("纯数字（无字母）被拒绝", async () => {
    const res = await POST(makeRequest({ ...VALID, newPassword: "123456789" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("字母");
  });

  it("纯字母（无数字）被拒绝", async () => {
    const res = await POST(makeRequest({ ...VALID, newPassword: "abcdefghi" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("数字");
  });

  it("恰好 8 位且含字母与数字时通过", async () => {
    const res = await POST(makeRequest({ ...VALID, newPassword: "abcd1234" }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/change-password — 旧密码校验", () => {
  it("用当前账号的邮箱核对旧密码", async () => {
    await POST(makeRequest(VALID));
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      "someone@example.com",
      VALID.oldPassword,
    );
  });

  it("旧密码不对则不改密码", async () => {
    mockVerifyError = { code: "invalid_credentials", message: "Invalid" };
    const res = await POST(makeRequest(VALID));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("当前密码错误");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("核对时被限流，如实告知而不是报密码错误", async () => {
    mockVerifyError = { code: "over_request_rate_limit", message: "limit" };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("频繁");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("旧密码正确时写入新密码，并退出其他设备", async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledWith({
      password: VALID.newPassword,
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
  });

  it("账号没有邮箱时无法核对，返回 400", async () => {
    mockUser = { id: "user-1" };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("写入失败时返回中文提示，不回 GoTrue 原文", async () => {
    mockUpdateError = {
      code: "same_password",
      message: "New password should be different from the old password.",
    };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("新密码不能与原密码相同");
    expect(JSON.stringify(body)).not.toContain("should be different");
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
