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
const updateUserMock = vi.fn();

vi.mock("@/lib/db/supabase-auth", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockUser ? { access_token: "t" } : null },
      })),
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
      signInWithPassword: vi.fn(async () => ({ error: mockVerifyError })),
      updateUser: (...args: unknown[]) => {
        updateUserMock(...args);
        return Promise.resolve({ error: mockUpdateError });
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
  mockVerifyError = null;
  mockUpdateError = null;
  updateUserMock.mockClear();
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
  it("必须先用旧密码验证身份，验证失败则不改密码", async () => {
    mockVerifyError = { message: "Invalid login credentials" };
    const res = await POST(makeRequest(VALID));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("旧密码错误");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("旧密码正确时写入新密码", async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    expect(updateUserMock).toHaveBeenCalledWith({
      password: VALID.newPassword,
    });
  });

  it("账号没有邮箱时无法验证，返回 400", async () => {
    mockUser = { id: "user-1" };
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(400);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("写入失败时返回 400", async () => {
    mockUpdateError = { message: "New password should be different" };
    expect((await POST(makeRequest(VALID))).status).toBe(400);
  });
});
