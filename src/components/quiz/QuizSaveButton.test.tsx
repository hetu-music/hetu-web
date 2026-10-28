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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import QuizSaveButton from "./QuizSaveButton";

const push = vi.fn();
const replace = vi.fn();
const onSaved = vi.fn();
const apiRequest = vi.fn();
const user: { current: { id: string } | null } = { current: { id: "u1" } };

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/quiz/result/3Kltpgo",
  useRouter: () => ({ push, replace }),
}));
vi.mock("@/context/UserContext", () => ({
  useUserContext: () => ({ user: user.current, loaded: true }),
}));
vi.mock("@/lib/api/request", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock("@/components/ui/toast", () => ({ addToast: vi.fn() }));

function record(id: string, savedAt: string) {
  return {
    id,
    savedAt,
    persona: { motto: "仰观天象", label: "天象" },
    secondary: null,
  };
}

function stubRecords(data: unknown) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: true,
    json: async () => data,
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function renderButton() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages}>
        <QuizSaveButton slug="3Kltpgo" className="" onSaved={onSaved} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  onSaved.mockReset();
  apiRequest.mockReset();
  user.current = { id: "u1" };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("QuizSaveButton", () => {
  it("访客点击去登录，带上结果页地址，不保存", () => {
    user.current = null;
    const fetchMock = stubRecords({});
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "登录后保存" }));
    expect(push).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/quiz/result/3Kltpgo")}`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("存过的显示「已保存」，链到那条记录", async () => {
    const fetchMock = stubRecords({ records: [], savedId: "aB3dE6gH9k" });
    renderButton();
    const link = await screen.findByRole("link", { name: "已保存" });
    expect(link.getAttribute("href")).toBe("/quiz/result/aB3dE6gH9k");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/quiz-results?slug=3Kltpgo",
    );
  });

  it("保存后只换地址栏里的链接，不走路由跳转", async () => {
    window.history.pushState(null, "", "/zh-CN/quiz/result/3Kltpgo");
    stubRecords({ records: [], savedId: null });
    apiRequest.mockResolvedValue({ id: "aB3dE6gH9k" });
    renderButton();
    const button = await screen.findByRole("button", { name: "保存" });
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
    fireEvent.click(button);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("aB3dE6gH9k"));
    expect(window.location.pathname).toBe("/zh-CN/quiz/result/aB3dE6gH9k");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/public/quiz-results",
      expect.objectContaining({ method: "POST", body: { slug: "3Kltpgo" } }),
    );
  });

  it("存满 5 条时提示会替换最早的那一次", async () => {
    stubRecords({
      records: [
        record("r5", "2026-10-20T00:00:00Z"),
        record("r4", "2026-09-20T00:00:00Z"),
        record("r3", "2026-08-20T00:00:00Z"),
        record("r2", "2026-07-20T00:00:00Z"),
        // 北京时间已是 3 月 1 日
        record("r1", "2026-02-28T20:00:00Z"),
      ],
      savedId: null,
    });
    renderButton();
    expect(
      await screen.findByText("已存满 5 次，再保存将替换 2026 年 3 月的那一次"),
    ).toBeTruthy();
  });

  it("未满时不提示", async () => {
    stubRecords({
      records: [record("r1", "2026-10-20T00:00:00Z")],
      savedId: null,
    });
    renderButton();
    const button = await screen.findByRole("button", { name: "保存" });
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
    expect(screen.queryByText(/已存满/)).toBeNull();
  });
});
