import { NextResponse } from "next/server";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import { processLyricsForSearch } from "@/lib/utils/utils-song";

// 歌词索引 API - 仅返回 id 和处理后的纯文本歌词
// 供前端异步拉取，用于本地歌词全文搜索
export const GET = async () => {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not available" },
      { status: 500 },
    );
  }

  // 必须走 fetchAll 分页：PostgREST 单次最多返回 1000 行，直接 select
  // 会在曲库超过 1000 首有歌词的歌之后静默截断，前端搜索再也搜不到后面的歌。
  const rows = await fetchAll<{ id: number; lyrics: string | null }>(
    supabase,
    TABLES.MUSIC,
    "id,lyrics",
    (q) => q.not("lyrics", "is", null).order("id", { ascending: true }),
  );

  // 处理 LRC 歌词为纯文本
  const index = rows
    .map((row) => ({
      id: row.id,
      l: processLyricsForSearch(row.lyrics),
    }))
    .filter((entry) => entry.l.length > 0);

  return NextResponse.json(index, {
    headers: {
      // CDN 缓存 6 小时，客户端缓存 30 分钟
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=1800",
    },
  });
};

// ISR - 每 2 小时重新生成
export const revalidate = 7200;
