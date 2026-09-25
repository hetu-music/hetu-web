// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestionView } from "@/lib/quiz/views";
import QuizClient from "./QuizClient";

const push = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/shared/AppNavbar", () => ({
  default: () => null,
}));
// 去掉动画，让 AnimatePresence 立即切换
vi.mock("framer-motion", () => {
  const strip = ({
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    custom: _c,
    ...rest
  }: Record<string, unknown>) => rest;
  const motion = new Proxy(
    {},
    {
      get:
        (_, tag: string) =>
        ({ children, ...props }: { children?: React.ReactNode }) =>
          React.createElement(tag, strip(props), children),
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const questions: QuizQuestionView[] = [
  { title: "甲", stem: "第一问", options: ["一A", "一B", "一C", "一D"] },
  { title: "乙", stem: "第二问", options: ["二A", "二B", "二C", "二D"] },
  { title: "丙", stem: "第三问", options: ["三A", "三B", "三C", "三D"] },
];

describe("QuizClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    window.scrollTo = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function answer(text: string) {
    fireEvent.click(screen.getByText(text));
    act(() => {
      vi.advanceTimersByTime(400);
    });
  }

  it("按原始选项下标编码作答，与展示顺序无关", () => {
    render(<QuizClient questions={questions} poolSize={228} />);
    fireEvent.click(screen.getByText("intro.start"));

    answer("一B");
    expect(screen.getByText("第二问")).toBeTruthy();
    answer("二D");
    answer("三A");

    expect(push).toHaveBeenCalledWith("/quiz/result?a=BDA");
    expect(screen.getByText("question.finishing")).toBeTruthy();
  });

  it("返回上一问后可改选", () => {
    render(<QuizClient questions={questions} poolSize={228} />);
    fireEvent.click(screen.getByText("intro.start"));

    answer("一A");
    fireEvent.click(screen.getByText("question.prev"));
    expect(screen.getByText("第一问")).toBeTruthy();
    answer("一C");
    answer("二B");
    answer("三D");

    expect(push).toHaveBeenCalledWith("/quiz/result?a=CBD");
  });

  it("翻页动画期间忽略连点", () => {
    render(<QuizClient questions={questions} poolSize={228} />);
    fireEvent.click(screen.getByText("intro.start"));

    fireEvent.click(screen.getByText("一A"));
    fireEvent.click(screen.getByText("一B"));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    answer("二A");
    answer("三A");

    expect(push).toHaveBeenCalledWith("/quiz/result?a=AAA");
  });

  it("数字键按展示顺序作答", () => {
    render(<QuizClient questions={questions} poolSize={228} />);
    fireEvent.click(screen.getByText("intro.start"));

    for (let i = 0; i < 3; i += 1) {
      fireEvent.keyDown(window, { key: "1" });
      act(() => {
        vi.advanceTimersByTime(400);
      });
    }

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/quiz\/result\?a=[A-D]{3}$/);
  });
});
