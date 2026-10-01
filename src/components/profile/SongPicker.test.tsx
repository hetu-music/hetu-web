// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import { SongPicker } from "./FeedbackSection";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/profile",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/context/UserContext", () => ({
  useUserContext: () => ({ user: null, loaded: true }),
}));

type Song = { id: number; title: string };

function Harness() {
  const [value, setValue] = useState<Song | null>(null);
  return <SongPicker value={value} onChange={(song) => setValue(song)} />;
}

function renderPicker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <Harness />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function stubSearch(songs: Song[]) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => ({ songs }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

const input = () => screen.getByPlaceholderText(/输入歌曲名称/);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SongPicker", () => {
  it("停止输入后才搜索，选中后显示歌名并收起输入框", async () => {
    const fetchMock = stubSearch([
      { id: 1, title: "倾尽天下" },
      { id: 2, title: "倾杯" },
    ]);
    renderPicker();

    fireEvent.change(input(), { target: { value: "倾" } });
    // 防抖期间不发请求
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("option", { name: "倾尽天下" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "q=" + encodeURIComponent("倾"),
    );

    // 选中后换成歌名加清除按钮
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/输入歌曲名称/)).toBeNull(),
    );
    expect(screen.getByText("倾尽天下")).toBeTruthy();

    // 清除后回到输入框
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(input()).toBeTruthy();
  });

  it("搜不到时显示一句提示", async () => {
    stubSearch([]);
    renderPicker();
    fireEvent.change(input(), { target: { value: "不存在" } });
    expect(await screen.findByText("未找到相关歌曲")).toBeTruthy();
  });
});
