import { encode } from "uqr";

/**
 * 测验结果的分享图：在浏览器里用 Canvas 画出一张竖版长图，底部带扫码进入测验的二维码。
 *
 * 不用服务端 next/og：satori 不认 woff2，站里的刻本、楷体又都是几 MB 的整包字体；
 * 页面上这些字体已经加载好了，直接在客户端画最省事，也不会有截 DOM 那类 Safari 字体问题。
 */

export type ShareCardTheme = "light" | "dark";
/** 两种完整排版共用字号和歌曲列表，便于用同一结果比较可读性。 */
export type ShareCardLayout = "stacked" | "split";

export type ShareCardInput = {
  eyebrow: string;
  motto: string;
  secondary: string | null;
  description: string;
  imageryLabel: string;
  profileLabel: string;
  /** 按结果顺序保留全部维度，正、负倾向都画在以零为中心的条形中。 */
  dimensions: Array<{ label: string; z: number }>;
  imagery: string[];
  matchesLabel: string;
  matchLabel: string;
  matches: Array<{
    title: string;
    meta: string;
    percent: number;
    coverUrl: string;
    /** 印证契合的一句歌词，没有时退回显示 meta */
    lyric: string | null;
  }>;
  siteName: string;
  /** 落款下的一句话 */
  tagline: string;
  /** 二维码指向的地址 */
  qrUrl: string;
  /** 印在二维码旁边给人看的地址，只写域名 */
  displayUrl: string;
};

/** 与结果页同一套颜色（slate 色阶 + 测验页的金色强调） */
const PALETTE: Record<
  ShareCardTheme,
  {
    bg: string;
    title: string;
    body: string;
    lyric: string;
    meta: string;
    accent: string;
    line: string;
    cover: string;
    qrTile: string | null;
    qrDot: string;
  }
> = {
  light: {
    bg: "#FAFAFA",
    title: "#0f172a",
    body: "#475569",
    lyric: "#475569",
    meta: "#94a3b8",
    accent: "#9A6B2F",
    line: "#e2e8f0",
    cover: "#e2e8f0",
    qrTile: null,
    qrDot: "#0f172a",
  },
  dark: {
    bg: "#0B0F19",
    title: "#ffffff",
    body: "#94a3b8",
    lyric: "#cbd5e1",
    meta: "#64748b",
    accent: "#D4A259",
    line: "#1e293b",
    cover: "#1e293b",
    // 反色二维码不少扫码器认不出，深色卡片上仍垫一块浅底
    qrTile: "#f1f5f9",
    qrDot: "#0B0F19",
  },
};

type Palette = (typeof PALETTE)[ShareCardTheme];

const WIDTH = 1080;
/** iPhone 13–16 全面屏的 19.5:9（如 1179×2556），存进相册点开正好铺满一屏 */
const HEIGHT = 2340;
const PAD = 96;
const INNER = WIDTH - PAD * 2;
/** 先画在足够高的画布上再裁下来；内容实在太多时图片可以比全屏长，但不超过这个高度 */
const MAX_HEIGHT = 3200;
const QR_SIZE = 140;
/** 深色卡片上二维码浅底的留边 */
const QR_TILE_PAD = 10;
const COVER_SIZE = 148;
/** 字体或封面不可用时继续出图，避免分享面板一直等待网络。 */
const ASSET_TIMEOUT_MS = 8_000;

/** 不宜出现在行首的标点 */
const NO_LINE_START = "，。、；：！？）」』》〉,.;:!?)";

type Fonts = {
  serif: string;
  kaiti: string;
  calligraphy: string;
  sans: string;
};

/**
 * next/font 生成的字体名带哈希，只能从页面上的 CSS 变量里读出来。
 * 自定义属性里的 var() 在计算值里已经展开，读到的就是完整的字体栈。
 */
function resolveFonts(): Fonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    serif: read("--font-serif", "serif"),
    kaiti: read("--font-kaiti", "serif"),
    calligraphy: read("--font-calligraphy", "serif"),
    sans: read("--font-sans", "sans-serif"),
  };
}

