import { NextRequest, NextResponse } from "next/server";
import {
  BROWSER_CACHED_API_CACHE,
  NO_STORE_HEADERS,
} from "@/lib/server/cache-headers";
import { localeFromRequest } from "@/lib/server/request-locale";
import { getCachedLyricsLines } from "@/lib/server/service-lyrics-lines";

/**
 * 曲库页搜歌词用的数据：每首歌按句切好，按 ?locale= 的字形（docs/LIBRARY.md 阶段 5「1.」「2.」）。
 *
 * 地址固定，浏览器和 CDN 都缓存 6 小时。歌曲变动时 server-revalidate 清 CDN 上简繁两个地址
 * （客户端简体也明确带 ?locale=zh-CN，地址才对得上），浏览器里的等到期。
 */
export async function GET(req: NextRequest) {
  const locale = localeFromRequest(req);
  try {
    const entries = await getCachedLyricsLines(locale);
    return NextResponse.json(entries, {
      headers: { "Cache-Control": BROWSER_CACHED_API_CACHE },
    });
  } catch (err) {
    console.error("Failed to load lyrics lines:", err);
    return NextResponse.json(
      { error: "failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
