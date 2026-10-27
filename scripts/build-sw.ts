/* eslint-disable no-console */
/**
 * Standalone Serwist Service Worker Build Script (Turbopack Compatible)
 *
 * We compile src/sw.ts using esbuild to resolve all ESM imports and types,
 * then we use injectManifest from @serwist/build to inject pre-cache assets.
 */

import { injectManifest, type ManifestEntry } from "@serwist/build";
import { build } from "esbuild";
import * as fs from "fs";
import * as path from "path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");

async function buildServiceWorker(): Promise<void> {
  console.log("🔧 开始构建 Serwist Service Worker (Turbopack 兼容模式)...");

  // 1. 安全检查: 确保 public 目录存在
  if (!fs.existsSync(publicDir)) {
    console.error("❌ 错误: public 目录不存在");
    process.exit(1);
  }

  const tempSwPath = path.join(publicDir, "sw-temp.js");

  try {
    // 2. 使用 esbuild 将 src/sw.ts 编译并打包为单个 js 文件，合并所有三方依赖
    await build({
      entryPoints: ["src/sw.ts"],
      outfile: tempSwPath,
      bundle: true,
      minify: true,
      platform: "browser",
      format: "iife", // 使用立即执行函数 (IIFE) 格式以实现最大兼容性
      target: "es2020",
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "production",
        ),
      },
    });

    const additionalManifestEntries: ManifestEntry[] = [];

    // 可选: manifest.json（静态文件，适合预缓存）
    const manifestPath = path.join(publicDir, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      additionalManifestEntries.push({
        url: "/manifest.json",
        revision: fs.statSync(manifestPath).mtimeMs.toString(),
      });
    }

    // 3. 将清单注入到打包后的临时文件中，并输出到最终的 sw.js
    const swDest = path.join(publicDir, "sw.js");
    const { count, size, warnings } = await injectManifest({
      swSrc: tempSwPath, // 读取打包好的临时文件
      swDest: "public/sw.js",
      globDirectory: "public",
      // 扫描 public 目录下的静态资源
      // 只预缓存 PWA 图标。不要加 fonts/：next/font/local 会把字体复制到
      // /_next/static/media/<hash>.woff2，页面从不请求 /fonts/*，预缓存的副本
      // 永远用不上，却让首次访问多下 24MB（由下方 /_next/static/ 运行时缓存兜底）。
      // source.png（2048² 原图）只给 OG 分享卡用，也不预缓存
      globPatterns: ["icons/icon-*.png"],
      globIgnores: [
        "**/node_modules/**/*",
        "**/*.map",
        "**/sw.js",
        "**/sw.js.map",
        "**/mockServiceWorker.js",
        "**/.DS_Store",
      ],
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      additionalPrecacheEntries: additionalManifestEntries,
    });

    // 4. 清理临时生成的打包文件
    if (fs.existsSync(tempSwPath)) {
      fs.unlinkSync(tempSwPath);
    }

    if (warnings.length > 0) {
      console.warn("⚠️ 生成过程有警告:");
      warnings.forEach((w) => console.warn(`  - ${w}`));
    }

    console.log(`✅ Service Worker 构建成功!`);
    console.log(`   位置: ${swDest}`);
    console.log(`   预缓存: ${count} 个文件, ${(size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("❌ 构建失败:", error);
    if (fs.existsSync(tempSwPath)) {
      fs.unlinkSync(tempSwPath);
    }
    process.exit(1);
  }
}

buildServiceWorker();