/** Canvas 不会自己去下载字体：按要画的字逐个触发加载，按 unicode-range 分片的字体才会取到对应分片 */
async function loadFonts(fonts: Fonts, input: ShareCardInput): Promise<Fonts> {
  if (typeof document.fonts?.load !== "function") return fonts;
  const serifText = [
    input.eyebrow,
    input.secondary ?? "",
    input.imageryLabel,
    input.profileLabel,
    ...input.dimensions.map((d) => d.label),
    input.matchesLabel,
    input.siteName,
    ...input.matches.map((m) => m.title + m.percent),
  ].join("");
  const sansText = [
    input.matchLabel,
    input.displayUrl,
    ...input.matches.map((m) => m.meta),
  ].join("");
  const texts: Record<keyof Fonts, string> = {
    serif: serifText,
    kaiti:
      input.description +
      input.tagline +
      input.matches.map((m) => m.lyric ?? "").join(""),
    calligraphy: input.motto + input.imagery.join(""),
    sans: sansText,
  };
  const loaded = { ...fonts };
  await Promise.all(
    (Object.keys(texts) as (keyof Fonts)[]).map(
      (key) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            if (error) {
              // 固定使用备用字体，避免超时后字体迟到导致两次排版的测量不同。
              loaded[key] = key === "sans" ? "sans-serif" : "serif";
              console.warn("[share-card] 字体未就绪，使用备用字体", key, error);
            }
            resolve();
          };
          const timer = window.setTimeout(
            () => finish(new Error("字体加载超时")),
            ASSET_TIMEOUT_MS,
          );
          try {
            document.fonts.load(`48px ${fonts[key]}`, texts[key]).then(
              () => finish(),
              (error) => finish(error),
            );
          } catch (error) {
            finish(error);
          }
        }),
    ),
  );
  return loaded;
}

/**
 * 走 Next 的图片优化接口取封面：同源，画进 Canvas 不会污染画布，导出时才不报安全错误。
 * 取不到就返回 null，画一块空底代替。
 */
function loadCover(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (cover: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(cover);
    };
    const timer = window.setTimeout(() => finish(null), ASSET_TIMEOUT_MS);
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = `/_next/image?url=${encodeURIComponent(url)}&w=256&q=75`;
  });
}

/** 部分 WebView 没有 roundRect，用基础路径画相同的等半径圆角。 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // 旧版 Safari 没有 letterSpacing，忽略即可
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/**
 * 字距会加在每个字后面（含最后一个），居中时整体偏左半个字距；
 * 和结果页 `pl-[0.5em]` 的做法一样，往右补回来。
 */
function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  spacing = 0,
) {
  setSpacing(ctx, spacing);
  ctx.textAlign = "center";
  ctx.fillText(text, WIDTH / 2 + spacing / 2, y);
  setSpacing(ctx, 0);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > max) {
    end -= 1;
  }
  return `${text.slice(0, end)}…`;
}

/** 中文按字折行，标点不落到行首 */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (
      line &&
      ctx.measureText(next).width > max &&
      !NO_LINE_START.includes(char)
    ) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 按整栏宽折行；末行太短时逐字收窄行宽，把前面的字匀下来一些，
 * 不改变行数，也不像整段均分那样把整块收得太窄
 */
function wrapEven(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines = wrap(ctx, text, max);
  if (lines.length < 2) return lines;
  const step = ctx.measureText("字").width;
  let best = lines;
  let width = max;
  while (ctx.measureText(best[best.length - 1]).width < max * 0.35) {
    width -= step;
    const next = wrap(ctx, text, width);
    if (next.length > lines.length) break;
    best = next;
  }
  return best;
}

/** 细条满格对应的 z 分数，与结果页倾向条一致 */
const Z_RANGE = 2.5;

