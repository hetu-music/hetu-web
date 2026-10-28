// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FavoriteButton from "./FavoriteButton";

const push = vi.fn();
const toggleFavorite = vi.fn();
const favorites = {
  loaded: true,
  isLoggedIn: false,
  isFavorite: (id: number) => id === 7,
  toggleFavorite,
};

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/quiz/result/3Kltpgo",
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/context/FavoritesContext", () => ({
  useFavorites: () => favorites,
}));

describe("FavoriteButton", () => {
  beforeEach(() => {
    push.mockReset();
    toggleFavorite.mockReset();
    favorites.loaded = true;
    favorites.isLoggedIn = false;
  });
  afterEach(cleanup);

  it("未登录时默认不显示", () => {
    const { container } = render(<FavoriteButton songId={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("showForGuest：未登录时显示，点击去登录并带上当前地址", () => {
    render(<FavoriteButton songId={1} variant="inline" showForGuest />);
    fireEvent.click(screen.getByLabelText("login"));
    expect(push).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/quiz/result/3Kltpgo")}`,
    );
    expect(toggleFavorite).not.toHaveBeenCalled();
  });

  it("登录状态未同步完成时不显示，避免访客误点去登录", () => {
    favorites.loaded = false;
    const { container } = render(
      <FavoriteButton songId={1} variant="inline" showForGuest />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("已登录时切换收藏，不受 showForGuest 影响", () => {
    favorites.isLoggedIn = true;
    render(<FavoriteButton songId={7} variant="inline" showForGuest />);
    const button = screen.getByLabelText("remove");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(toggleFavorite).toHaveBeenCalledWith(7);
    expect(push).not.toHaveBeenCalled();
  });
});
