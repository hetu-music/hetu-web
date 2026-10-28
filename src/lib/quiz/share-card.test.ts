// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderShareCard, type ShareCardInput } from "./share-card";

const input: ShareCardInput = {
  eyebrow: "你的气韵",
  motto: "仰观天象",
  secondary: "兼有 · 行遍山河",
  description: "一场雨、一轮月，于你都是心事的形状。",
  imageryLabel: "你偏爱的意象",
  profileLabel: "意象倾向",
  dimensions: [
    { label: "天象", z: 2 },
    { label: "山河", z: 1 },
  ],
  imagery: ["月", "山"],
  matchesLabel: "为你寻得",
  matchLabel: "契合",
  matches: [
    {
      title: "测试曲目",
      meta: "河图 · 测试专辑",
      percent: 80,
      coverUrl: "https://cover.hetu-music.com/cover/1.jpg",
      lyric: "一行用于测试的歌词",
    },
  ],
  siteName: "河图作品勘鉴",
  tagline: "一段旅程，寻一首懂你的歌",
  qrUrl: "https://hetu-music.com/zh-CN/quiz",
  displayUrl: "hetu-music.com",
};

let nativeRoundRect: boolean;
let imageOutcome: "load" | "error" | "pending";
let contexts: ReturnType<typeof makeContext>[];
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");

function setFonts(value: unknown) {
  Object.defineProperty(document, "fonts", { configurable: true, value });
}

function makeContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    roundRect: nativeRoundRect ? vi.fn() : undefined,
    fill: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: [...text].length * 30 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
}

beforeEach(() => {
  nativeRoundRect = true;
  imageOutcome = "load";
  contexts = [];
  setFonts({ load: vi.fn(async () => []) });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      const context = makeContext(this);
      contexts.push(context);
      return context as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement["getContext"],
  );
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        Promise.resolve().then(() => {
          if (imageOutcome === "load") this.onload?.();
          if (imageOutcome === "error") this.onerror?.();
        });
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
  else Reflect.deleteProperty(document, "fonts");
});