/** 缩短条长来容纳全部维度；不截掉负值，也不把零画成最小正值。 */
function drawDimensionBars(
  ctx: CanvasRenderingContext2D,
  dims: ShareCardInput["dimensions"],
  left: number,
  top: number,
  width: number,
  columns: number,
  rowH: number,
  colors: Palette,
  fonts: Fonts,
): number {
  if (dims.length === 0) return top;
  const columnGap = 48;
  const columnW = (width - (columns - 1) * columnGap) / columns;
  const labelW = 84;
  const trackW = columnW - labelW;
  dims.forEach((d, i) => {
    const x = left + (i % columns) * (columnW + columnGap);
    const y = top + Math.floor(i / columns) * rowH + 16;
    ctx.textAlign = "left";
    ctx.font = `400 32px ${fonts.serif}`;
    ctx.fillStyle = colors.body;
    setSpacing(ctx, 4);
    ctx.fillText(d.label, x, y + 11);
    setSpacing(ctx, 0);
    const trackLeft = x + labelW;
    const center = trackLeft + trackW / 2;
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    roundedRectPath(ctx, trackLeft, y - 4, trackW, 8, 4);
    ctx.fill();
    const barW = Math.min(Math.abs(d.z) / Z_RANGE, 1) * (trackW / 2);
    if (barW > 0) {
      ctx.fillStyle = d.z > 0 ? colors.accent : colors.body;
      ctx.globalAlpha = d.z > 0 ? 1 : 0.5;
      ctx.beginPath();
      roundedRectPath(
        ctx,
        d.z > 0 ? center : center - barW,
        y - 4,
        barW,
        8,
        Math.min(barW / 2, 4),
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = colors.meta;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(center - 0.5, y - 9, 1, 18);
    ctx.globalAlpha = 1;
  });
  return top + (Math.ceil(dims.length / columns) - 1) * rowH + 32;
}

/**
 * 保留词序，用实际字宽寻找均衡的分行，避免把「江河」拆开或让末行只剩一字。
 * 分行和绘制使用同一个 gap，不用全角空格代替间距。
 */
function imageryRows(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
  maxWords: number,
  gap: number,
): string[][] {
  if (words.length === 0) return [];
  const widths = words.map((word) => ctx.measureText(word).width);
  for (
    let rowCount = Math.ceil(words.length / maxWords);
    rowCount <= words.length;
    rowCount += 1
  ) {
    const ideal =
      (widths.reduce((sum, w) => sum + w, 0) +
        (words.length - rowCount) * gap) /
      rowCount;
    const memo = new Map<string, { cost: number; rows: string[][] } | null>();
    const solve = (
      start: number,
      remaining: number,
    ): { cost: number; rows: string[][] } | null => {
      if (remaining === 0)
        return start === words.length ? { cost: 0, rows: [] } : null;
      const key = `${start}:${remaining}`;
      if (memo.has(key)) return memo.get(key) ?? null;
      let best: { cost: number; rows: string[][] } | null = null;
      let width = 0;
      for (
        let count = 1;
        count <= maxWords && start + count <= words.length;
        count += 1
      ) {
        width += widths[start + count - 1] + (count > 1 ? gap : 0);
        if (width > maxWidth && count > 1) break;
        const tail = solve(start + count, remaining - 1);
        if (!tail) continue;
        const cost = (width - ideal) ** 2 + tail.cost;
        if (!best || cost < best.cost) {
          best = {
            cost,
            rows: [words.slice(start, start + count), ...tail.rows],
          };
        }
      }
      memo.set(key, best);
      return best;
    };
    const result = solve(0, rowCount);
    if (result) return result.rows;
  }
  return words.map((word) => [word]);
}

function drawImageryRows(
  ctx: CanvasRenderingContext2D,
  rows: string[][],
  left: number,
  top: number,
  width: number,
  size: number,
  gap: number,
  colors: Palette,
  fonts: Fonts,
): number {
  ctx.font = `400 ${size}px ${fonts.calligraphy}`;
  ctx.fillStyle = colors.title;
  ctx.textAlign = "left";
  const lineH = size + 24;
  rows.forEach((row, i) => {
    const widths = row.map((word) => ctx.measureText(word).width);
    const rowWidth =
      widths.reduce((sum, w) => sum + w, 0) + (row.length - 1) * gap;
    let x = left + (width - rowWidth) / 2;
    row.forEach((word, j) => {
      ctx.fillText(word, x, top + size + i * lineH);
      x += widths[j] + gap;
    });
  });
  return top + rows.length * lineH;
}

/** 左侧留给意象题字，右侧九项一列；较高的一栏决定整节高度。 */
function drawSplitProfile(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  top: number,
  colors: Palette,
  fonts: Fonts,
): number {
  if (input.imagery.length === 0 || input.dimensions.length === 0) {
    return drawStackedProfile(ctx, input, top, colors, fonts, (base) => base);
  }
  const leftW = 320;
  const columnGap = 64;
  const rightX = PAD + leftW + columnGap;
  const rightW = INNER - leftW - columnGap;
  // 九个起每行容纳三词；四个汉字加两处间距仍放得下「江河」所在的一行。
  const dense = input.imagery.length >= 9;
  const size = dense ? 64 : 72;
  const gap = dense ? 24 : 32;
  ctx.font = `400 ${size}px ${fonts.calligraphy}`;
  const rows = imageryRows(ctx, input.imagery, leftW, dense ? 3 : 2, gap);
  const imageryH = rows.length * (size + 24);
  const rowH = 44;
  const barsH = (input.dimensions.length - 1) * rowH + 32;
  const contentH = Math.max(imageryH, barsH);

  ctx.font = `400 26px ${fonts.serif}`;
  ctx.fillStyle = colors.meta;
  ctx.textAlign = "center";
  setSpacing(ctx, 6);
  ctx.fillText(input.imageryLabel, PAD + leftW / 2 + 3, top);
  ctx.fillText(input.profileLabel, rightX + rightW / 2 + 3, top);
  setSpacing(ctx, 0);
  const bodyTop = top + 64;
  drawImageryRows(
    ctx,
    rows,
    PAD,
    bodyTop + (contentH - imageryH) / 2,
    leftW,
    size,
    gap,
    colors,
    fonts,
  );
  drawDimensionBars(
    ctx,
    input.dimensions,
    rightX,
    bodyTop + (contentH - barsH) / 2,
    rightW,
    1,
    rowH,
    colors,
    fonts,
  );
  return bodyTop + contentH;
}

/** 上下版使用均衡意象行和两栏短条，同样保留全部九项。 */
function drawStackedProfile(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  top: number,
  colors: Palette,
  fonts: Fonts,
  flex: Flex,
): number {
  let y = top;
  if (input.imagery.length > 0) {
    const size = 72;
    const gap = 44;
    ctx.font = `400 ${size}px ${fonts.calligraphy}`;
    const rows = imageryRows(ctx, input.imagery, INNER, 5, gap);
    ctx.font = `400 26px ${fonts.serif}`;
    ctx.fillStyle = colors.meta;
    drawCentered(ctx, input.imageryLabel, y, 8);
    y = drawImageryRows(
      ctx,
      rows,
      PAD,
      y + 48,
      INNER,
      size,
      gap,
      colors,
      fonts,
    );
  }
  if (input.dimensions.length === 0) return y;
  y += input.imagery.length > 0 ? flex(48, 0.5) : 0;
  ctx.font = `400 26px ${fonts.serif}`;
  ctx.fillStyle = colors.meta;
  drawCentered(ctx, input.profileLabel, y, 8);
  return drawDimensionBars(
    ctx,
    input.dimensions,
    PAD,
    y + 56,
    INNER,
    2,
    52,
    colors,
    fonts,
  );
}

function hairline(ctx: CanvasRenderingContext2D, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(PAD, y, INNER, 2);
}

function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  colors: Palette,
) {
  const qr = encode(url, { ecc: "M", border: 0 });
  // 按整数像素对齐每个模块，扫码时边缘才干净
  const cell = Math.floor(QR_SIZE / qr.size);
  const size = cell * qr.size;
  const offset = Math.floor((QR_SIZE - size) / 2);
  if (colors.qrTile) {
    ctx.fillStyle = colors.qrTile;
    ctx.beginPath();
    roundedRectPath(
      ctx,
      x - QR_TILE_PAD,
      y - QR_TILE_PAD,
      QR_SIZE + QR_TILE_PAD * 2,
      QR_SIZE + QR_TILE_PAD * 2,
      12,
    );
    ctx.fill();
  }
  ctx.fillStyle = colors.qrDot;
  qr.data.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) {
        ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
      }
    }),
  );
}

