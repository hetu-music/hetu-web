// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/zh-CN";
import ImageModal from "./ImageModal";

afterEach(cleanup);

function renderModal(props: { isOpen: boolean; src: string }) {
  return (
    <NextIntlClientProvider locale="zh-CN" messages={messages}>
      <ImageModal
        isOpen={props.isOpen}
        onClose={vi.fn()}
        src={props.src}
        alt="封面"
        title="歌一 · 封面"
      />
    </NextIntlClientProvider>
  );
}

describe("ImageModal", () => {
  // 歌曲页关闭时会立刻把 src 清空，而面板还在放退场动画
  it("关闭时 src 被清空也不报错，退场后卸载", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { rerender } = render(
      renderModal({ isOpen: true, src: "/cover.jpg" }),
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();

    rerender(renderModal({ isOpen: false, src: "" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
