import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { PUBLIC_API_CACHE, NO_STORE_HEADERS } from "@/lib/server/cache-headers";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import { LYRICS_LINES_TAG } from "@/lib/library/tags";
import { processLyricsForSearch } from "@/lib/utils/utils-song";

/**
 * 全部歌曲处理后的纯文本歌词。存进 Next 的数据缓存：接口是动态路由，
 * 在地址后面随便加个查询串就能绕过 CDN，不缓存的话每个请求都要读一遍全库歌词。
 * 和 lyrics-lines 共用标签，歌曲变动时一起失效。失败时抛错，unstable_cache 不缓存异常。
 */
const getLyricsIndex = unstable_cache(
  async () => {
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase not available");

    // 必须走 fetchAll 分页：PostgREST 单次最多返回 1000 行，直接 select
    // 会在曲库超过 1000 首有歌词的歌之后静默截断，前端搜索再也搜不到后面的歌。
    const rows = await fetchAll<{ id: number; lyrics: string | null }>(
      supabase,
      TABLES.MUSIC,
      "id,lyrics",
      (q) => q.not("lyrics", "is", null).order("id", { ascending: true }),
    );

    // 处理 LRC 歌词为纯文本
    return rows
      .map((row) => ({
        id: row.id,
        l: processLyricsForSearch(row.lyrics),
      }))
      .filter((entry) => entry.l.length > 0);
  },
  ["lyrics-index-v1"],
  { tags: [LYRICS_LINES_TAG] },
);

// 歌词索引 API - 仅返回 id 和处理后的纯文本歌词
// 旧版曲库页用于本地歌词全文搜索；新版用 lyrics-lines，阶段 6 删除（docs/LIBRARY.md）
export const GET = async () => {
  try {
    return NextResponse.json(await getLyricsIndex(), {
      headers: { "Cache-Control": PUBLIC_API_CACHE },
    });
  } catch (error) {
    console.error("Failed to load lyrics index:", error);
    return NextResponse.json(
      { error: "failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
};