/**
 * 可伸缩的间距：base 是内容自然排下时的间距，weight 决定多出（或不够）的高度分给它多少
 */
type Flex = (base: number, weight: number) => number;

/** 把整张卡画到 ctx 上，返回内容底边的 y */
function drawCard(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  colors: Palette,
  fonts: Fonts,
  covers: (HTMLImageElement | null)[],
  flex: Flex,
  layout: ShareCardLayout,
): number {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, WIDTH, ctx.canvas.height);
  ctx.textBaseline = "alphabetic";

  // ── 气韵 ──
  let y = flex(PAD, 1.5) + 26;
  ctx.font = `400 28px ${fonts.serif}`;
  ctx.fillStyle = colors.meta;
  drawCentered(ctx, input.eyebrow, y, 14);

  // 题字按宽度收字号，四五个字的也放得下
  let mottoSize = 190;
  ctx.font = `400 ${mottoSize}px ${fonts.calligraphy}`;
  while (mottoSize > 96 && ctx.measureText(input.motto).width > INNER) {
    mottoSize -= 8;
    ctx.font = `400 ${mottoSize}px ${fonts.calligraphy}`;
  }
  y += flex(36, 1) + mottoSize;
  ctx.fillStyle = colors.title;
  drawCentered(ctx, input.motto, y);

  if (input.secondary) {
    y += 68;
    ctx.font = `400 30px ${fonts.serif}`;
    ctx.fillStyle = colors.accent;
    drawCentered(ctx, input.secondary, y, 9);
  }

  ctx.font = `400 36px ${fonts.kaiti}`;
  ctx.fillStyle = colors.body;
  y += flex(32, 0.5);
  for (const line of wrapEven(ctx, input.description, INNER)) {
    y += 52;
    drawCentered(ctx, line, y);
  }

  // ── 意象与倾向 ──
  y += flex(56, 1);
  hairline(ctx, y, colors.line);
  y += flex(64, 1);
  y =
    layout === "split"
      ? drawSplitProfile(ctx, input, y, colors, fonts)
      : drawStackedProfile(ctx, input, y, colors, fonts, flex);

  // ── 契合歌曲 ──
  if (input.matches.length > 0) {
    y += flex(56, 1);
    hairline(ctx, y, colors.line);
    y += flex(68, 1);
    ctx.font = `400 26px ${fonts.serif}`;
    ctx.fillStyle = colors.meta;
    drawCentered(ctx, input.matchesLabel, y, 8);
    y += flex(40, 0.5);

    // 行距每处单独取，量高度时每一处的权重才都算得上
    let top = y;
    input.matches.forEach((match, i) => {
      if (i > 0) top += COVER_SIZE + flex(28, 0.5);
      const cover = covers[i];
      ctx.save();
      ctx.beginPath();
      roundedRectPath(ctx, PAD, top, COVER_SIZE, COVER_SIZE, 8);
      ctx.clip();
      ctx.fillStyle = colors.cover;
      ctx.fillRect(PAD, top, COVER_SIZE, COVER_SIZE);
      if (cover) ctx.drawImage(cover, PAD, top, COVER_SIZE, COVER_SIZE);
      ctx.restore();

      const right = WIDTH - PAD;
      ctx.textAlign = "right";
      ctx.font = `400 60px ${fonts.serif}`;
      ctx.fillStyle = colors.accent;
      const percentText = String(match.percent);
      ctx.fillText(percentText, right - 30, top + 84);
      const percentWidth = ctx.measureText(percentText).width + 30;
      ctx.font = `400 24px ${fonts.sans}`;
      ctx.fillStyle = colors.meta;
      ctx.fillText("%", right, top + 84);
      setSpacing(ctx, 4);
      // 右对齐时末尾的字距也算进宽度，补回去才和上面的「%」对齐
      ctx.fillText(input.matchLabel, right + 4, top + 124);
      setSpacing(ctx, 0);

      const textLeft = PAD + COVER_SIZE + 36;
      const textMax = right - percentWidth - 40 - textLeft;
      ctx.textAlign = "left";
      ctx.font = `400 44px ${fonts.serif}`;
      ctx.fillStyle = colors.title;
      ctx.fillText(truncate(ctx, match.title, textMax), textLeft, top + 62);
      if (match.lyric) {
        // 与结果页一样，歌词前一道淡金色竖线
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = colors.accent;
        ctx.fillRect(textLeft, top + 90, 3, 44);
        ctx.globalAlpha = 1;
        ctx.font = `400 34px ${fonts.kaiti}`;
        ctx.fillStyle = colors.lyric;
        ctx.fillText(
          truncate(ctx, match.lyric, textMax - 20),
          textLeft + 20,
          top + 125,
        );
      } else if (match.meta) {
        ctx.font = `400 24px ${fonts.sans}`;
        ctx.fillStyle = colors.meta;
        ctx.fillText(truncate(ctx, match.meta, textMax), textLeft, top + 118);
      }
    });
    y = top + COVER_SIZE;
  }

  // ── 落款与二维码 ──
  y += flex(56, 1);
  hairline(ctx, y, colors.line);
  y += 36 + (colors.qrTile ? QR_TILE_PAD : 0);
  // 有浅底时让底块而不是码本身贴齐右边距
  const qrX = WIDTH - PAD - QR_SIZE - (colors.qrTile ? QR_TILE_PAD : 0);
  drawQr(ctx, input.qrUrl, qrX, y, colors);

  ctx.textAlign = "left";
  ctx.font = `600 30px ${fonts.serif}`;
  ctx.fillStyle = colors.title;
  setSpacing(ctx, 6);
  ctx.fillText(input.siteName, PAD, y + 38);
  setSpacing(ctx, 0);
  ctx.font = `400 26px ${fonts.kaiti}`;
  ctx.fillStyle = colors.body;
  ctx.fillText(input.tagline, PAD, y + 84);
  ctx.font = `400 20px ${fonts.sans}`;
  ctx.fillStyle = colors.meta;
  setSpacing(ctx, 2);
  ctx.fillText(input.displayUrl, PAD, y + 124);
  setSpacing(ctx, 0);
  return y + QR_SIZE + (colors.qrTile ? QR_TILE_PAD : 0) + flex(56, 0.5);
}

