/* eslint-disable no-console */
/**
 * 把 assets/fonts 里的大字体切成按 unicode-range 加载的分片，输出到 public/fonts/<dir>/。
 * 字体清单见 src/lib/split-fonts.ts。产物提交进仓库，构建和部署时不跑这个脚本。
 *
 * cn-font-split 要另外下载原生库，不放进依赖（否则每次 pnpm install 都要连 GitHub）。
 * 第一次运行前先装一次：pnpm dlx cn-font-split@7.4.3 i default
 */

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { SPLIT_FONTS } from "../src/lib/split-fonts";

const CN_FONT_SPLIT = "cn-font-split@7.4.3";
const rootDir = process.cwd();

for (const font of SPLIT_FONTS) {
  const input = path.join(rootDir, "assets/fonts", font.source);
  const outDir = path.join(rootDir, "public/fonts", font.dir);

  const args = [
    "dlx",
    CN_FONT_SPLIT,
    "run",
    "-i",
    input,
    "-o",
    outDir,
    "--css.fontFamily",
    font.family,
    "--css.fontDisplay",
    "swap",
    "--css.commentUnicodes",
    "false",
    "--css.compress",
    "true",
    "--testHtml",
    "false",
    "--reporter",
    "false",
  ];
  if ("chunkKB" in font) args.push("-c", String(font.chunkKB * 1024));

  console.log(`✂️  ${font.source} → public/fonts/${font.dir}/`);
  // 7.4.3 的原生库在 Windows 上偶尔切完后退出时崩溃（0xC0000005），重跑即可
  let status: number | null = null;
  for (let attempt = 1; attempt <= 5 && status !== 0; attempt++) {
    if (attempt > 1) console.warn(`   退出码 ${status}，第 ${attempt} 次重试`);
    fs.rmSync(outDir, { recursive: true, force: true });
    // Windows 上 pnpm 是 .cmd，只能走 shell；shell 会按空格拆参数，字体名要加引号
    status = spawnSync(
      "pnpm",
      args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)),
      { stdio: "inherit", shell: true },
    ).status;
  }
  if (status !== 0) process.exit(status ?? 1);

  // 只保留分片和 CSS，工具附带的 index.proto 等不需要发布
  const files = fs.readdirSync(outDir);
  for (const file of files) {
    if (!/\.(woff2|css)$/.test(file)) fs.rmSync(path.join(outDir, file));
  }
  // 头部注释抄了字体的 name 表，有的字体里带 NUL，git 会把整个文件当成二进制
  const cssPath = path.join(outDir, "result.css");
  fs.writeFileSync(
    cssPath,
    fs.readFileSync(cssPath, "utf8").replaceAll("\0", ""),
  );
  const woff2 = files.filter((file) => file.endsWith(".woff2"));
  const bytes = woff2.reduce(
    (sum, file) => sum + fs.statSync(path.join(outDir, file)).size,
    0,
  );
  console.log(
    `   ${woff2.length} 个分片，共 ${(bytes / 1024 / 1024).toFixed(1)} MB`,
  );
}
