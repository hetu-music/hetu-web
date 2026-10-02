/* eslint-disable no-console */
/**
 * 《倾尽天下》滚动叙事的素材管线。
 *
 * 原图放在 assets/story/qjtx/<id>.*（不发布），本脚本生成：
 *   public/story/qjtx/<id>/w<宽>.<hash>.avif   几档宽度，按设备选用
 *   public/story/qjtx/<id>/depth.<hash>.png     深度图，给视差用
 *   src/components/story/qjtx/assets.manifest.json  前端只读这份清单
 *
 * 换高清图：替换原图后重跑本脚本即可，场景配置里的坐标都是 0..1 比例，不用改。
 *
 * 用法：pnpm qjtx:assets [id...]   不给 id 就处理全部原图
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "assets", "story", "qjtx");
const OUTPUT_DIR = path.join(ROOT, "public", "story", "qjtx");
const MANIFEST = path.join(
  ROOT,
  "src",
  "components",
  "story",
  "qjtx",
  "assets.manifest.json",
);

const WIDTHS = [1280, 1920, 2560];
/** 深度图不需要原图那么细：视差只用到它的低频起伏 */
const DEPTH_WIDTH = 1024;
/** 小模型几秒一张；要更细的深度可换 onnx-community/depth-anything-v2-base */
const DEPTH_MODEL = "onnx-community/depth-anything-v2-small";

export interface PlateAsset {
  width: number;
  height: number;
  /** 由小到大 */
  variants: { width: number; src: string }[];
  depth: string;
  /** 几百字节的模糊缩略图，高清图没到时先垫着 */
  placeholder: string;
}

type Manifest = Record<string, PlateAsset>;

const hash = (buf: Buffer) =>
  createHash("sha256").update(buf).digest("hex").slice(0, 8);

async function estimateDepth(file: string): Promise<Buffer> {
  // 只有脚本用得到，按需加载，免得平时跑别的脚本也要初始化 onnxruntime
  const { pipeline, RawImage } = await import("@huggingface/transformers");
  const estimator = await pipeline("depth-estimation", DEPTH_MODEL, {
    dtype: "fp32",
  });
  // 先转成 PNG 再交给 RawImage：它读 AVIF 不稳
  const png = await sharp(file).png().toBuffer();
  const image = await RawImage.fromBlob(new Blob([new Uint8Array(png)]));
  const output = await estimator(image);
  const result = Array.isArray(output) ? output[0] : output;
  const depth = result.depth as InstanceType<typeof RawImage>;
  return sharp(Buffer.from(depth.data), {
    raw: { width: depth.width, height: depth.height, channels: 1 },
  })
    .resize(DEPTH_WIDTH)
    // 深度边缘若太硬，视差会把人物轮廓撕开
    .blur(1.2)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function processPlate(id: string, file: string): Promise<PlateAsset> {
  const outDir = path.join(OUTPUT_DIR, id);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const meta = await sharp(file).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const widths = WIDTHS.filter((w) => w < width);
  // 原图比最小一档还窄时，至少保留原尺寸这一档
  if (widths.length === 0 || width < WIDTHS[WIDTHS.length - 1]) {
    widths.push(width);
  }

  const variants: PlateAsset["variants"] = [];
  for (const w of [...new Set(widths)].sort((a, b) => a - b)) {
    const buf = await sharp(file)
      .resize(w)
      .avif({ quality: 62, effort: 6 })
      .toBuffer();
    const name = `w${w}.${hash(buf)}.avif`;
    fs.writeFileSync(path.join(outDir, name), buf);
    variants.push({ width: w, src: `/story/qjtx/${id}/${name}` });
    console.log(`  ${name}  ${(buf.length / 1024).toFixed(0)} KB`);
  }

  console.log("  深度图…");
  const depthBuf = await estimateDepth(file);
  const depthName = `depth.${hash(depthBuf)}.png`;
  fs.writeFileSync(path.join(outDir, depthName), depthBuf);
  console.log(`  ${depthName}  ${(depthBuf.length / 1024).toFixed(0)} KB`);

  const tiny = await sharp(file)
    .resize(32)
    .blur(0.6)
    .webp({ quality: 50 })
    .toBuffer();

  return {
    width,
    height,
    variants,
    depth: `/story/qjtx/${id}/${depthName}`,
    placeholder: `data:image/webp;base64,${tiny.toString("base64")}`,
  };
}

async function main() {
  const wanted = new Set(process.argv.slice(2));
  const sources = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => /\.(avif|png|jpe?g|webp|tiff?)$/i.test(f))
    .map((f) => ({ id: path.parse(f).name, file: path.join(SOURCE_DIR, f) }))
    .filter(({ id }) => wanted.size === 0 || wanted.has(id));

  const manifest: Manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
    : {};

  for (const { id, file } of sources) {
    console.log(`#${id}`);
    manifest[id] = await processPlate(id, file);
  }

  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => Number(a) - Number(b)),
  );
  fs.writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`清单已写入 ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