export async function renderShareCard(
  input: ShareCardInput,
  theme: ShareCardTheme,
  layout: ShareCardLayout = "split",
): Promise<HTMLCanvasElement> {
  const colors = PALETTE[theme];
  const [covers, fonts] = await Promise.all([
    Promise.all(input.matches.map((m) => loadCover(m.coverUrl))),
    loadFonts(resolveFonts(), input),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = MAX_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D 不可用");

  // 先按自然间距排一遍量出高度，再把与目标高度的差额按权重摊进各处留白，重排一遍。
  // 内容偏多时间距最多收到六成；还放不下就让图片变长，不压字
  let weights = 0;
  const natural = drawCard(
    ctx,
    input,
    colors,
    fonts,
    covers,
    (base, w) => {
      weights += w;
      return base;
    },
    layout,
  );
  const slack = (HEIGHT - natural) / weights;
  const bottom = drawCard(
    ctx,
    input,
    colors,
    fonts,
    covers,
    (base, w) => Math.max(base * 0.6, base + slack * w),
    layout,
  );

  const out = document.createElement("canvas");
  out.width = WIDTH;
  // 留白分摊可能带来极小浮点尾差，避免本应 2340 的图片偶尔多出一像素。
  out.height = Math.min(Math.max(HEIGHT, Math.ceil(bottom - 1e-7)), MAX_HEIGHT);
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D 不可用");
  outCtx.fillStyle = colors.bg;
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(canvas, 0, 0);
  // 临时画布不再参与导出，及时释放它的像素缓冲。
  canvas.width = 0;
  canvas.height = 0;
  return out;
}
