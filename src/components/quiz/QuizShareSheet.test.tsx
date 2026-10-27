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
import type { QuizResultView } from "@/lib/quiz/views";
import { renderShareCard } from "@/lib/quiz/share-card";
import QuizShareSheet from "./QuizShareSheet";

const mocks = vi.hoisted(() => ({
  theme: "light",
  locale: "zh-CN",
  translate: (key: string) => key,
}));

vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => mocks.translate,
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mocks.theme }),
}));
vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({
    open,
    children,
    footer,
  }: {
    open: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock("@/hooks/ui/useIsDesktop", () => ({ useIsDesktop: () => false }));
vi.mock("@/i18n/navigation", () => ({ getPathname: () => "/zh-CN/quiz" }));
vi.mock("@/lib/utils/share", () => ({
  copyPageLink: vi.fn(async () => "copied"),
}));
vi.mock("@/lib/utils/utils-song", () => ({ getCoverUrl: () => "/cover.jpg" }));
vi.mock("@/lib/quiz/share-card", () => ({ renderShareCard: vi.fn() }));

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const result: QuizResultView = {
  code: "AAAAAAAAAAAA",
  persona: { motto: "仰观天象", label: "天象", description: "你看得见风月。" },
  secondary: null,
  profile: [{ key: "tianxiang", label: "天象", z: 2 }],
  imagery: ["月"],
  matches: [],
};
let canvas: HTMLCanvasElement;
const onOpenChange = vi.fn();
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  "createObjectURL",
);
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  "revokeObjectURL",
);

