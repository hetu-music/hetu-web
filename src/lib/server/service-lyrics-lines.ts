import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type { Locale } from "@/i18n/config";
import type { LyricsLinesEntry } from "@/lib/search/corpus";
import { toTraditional } from "@/lib/utils/utils-convert";
import { buildFolio } from "@/lib/utils/utils-folio";
import { getSongLastModifiedMap } from "./service-songs";

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
 * 歌词版本号（阶段 5「2.」）：全部歌最近一次更新的时间加上歌数，用 36 进制写短。
 * 只用来区分缓存地址：歌词改了，地址就变，浏览器和 Service Worker 去拉新的。
 * 删了一首歌最近更新时间不变，所以带上歌数。
 */
/** 版本号和数据对得上时为 1，Service Worker 只缓存带这个头的（sw.ts 里写的是同一个名字） */
export const VERSION_MATCH_HEADER = "X-Lyrics-Version-Match";

/** 每种字形按版本号记住切好的句子：切一遍全部歌词要一两秒，版本号不变就不再切 */
const memo = new Map<
  Locale,
  { version: string; entries: Promise<LyricsLinesEntry[]> }
>();

/**
 * 当前的版本号和对应的数据。版本号每次都从库里算（一条很轻的查询），所以数据总是最新的，
 * 不会把旧数据记在新版本号下面。
 */
export async function getCurrentLyricsLines(
  locale: Locale,
): Promise<{ version: string; entries: LyricsLinesEntry[] }> {
  const version = lyricsVersion(await getSongLastModifiedMap());
  let hit = memo.get(locale);
  if (!hit || hit.version !== version) {
    const entries = getLyricsLines(locale);
    const created = { version, entries };
    memo.set(locale, created);
    entries.catch(() => {
      if (memo.get(locale) === created) memo.delete(locale);
    });
    hit = created;
  }
  return { version, entries: await hit.entries };
}

/** 只供测试 */
export function resetLyricsLinesMemoForTests(): void {
  memo.clear();
}

export function lyricsVersion(lastModified: ReadonlyMap<number, Date>): string {
  let latest = 0;
  for (const date of lastModified.values()) {
    latest = Math.max(latest, date.getTime());
  }
  return `${latest.toString(36)}${lastModified.size.toString(36)}`;
}
