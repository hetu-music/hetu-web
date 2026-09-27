/**
 * 从封面像素提取整页的主色调：只取色相与饱和度，明度按深浅主题固定，
 * 保证无论封面多亮多暗，强调色放在页面上都可读。
 */

export interface CoverTone {
  hue: number;
  saturation: number;
  /** 浅色主题下的强调色 */
  light: string;
  /** 深色主题下的强调色 */
  dark: string;
  /** 大面积铺底用，自带透明度 */
  wash: string;
}

/** 封面几乎无彩色（黑白、灰调）时的中性色调 */
export const NEUTRAL_TONE: CoverTone = toneFrom(220, 0.12);

function toneFrom(hue: number, saturation: number): CoverTone {
  const h = Math.round(hue);
  const s = Math.round(Math.min(Math.max(saturation, 0.12), 0.55) * 100);
  const sWash = Math.round(Math.min(saturation, 0.6) * 100);
  return {
    hue: h,
    saturation,
    light: `hsl(${h} ${s}% 36%)`,
    dark: `hsl(${h} ${Math.min(s + 10, 65)}% 72%)`,
    wash: `hsl(${h} ${sWash}% 55% / 0.16)`,
  };
}

/**
 * @param data RGBA 像素（getImageData().data）
 *
 * 以「饱和度 × 离纯黑纯白的距离」加权平均色相：鲜明的中间调决定色调，
 * 大片留白、暗部与灰色几乎不参与。色相用单位向量求平均，避免 350° 与 10° 平均成 180°。
 */
export function toneFromPixels(data: Uint8ClampedArray): CoverTone {
  let x = 0;
  let y = 0;
  let weightSum = 0;
  let satSum = 0;
  let pixels = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    pixels += 1;
    if (d === 0) continue;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    const w = s * (1 - Math.abs(2 * l - 1));
    const rad = (h * Math.PI) / 180;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
    weightSum += w;
    satSum += s * w;
  }

  if (pixels === 0 || weightSum / pixels < 0.04) return NEUTRAL_TONE;
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return toneFrom(hue, satSum / weightSum);
}

/** 把已加载的图片缩成小图取色；同源图片（next/image 优化地址）才能读取像素 */
export function toneFromImage(img: HTMLImageElement): CoverTone | null {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return toneFromPixels(ctx.getImageData(0, 0, size, size).data);
  } catch {
    // 跨域图片会污染画布，读取像素时抛 SecurityError
    return null;
  }
}