describe("renderShareCard compatibility", () => {
  it.each(["light", "dark"] as const)(
    "%s：缺少 roundRect 也能完成倾向条、封面和二维码绘制",
    async (theme) => {
      nativeRoundRect = false;
      const canvas = await renderShareCard(input, theme);
      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBeGreaterThanOrEqual(2340);
      expect(canvas.height).toBeLessThanOrEqual(3200);
      expect(contexts[0].arcTo).toHaveBeenCalled();
      expect(contexts[0].fillText).toHaveBeenCalledWith(
        input.motto,
        expect.any(Number),
        expect.any(Number),
      );
    },
  );

  it("某种字体下载失败时仍用可用字体完成绘制", async () => {
    setFonts({
      load: vi
        .fn()
        .mockRejectedValueOnce(new Error("字体解码失败"))
        .mockResolvedValue([]),
    });
    const canvas = await renderShareCard(input, "light");
    expect(canvas.width).toBe(1080);
    expect(contexts[0].fillText).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("没有 FontFaceSet API 时直接使用浏览器的可用字体", async () => {
    setFonts(undefined);
    await expect(renderShareCard(input, "light")).resolves.toBeTruthy();
  });

  it("字体 load 同步抛出异常时也能继续绘图", async () => {
    setFonts({
      load: () => {
        throw new SyntaxError("不支持的字体声明");
      },
    });
    await expect(renderShareCard(input, "light")).resolves.toBeTruthy();
  });

  it("封面加载失败时生成占位图，不影响导出", async () => {
    imageOutcome = "error";
    const canvas = await renderShareCard(input, "dark");
    expect(canvas.width).toBe(1080);
    expect(contexts[0].drawImage).not.toHaveBeenCalled();
  });

  it("字体和封面一直不响应时在有限时间后降级绘制", async () => {
    vi.useFakeTimers();
    imageOutcome = "pending";
    setFonts({ load: () => new Promise(() => undefined) });
    let completed = false;
    const rendering = renderShareCard(input, "light").then(() => {
      completed = true;
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(completed).toBe(true);
    await rendering;
  });

  it("没有 Canvas 2D 时保留真正的绘图错误", async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(renderShareCard(input, "light")).rejects.toThrow("Canvas 2D");
  });
});

describe("renderShareCard complete layout", () => {
  const dimensions = [
    { label: "天象", z: 0.75 },
    { label: "典故", z: 0.75 },
    { label: "器用", z: 0.58 },
    { label: "楼台", z: 0.46 },
    { label: "山河", z: 0 },
    { label: "草木", z: -0.21 },
    { label: "人间", z: -0.35 },
    { label: "情思", z: -0.81 },
    { label: "光阴", z: -1.36 },
  ];
  const imagery = ["月", "雪", "江河", "花", "柳", "酒", "灯", "梦"];
  const fullInput: ShareCardInput = {
    ...input,
    dimensions,
    imagery,
    matches: ["明月如霜", "长夜梦我", "如梦", "宁作我", "蝉不知雪"].map(
      (title) => ({ ...input.matches[0], title }),
    ),
  };

  it.each(["stacked", "split"] as const)(
    "%s：八个意象、九项正负倾向、五首歌曲均完整绘制",
    async (layout) => {
      const canvas = await renderShareCard(fullInput, "light", layout);
      const texts = contexts[0].fillText.mock.calls.map(([text]) => text);
      for (const word of imagery) expect(texts).toContain(word);
      for (const dimension of dimensions)
        expect(texts).toContain(dimension.label);
      for (const match of fullInput.matches)
        expect(texts).toContain(match.title);
      expect(texts).toContain(fullInput.matches[4].lyric);
      expect(texts).not.toContain(fullInput.matches[4].meta);
      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBeLessThanOrEqual(3200);
    },
  );

  it("歌曲与原版一样只显示一句歌词，没有歌词才显示署名和专辑", async () => {
    const matches = fullInput.matches.map((match, i) => ({
      ...match,
      meta: `曲目${i + 1}的原始署名`,
      lyric: i === 4 ? null : `曲目${i + 1}的摘句`,
    }));
    await renderShareCard({ ...fullInput, matches }, "light");
    const texts = contexts[0].fillText.mock.calls.map(([text]) => text);
    for (const match of matches.slice(0, 4)) {
      expect(texts).toContain(match.lyric);
      expect(texts).not.toContain(match.meta);
    }
    expect(texts).toContain(matches[4].meta);
    expect(texts).toContain(matches[4].title);
  });

  it("默认左右排：意象在左，九项维度在右，并保留结果顺序", async () => {
    await renderShareCard(fullInput, "light");
    const calls = contexts[0].fillText.mock.calls;
    const last = (text: string) => {
      const call = calls.filter(([value]) => value === text).at(-1);
      if (!call) throw new Error(`没有绘制文字: ${text}`);
      return call;
    };
    for (const word of imagery) expect(last(word)[1]).toBeLessThan(416);
    for (const dimension of dimensions)
      expect(last(dimension.label)[1]).toBe(480);
    expect(last("天象")[2]).toBeLessThan(last("典故")[2]);
    expect(last("典故")[2]).toBeLessThan(last("光阴")[2]);
    expect(last("光阴")[2]).toBeLessThan(last("明月如霜")[2]);
  });

  it("左右倾向条以零为中心，负值向左、正值向右，零值只留轨道", async () => {
    await renderShareCard(fullInput, "light");
    const rounded = contexts[0].roundRect;
    if (!rounded) throw new Error("测试环境缺少 roundRect mock");
    const trackLeft = 564;
    const trackWidth = 420;
    const center = trackLeft + trackWidth / 2;
    const tracks = rounded.mock.calls.filter(
      ([x, , width, height]) =>
        x === trackLeft && width === trackWidth && height === 8,
    );
    expect(tracks).toHaveLength(dimensions.length * 2);
    for (let i = 0; i < dimensions.length; i += 1) {
      const [, y] = tracks[i];
      const bars = rounded.mock.calls.filter(
        ([, barY, width, height]) =>
          barY === y && width < trackWidth && height === 8,
      );
      const value = dimensions[i].z;
      if (value === 0) {
        expect(bars).toHaveLength(0);
      } else {
        const [x, , width] = bars[0];
        expect(width).toBeCloseTo(((Math.abs(value) / 2.5) * trackWidth) / 2);
        expect(value > 0 ? x : x + width).toBeCloseTo(center);
      }
    }
  });

  it.each([8, 9, 10, 11, 12])(
    "%i 个意象：九个起每行最多三词，十二个以内最多四行",
    async (count) => {
      const words = [
        "风",
        "月",
        "雪",
        "雨",
        "山",
        "江河",
        "花",
        "柳",
        "马",
        "酒",
        "灯",
        "剑",
      ].slice(0, count);
      await renderShareCard({ ...fullInput, imagery: words }, "light");
      const calls = contexts[0].fillText.mock.calls;
      const lastPass = calls.findLastIndex(
        ([text]) => text === fullInput.eyebrow,
      );
      const drawn = calls
        .slice(lastPass)
        .filter(([text]) => words.includes(text));
      expect(drawn.map(([text]) => text)).toEqual(words);
      const rows = new Map<number, typeof drawn>();
      for (const draw of drawn) {
        const row = rows.get(draw[2]) ?? [];
        row.push(draw);
        rows.set(draw[2], row);
      }
      expect(rows.size).toBe(Math.ceil(count / (count >= 9 ? 3 : 2)));
      expect(rows.size).toBeLessThanOrEqual(4);
      for (const row of rows.values()) {
        expect(row.length).toBeLessThanOrEqual(count >= 9 ? 3 : 2);
        for (const [text, x] of row) {
          expect(x).toBeGreaterThanOrEqual(96);
          expect(x + [...text].length * 30).toBeLessThanOrEqual(416);
        }
      }
    },
  );

  it("十四个意象仍保持完整词，不拆开多字母题", async () => {
    const words = [
      "风",
      "月",
      "雪",
      "雨",
      "山",
      "江河",
      "花",
      "柳",
      "马",
      "酒",
      "灯",
      "剑",
      "梦",
      "楼",
    ];
    const canvas = await renderShareCard(
      { ...fullInput, imagery: words },
      "dark",
    );
    const texts = contexts[0].fillText.mock.calls.map(([text]) => text);
    for (const word of words) expect(texts).toContain(word);
    expect(texts).not.toContain("江");
    expect(texts).not.toContain("河");
    expect(canvas.height).toBeLessThanOrEqual(3200);
  });

  it("没有意象时仍完整保留九项维度与第五首歌", async () => {
    await renderShareCard({ ...fullInput, imagery: [] }, "light");
    const texts = contexts[0].fillText.mock.calls.map(([text]) => text);
    for (const dimension of dimensions)
      expect(texts).toContain(dimension.label);
    expect(texts).toContain("蝉不知雪");
  });
});
