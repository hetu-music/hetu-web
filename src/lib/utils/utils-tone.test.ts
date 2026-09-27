import { describe, it, expect } from "vitest";
import { NEUTRAL_TONE, toneFromPixels } from "./utils-tone";

function pixels(...colors: Array<[number, number, number]>) {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

describe("toneFromPixels", () => {
  it("取鲜明像素的色相，忽略大片留白", () => {
    const white: [number, number, number] = [250, 250, 250];
    const tone = toneFromPixels(
      pixels(white, white, white, white, [200, 40, 40], [190, 50, 45]),
    );
    expect(tone.hue).toBeLessThan(10);
    expect(tone.light).toMatch(/^hsl\(\d+ \d+% 36%\)$/);
  });

  it("跨 0° 的红色平均后仍是红色", () => {
    const tone = toneFromPixels(pixels([200, 30, 60], [200, 60, 30]));
    expect(tone.hue === 0 || tone.hue > 350 || tone.hue < 10).toBe(true);
  });

  it("灰阶封面退回中性色调", () => {
    expect(toneFromPixels(pixels([20, 20, 20], [128, 128, 128]))).toBe(
      NEUTRAL_TONE,
    );
  });
});
