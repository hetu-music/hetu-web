// @vitest-environment jsdom
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
import CustomSelect from "./CustomSelect";

const OPTIONS = [
  { value: "原创", label: "原创" },
  { value: "翻唱", label: "翻唱" },
  { value: "合作", label: "合作" },
];

/** 受控包装：把选中值铺到 DOM 上，同时记下每次 onChange */
function Harness({ onChange }: { onChange: (v: string[]) => void }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <CustomSelect
        label="类型"
        placeholder="全部类型"
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
      />
      <span data-testid="value">{value.join(",")}</span>
    </NextIntlClientProvider>
  );
}

const valueText = () => screen.getByTestId("value").textContent;

beforeEach(() => {
  // 按宽屏处理：下拉而不是底部面板
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /全部类型/ }));
  return screen.findByRole("option", { name: "原创" });
}

describe("CustomSelect", () => {
  it("点选项就选上，面板不收起，可以接着选", async () => {
    render(<Harness onChange={vi.fn()} />);
    fireEvent.click(await openPanel());
    expect(valueText()).toBe("原创");
    fireEvent.click(screen.getByRole("option", { name: "合作" }));
    expect(valueText()).toBe("原创,合作");
    // 再点一次取消
    fireEvent.click(screen.getByRole("option", { name: "原创" }));
    expect(valueText()).toBe("合作");
  });

  it("搜索只留下匹配项，全选只选中搜出来的", async () => {
    render(<Harness onChange={vi.fn()} />);
    await openPanel();
    fireEvent.change(screen.getByRole("combobox", { name: "类型" }), {
      target: { value: "翻" },
    });
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "原创" })).toBeNull(),
    );
    expect(screen.getByRole("option", { name: "翻唱" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /全选/ }));
    expect(valueText()).toBe("翻唱");
  });

  it("搜不到时显示无匹配", async () => {
    render(<Harness onChange={vi.fn()} />);
    await openPanel();
    fireEvent.change(screen.getByRole("combobox", { name: "类型" }), {
      target: { value: "不存在" },
    });
    expect(await screen.findByText("无匹配结果")).toBeTruthy();
  });

  it("触发框里的清除只清空，不打开面板", async () => {
    render(<Harness onChange={vi.fn()} />);
    fireEvent.click(await openPanel());
    fireEvent.keyDown(screen.getByRole("combobox", { name: "类型" }), {
      key: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(valueText()).toBe("");
    expect(screen.queryByRole("option")).toBeNull();
  });
});
