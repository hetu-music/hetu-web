// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import type { UserInfo } from "@/context/UserContext";

// ─── mock 依赖 ────────────────────────────────────────────────────────────────

let mockUser: UserInfo | null = null;
let mockUserLoaded = true;

vi.mock("@/context/UserContext", () => ({
  useUserContext: () => ({
    user: mockUser,
    loaded: mockUserLoaded,
    isLoggedIn: Boolean(mockUser),
    refetch: vi.fn(),
    logout: vi.fn(),
    loggingOut: false,
  }),
}));

vi.mock("@/lib/api/csrf", () => ({
  getCsrfToken: vi.fn(async () => "csrf-test-token"),
  resetCsrfToken: vi.fn(),
}));

import { FavoritesProvider, useFavorites } from "./FavoritesContext";

// ─── 测试辅助 ─────────────────────────────────────────────────────────────────

function makeUser(id: string): UserInfo {
  return {
    id,
    name: `用户${id}`,
    display: true,
    intro: null,
    isAdmin: false,
    isSuper: false,
    hasBenefits: false,
  };
}

/** 把 context 的关键状态平铺到 DOM 上，便于断言 */
function Probe() {
  const { favorites, favoriteSongs, loaded, isLoggedIn } = useFavorites();
  return (
    <div>
      <span data-testid="ids">{favorites.join(",")}</span>
      <span data-testid="songs">
        {favoriteSongs.map((s) => s.title).join(",")}
      </span>
      <span data-testid="loaded">{String(loaded)}</span>
      <span data-testid="logged-in">{String(isLoggedIn)}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <FavoritesProvider>
      <Probe />
    </FavoritesProvider>,
  );
}

function mockCollectionsResponse(body: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  mockUser = null;
  mockUserLoaded = true;
  vi.restoreAllMocks();
});

afterEach(() => {
  // vitest 未开启 globals，RTL 不会自动注册 cleanup，必须手动卸载，
  // 否则上一个用例的 DOM 残留会让 getByTestId 命中多个元素。
  cleanup();
  vi.unstubAllGlobals();
});

// ─── 用例 ─────────────────────────────────────────────────────────────────────

describe("FavoritesProvider — 登录态与收藏加载", () => {
  it("未登录时不请求收藏，直接视为已加载", async () => {
    const fetchMock = mockCollectionsResponse({ songIds: [], songs: [] });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProvider();

    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("logged-in").textContent).toBe("false");
    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("用户信息尚未就绪时 loaded 为 false", () => {
    mockUserLoaded = false;
    vi.stubGlobal("fetch", mockCollectionsResponse({}));

    renderWithProvider();

    expect(screen.getByTestId("loaded").textContent).toBe("false");
  });

  it("登录后拉取并填充收藏", async () => {
    mockUser = makeUser("u1");
    vi.stubGlobal(
      "fetch",
      mockCollectionsResponse({
        songIds: [3, 7],
        songs: [
          { id: 3, title: "倾尽天下" },
          { id: 7, title: "如花" },
        ],
      }),
    );

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("3,7"),
    );
    expect(screen.getByTestId("songs").textContent).toBe("倾尽天下,如花");
    expect(screen.getByTestId("loaded").textContent).toBe("true");
  });

  it("接口失败时收藏为空但仍标记为已加载，不会卡在加载中", async () => {
    mockUser = makeUser("u1");
    vi.stubGlobal("fetch", mockCollectionsResponse({}, false));

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loaded").textContent).toBe("true"),
    );
    expect(screen.getByTestId("ids").textContent).toBe("");
  });
});

describe("FavoritesProvider — 切换用户", () => {
  it("换账号后不会残留上一个用户的收藏", async () => {
    mockUser = makeUser("u1");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        songIds: [1],
        songs: [{ id: 1, title: "第一个用户的歌" }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { rerender } = renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("1"),
    );

    // 切换到另一个账号，新账号的收藏还在请求中
    let resolveSecond: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await pending;
        return {
          ok: true,
          json: async () => ({
            songIds: [9],
            songs: [{ id: 9, title: "第二个用户的歌" }],
          }),
        };
      }) as unknown as typeof fetch,
    );
    mockUser = makeUser("u2");

    rerender(
      <FavoritesProvider>
        <Probe />
      </FavoritesProvider>,
    );

    // 关键：新用户数据到达之前，界面必须已经清空旧数据
    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("songs").textContent).toBe("");

    await act(async () => {
      resolveSecond(undefined);
      await pending;
    });

    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("9"),
    );
  });

  it("登出后收藏立即清空", async () => {
    mockUser = makeUser("u1");
    vi.stubGlobal(
      "fetch",
      mockCollectionsResponse({
        songIds: [5],
        songs: [{ id: 5, title: "某首歌" }],
      }),
    );

    const { rerender } = renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("5"),
    );

    mockUser = null;
    rerender(
      <FavoritesProvider>
        <Probe />
      </FavoritesProvider>,
    );

    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("logged-in").textContent).toBe("false");
  });
});
