import { NextRequest, NextResponse } from "next/server";
import {
  IMMUTABLE_API_CACHE,
  SHORT_PUBLIC_API_CACHE,
} from "@/lib/server/cache-headers";
import { localeFromRequest } from "@/lib/server/request-locale";
import {
  getCurrentLyricsLines,
  VERSION_MATCH_HEADER,
} from "@/lib/server/service-lyrics-lines";

/**
 * 曲库页搜歌词用的数据：每首歌按句切好，按 ?locale= 的字形（docs/LIBRARY.md 阶段 5「1.」「2.」）。
 *
 * 始终返回当前数据。?v= 是首页带出来的版本号：和当前数据的版本号对得上，才按「不会再变」
 * 长缓存（浏览器、CDN、Service Worker）。对不上（首页是 ISR，带出去的可能还是旧的）就只短暂缓存，
 * 免得把新数据记在旧地址下、或者把旧数据记在新地址下。所以 server-revalidate 不必为它清 CDN。
 */
export async function GET(req: NextRequest) {
  const locale = localeFromRequest(req);
  try {
    const { version, entries } = await getCurrentLyricsLines(locale);
    const matches = req.nextUrl.searchParams.get("v") === version;
    return NextResponse.json(entries, {
      headers: {
        "Cache-Control": matches ? IMMUTABLE_API_CACHE : SHORT_PUBLIC_API_CACHE,
        [VERSION_MATCH_HEADER]: matches ? "1" : "0",
      },
    });
  } catch (err) {
    console.error("Failed to load lyrics lines:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
