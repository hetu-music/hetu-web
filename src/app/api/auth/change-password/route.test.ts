import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
} | null = { id: "user-1", email: "someone@example.com" };
let mockCsrfValid = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockUpdateError: any = null;
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
  mockUpdateError = null;
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
  it("旧密码交给 GoTrue 核对，写入新密码并退出其他设备", async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledWith({
      password: VALID.newPassword,
      current_password: VALID.oldPassword,
    });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
  });

  it("旧密码不对时提示「当前密码错误」，不退出其他设备", async () => {
    mockUpdateError = {
      code: "current_password_invalid",
      message: "Current password required when setting new password.",
    };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("当前密码错误");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("旧密码为空在本地就被拒绝，不调 GoTrue", async () => {
    const res = await POST(makeRequest({ ...VALID, oldPassword: "" }));
    expect(res.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("被限流时如实告知", async () => {
    mockUpdateError = { code: "over_request_rate_limit", message: "limit" };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("频繁");
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
