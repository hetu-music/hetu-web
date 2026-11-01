import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { Locale } from "@/i18n/config";
import { LYRICS_LINES_TAG } from "@/lib/library/tags";
import type { LyricsLinesEntry } from "@/lib/search/corpus";
import { toTraditional } from "@/lib/utils/utils-convert";
import { buildFolio } from "@/lib/utils/utils-folio";

/**
 * 曲库页搜歌词用的数据（docs/LIBRARY.md 阶段 5「1.」）：每首歌按句切好，按页面字形。
 *
 * 句子用 buildFolio 切，传入歌名和 lyrics_start，去掉开头的署名区与说明行，
 * 句号和详情页一致（阶段 7 点片段跳到那一句要用）。繁体逐句转换，句数不变。
 */
export async function getLyricsLines(
  locale: Locale,
): Promise<LyricsLinesEntry[]> {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("Supabase not available");

  // 必须走 fetchAll 分页：PostgREST 单次最多返回 1000 行
  const rows = await fetchAll<{
    id: number;
    title: string | null;
    lyrics: string | null;
    lyrics_start: string | null;
  }>(supabase, TABLES.MUSIC, "id,title,lyrics,lyrics_start", (q) =>
    q.not("lyrics", "is", null).order("id", { ascending: true }),
  );

  const entries: LyricsLinesEntry[] = [];
  for (const row of rows) {
    const lines = buildFolio(row.lyrics, {
      title: row.title ?? "",
      lyricsStart: row.lyrics_start ?? undefined,
    }).lines.map((l) => l.text);
    if (lines.length === 0) continue;
    entries.push({
      id: row.id,
      lines:
        locale === "zh-TW" ? lines.map((l) => toTraditional(l) ?? l) : lines,
    });
  }
  return entries;
}

/**
 * 同上，存进 Next 的数据缓存：切一遍全部歌词要一两秒，不能每次请求都切。
 * 不按时间过期，歌曲变动时 server-revalidate 用 expire: 0 失效标签，下一次请求当场重算，
 * 不会先给一次旧数据被 CDN 存住。缓存键按字形分开（参数自动进键）。
 *
 * 部署时数据缓存是空的，改了切句逻辑也不会留旧结果；万一数据缓存跨部署保留了，
 * 改切句逻辑或返回格式时把键里的 v1 加一。失败时抛错，unstable_cache 不缓存异常。
 */
export const getCachedLyricsLines = unstable_cache(
  (locale: Locale) => getLyricsLines(locale),
  ["lyrics-lines-v1"],
  { tags: [LYRICS_LINES_TAG] },
);