beforeEach(() => {
  mocks.theme = "light";
  mocks.locale = "zh-CN";
  onOpenChange.mockReset();
  canvas = {
    width: 1080,
    height: 2340,
    toDataURL: vi.fn(() => PNG),
    toBlob: vi.fn((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" })),
    ),
  } as unknown as HTMLCanvasElement;
  vi.mocked(renderShareCard).mockReset().mockResolvedValue(canvas);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.stubGlobal("navigator", {
    canShare: vi.fn(() => true),
    share: vi.fn(async () => undefined),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const [key, descriptor] of [
    ["createObjectURL", originalCreateObjectURL],
    ["revokeObjectURL", originalRevokeObjectURL],
  ] as const) {
    if (descriptor) Object.defineProperty(URL, key, descriptor);
    else Reflect.deleteProperty(URL, key);
  }
});

function sheet(open = true) {
  return (
    <QuizShareSheet open={open} onOpenChange={onOpenChange} result={result} />
  );
}

describe("QuizShareSheet compatibility", () => {
  it("把全部五首推荐与九项倾向传给分享图，不截取前三首", async () => {
    const complete: QuizResultView = {
      ...result,
      profile: [
        "天象",
        "典故",
        "器用",
        "楼台",
        "山河",
        "草木",
        "人间",
        "情思",
        "光阴",
      ].map((label, i) => ({
        key: result.profile[0].key,
        label,
        z: 1 - i / 4,
      })),
      matches: ["明月如霜", "长夜梦我", "如梦", "宁作我", "蝉不知雪"].map(
        (title, i) => ({
          song: {
            id: i + 1,
            title,
            artist: ["河图"],
            album: title,
          } as QuizResultView["matches"][number]["song"],
          percent: 80 - i,
          reasons: [],
          lines: ["印证歌词"],
        }),
      ),
    };
    render(
      <QuizShareSheet open onOpenChange={onOpenChange} result={complete} />,
    );
    await screen.findByRole("img");
    const [drawn] = vi.mocked(renderShareCard).mock.calls[0];
    expect(drawn.dimensions).toHaveLength(9);
    expect(drawn.dimensions.at(-1)?.z).toBeLessThan(0);
    expect(drawn.matches.map((match) => match.title)).toEqual(
      complete.matches.map((match) => match.song.title),
    );
    expect(drawn.matches[4].lyric).toBe("印证歌词");
  });

  it("浏览器没有 toBlob 时仍显示 PNG 预览并允许保存", async () => {
    Object.defineProperty(canvas, "toBlob", { value: undefined });
    render(sheet());
    expect((await screen.findByRole("img")).getAttribute("src")).toBe(PNG);
    expect(
      (screen.getByRole("button", { name: "card.save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("系统分享能力检测抛错只隐藏分享按钮，不丢失已生成的图片", async () => {
    vi.stubGlobal("navigator", {
      share: vi.fn(),
      canShare: () => {
        throw new TypeError("不支持 files 分享");
      },
    });
    render(sheet());
    expect(await screen.findByRole("img")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "card.share" })).toBeNull();
    expect(screen.queryByText("card.failed")).toBeNull();
  });

  it("File 构造器不可用时仍能预览并保留保存按钮", async () => {
    vi.stubGlobal("File", undefined);
    render(sheet());
    expect(await screen.findByRole("img")).toBeTruthy();
    expect(screen.getByRole("button", { name: "card.save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "card.share" })).toBeNull();
  });

  it("生成失败后可复制结果链接，不再提供重新生成按钮", async () => {
    vi.mocked(renderShareCard).mockRejectedValueOnce(new Error("暂时无法绘制"));
    render(sheet());
    expect(await screen.findByText("card.failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "card.retry" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "card.save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "card.copyLink" }));
    expect(
      await screen.findByRole("button", { name: "result.copied" }),
    ).toBeTruthy();
    expect(renderShareCard).toHaveBeenCalledTimes(1);
  });

  it("成功图片重开面板时使用缓存，不重新绘制", async () => {
    const { rerender } = render(sheet());
    await screen.findByRole("img");
    rerender(sheet(false));
    rerender(sheet(true));
    expect(await screen.findByRole("img")).toBeTruthy();
    expect(renderShareCard).toHaveBeenCalledTimes(1);
  });

  it("切换深浅主题分别生成，切回后使用原主题缓存", async () => {
    const { rerender } = render(sheet());
    await screen.findByRole("img");
    mocks.theme = "dark";
    rerender(sheet());
    await screen.findByRole("img");
    expect(renderShareCard).toHaveBeenLastCalledWith(expect.anything(), "dark");
    mocks.theme = "light";
    rerender(sheet());
    await screen.findByRole("img");
    expect(renderShareCard).toHaveBeenCalledTimes(2);
  });

  it("结果变化时不会继续显示旧结果的缓存图片", async () => {
    const { rerender } = render(sheet());
    await screen.findByRole("img");
    const changed = {
      ...result,
      code: "BBBBBBBBBBBB",
      persona: { ...result.persona, motto: "行遍山河" },
    };
    rerender(
      <QuizShareSheet open onOpenChange={onOpenChange} result={changed} />,
    );
    await screen.findByRole("img");
    expect(renderShareCard).toHaveBeenCalledTimes(2);
    expect(renderShareCard).toHaveBeenLastCalledWith(
      expect.objectContaining({ motto: "行遍山河" }),
      "light",
    );
  });

  it("保存时先把链接接入页面，延迟释放下载地址", async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:quiz-download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revoke,
    });
    const clicked: Array<{
      connected: boolean;
      href: string;
      filename: string;
    }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({
        connected: this.isConnected,
        href: this.href,
        filename: this.download,
      });
    });
    render(sheet());
    await screen.findByRole("img");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "card.save" }));
    expect(clicked).toEqual([
      {
        connected: true,
        href: "blob:quiz-download",
        filename: "hetu-quiz-AAAAAAAAAAAA.png",
      },
    ]);
    expect(revoke).not.toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(revoke).toHaveBeenCalledWith("blob:quiz-download");
  });

  it("Blob 构造不可用时仍保留 data URL 下载与预览", async () => {
    vi.stubGlobal("Blob", undefined);
    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      href = this.href;
    });
    render(sheet());
    expect((await screen.findByRole("img")).getAttribute("src")).toBe(PNG);
    fireEvent.click(screen.getByRole("button", { name: "card.save" }));
    expect(href).toBe(PNG);
    expect(screen.queryByRole("button", { name: "card.share" })).toBeNull();
  });

  it("支持文件分享时传递生成的 PNG 文件", async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });
    render(sheet());
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "card.share" }));
    expect(share).toHaveBeenCalledWith({
      files: [
        expect.objectContaining({
          name: "hetu-quiz-AAAAAAAAAAAA.png",
          type: "image/png",
        }),
      ],
    });
  });

  it("真正的 PNG 导出错误保留阶段日志与复制链接入口", async () => {
    vi.mocked(canvas.toDataURL).mockImplementation(() => {
      throw new DOMException("Tainted canvas", "SecurityError");
    });
    render(sheet());
    await screen.findByText("card.failed");
    expect(console.error).toHaveBeenCalledWith(
      "[QuizShareSheet] 生成分享图失败",
      expect.objectContaining({ stage: "export" }),
      expect.anything(),
    );
    expect(screen.queryByRole("button", { name: "card.retry" })).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "card.copyLink",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("面板关闭后完成的绘图不会更新预览", async () => {
    let finish!: (canvas: HTMLCanvasElement) => void;
    vi.mocked(renderShareCard).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = render(sheet());
    rerender(sheet(false));
    await act(async () => {
      finish(canvas);
    });
    expect(screen.queryByRole("img")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
