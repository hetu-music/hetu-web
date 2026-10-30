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
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import QuizSection from "./QuizSection";

const apiRequest = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/context/UserContext", () => ({
  useUserContext: () => ({ user: { id: "u1" }, loaded: true }),
}));
vi.mock("@/lib/api/request", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock("@/components/ui/toast", () => ({ addToast: vi.fn() }));

const latest = {
  slug: "latest0001",
  savedAt: "2026-10-20T00:00:00Z",
  persona: { motto: "仰观天象", label: "天象", description: "你看得见风月。" },
  secondary: { motto: "行遍山河", label: "山河" },
  profile: [{ key: "tianxiang", label: "天象", z: 2 }],
  imagery: ["月"],
  matches: [
    {
      song: { id: 7, title: "倾尽天下", hascover: false },
      percent: 92,
      reasons: ["天象", "「月」"],
      lines: ["月色照天下"],
    },
  ],
};

function summary(id: string, motto: string, savedAt: string) {
  return { id, savedAt, persona: { motto, label: "" }, secondary: null };
}

function stubRecords(data: unknown) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => data,
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <QuizSection />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  apiRequest.mockReset();
  vi.unstubAllGlobals();
});

describe("QuizSection", () => {
  it("没有记录时说明保存的方法", async () => {
    stubRecords({ records: [], latest: null });
    renderSection();
    expect(await screen.findByText("还没有留下过寻曲的结果")).toBeTruthy();
  });

  it("最近一条展开，往次各占一行，都链到自己的记录", async () => {
    const fetchMock = stubRecords({
      records: [
        summary("latest0001", "仰观天象", "2026-10-20T00:00:00Z"),
        summary("older00001", "倚遍楼台", "2026-08-01T00:00:00Z"),
      ],
      latest,
    });
    renderSection();

    const motto = await screen.findByRole("link", { name: "仰观天象" });
    expect(motto.getAttribute("href")).toBe("/quiz/result/latest0001");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/quiz-results?latest=1&locale=zh-CN",
    );
    expect(screen.getByText("兼有 · 行遍山河")).toBeTruthy();
    expect(screen.getByText("2026 年 10 月寻得")).toBeTruthy();
    expect(screen.getByText("你看得见风月。")).toBeTruthy();
    expect(screen.getByText("92%")).toBeTruthy();
    expect(screen.getByText("同好：天象 · 「月」")).toBeTruthy();
    expect(screen.getByText("月色照天下")).toBeTruthy();

    expect(screen.getByText("往次")).toBeTruthy();
    const past = screen.getByRole("link", { name: "倚遍楼台" });
    expect(past.getAttribute("href")).toBe("/quiz/result/older00001");
    expect(screen.getByText("2026 年 8 月寻得")).toBeTruthy();
  });

  it("最近一条渲染不出来时列进往次", async () => {
    stubRecords({
      records: [summary("latest0001", "仰观天象", "2026-10-20T00:00:00Z")],
      latest: null,
    });
    renderSection();
    expect(await screen.findByText("往次")).toBeTruthy();
    expect(screen.getByRole("link", { name: "仰观天象" })).toBeTruthy();
  });

  it("删除要点两下", async () => {
    stubRecords({
      records: [
        summary("latest0001", "仰观天象", "2026-10-20T00:00:00Z"),
        summary("older00001", "倚遍楼台", "2026-08-01T00:00:00Z"),
      ],
      latest,
    });
    apiRequest.mockResolvedValue({ success: true });
    renderSection();
    await screen.findByText("往次");

    const [, pastDelete] = screen.getAllByRole("button", { name: "删除" });
    fireEvent.click(pastDelete);
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/public/quiz-results",
        expect.objectContaining({
          method: "DELETE",
          body: { id: "older00001" },
        }),
      ),
    );
  });
});
