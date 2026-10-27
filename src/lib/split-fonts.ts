/**
 * 按 unicode-range 切片加载的大字体（整包十几 MB，不能让页面一次下完）。
 *
 * 源文件在 assets/fonts，`pnpm fonts:split` 把它们切到 public/fonts/<dir>/：
 * 几百个分片加一份 result.css，页面只下载用到的字所在的分片。
 * family 必须与 globals.css 里 --font-kaiti 等字体栈中的名字一致。
 */
export const SPLIT_FONTS = [
  // 首屏就有楷体和刻本，分片切小一些：首页约 400KB + 260KB，代价是 CSS 更大、请求更多
  { source: "KaiTi.woff2", dir: "kaiti", family: "Hetu KaiTi", chunkKB: 20 },
  { source: "keben.woff2", dir: "keben", family: "Hetu Keben", chunkKB: 20 },
  // 等宽字体排在 Courier New 之后，只有中文字会落到这里，用工具默认的分片大小
  { source: "LXGWMono.woff2", dir: "lxgw-mono", family: "Hetu LXGW Mono" },
] as const satisfies readonly {
  source: string;
  dir: string;
  family: string;
  chunkKB?: number;
}[];

export const SPLIT_FONT_STYLESHEETS = SPLIT_FONTS.map(
  (font) => `/fonts/${font.dir}/result.css`,
);
