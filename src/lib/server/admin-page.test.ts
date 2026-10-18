import { beforeEach, describe, expect, it, vi } from "vitest";

// 与真实的 redirect 一样以抛错中断执行，便于断言跳转目标且不再往下走
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/server/server-auth", () => ({
  getAdminPageSession: vi.fn(),
}));

import { redirect } from "next/navigation";
import {
  type AdminPageSession,
  getAdminPageSession,
} from "@/lib/server/server-auth";
import { requireAdminPage } from "./admin-page";

function session(isSuper: boolean): AdminPageSession {
  return {
    user: {
      id: "u1",
      app_metadata: { is_admin: true, is_super: isSuper },
    },
    accessToken: "token",
  } as unknown as AdminPageSession;
}

beforeEach(() => {
  vi.mocked(redirect).mockClear();
  vi.mocked(getAdminPageSession).mockReset();
});

describe("requireAdminPage", () => {
  it("未登录或非管理员 → 去登录页，登录后回到原路径", async () => {
    vi.mocked(getAdminPageSession).mockResolvedValue(null);
    await expect(requireAdminPage("zh-CN", "/admin/songs")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenCalledWith(
      `/zh-CN/login?next=${encodeURIComponent("/admin/songs")}`,
    );
  });

  it("管理员访问普通板块 → 返回会话", async () => {
    const s = session(false);
    vi.mocked(getAdminPageSession).mockResolvedValue(s);
    expect(await requireAdminPage("zh-CN", "/admin/songs")).toBe(s);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("普通管理员访问 superOnly 板块 → 退回后台首页", async () => {
    vi.mocked(getAdminPageSession).mockResolvedValue(session(false));
    await expect(
      requireAdminPage("zh-TW", "/admin/users", { superOnly: true }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/zh-TW/admin");
  });

  it("超级管理员访问 superOnly 板块 → 返回会话", async () => {
    const s = session(true);
    vi.mocked(getAdminPageSession).mockResolvedValue(s);
    expect(
      await requireAdminPage("zh-CN", "/admin/users", { superOnly: true }),
    ).toBe(s);
    expect(redirect).not.toHaveBeenCalled();
  });
});
