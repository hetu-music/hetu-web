import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import {
  expandAnnotations,
  type IndexOccurrence,
  type PublishedAnnotation,
} from "@/lib/imagery/consistency";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";
import type { ImageryCategory, Motif } from "@/lib/types";

/**
 * 意象相关公开页面共用的一份全库数据：详情页的意象与相关作品（service-song-imagery）、
 * 意象词云（service-imagery-cloud）、寻曲候选池（service-quiz）都从它算，
 * 数据库只读一次、内存里只存一份。各处要的字段取并集。
 *
 * 标注取全部线上的歌（资料存疑的歌自己的详情页也要标意象），歌曲只取计入曲库的；
 * 统计、推荐、候选池都以曲库为范围，各自按 songs 过滤标注。
 *
 * 时间标签与「同时算进」都不存（DATABASE.md 第四节），在这里算好：
 * 时间标签按线上版本的歌词算，「同时算进」的母题各展开成一行。歌词只在算的时候用，不进缓存。
 *
 * 跨请求缓存，6 小时刷新（与全站 ISR 一致）；其中任何数据变了由 server-revalidate 按标签失效。
 */

export type { IndexOccurrence };

export type IndexSong = {
  id: number;
  title: string;
  artist: string[] | null;
  album: string | null;
  lyricist: string[] | null;
  hascover: boolean | null;
  has_audio: boolean | null;
  type: string[] | null;
  date: string | null;
};

export type ImageryIndex = {
  categories: ImageryCategory[];
  motifs: Motif[];
  imagery: Array<{ id: number; name: string }>;
  occurrences: IndexOccurrence[];
  /** 计入曲库的歌 */
  songs: IndexSong[];
  /** 每首歌的主（rank 1）、副基调 */
  songEmotions: Array<{ song_id: number; emotion_id: number; rank: number }>;
  /** 基调词表的明暗、扬抑 */
  emotions: Array<{ id: number; tone: string; energy: string }>;
};

export const loadImageryIndex = unstable_cache(
  async (): Promise<ImageryIndex> => {
    // 失败时抛错而不返回空数据：unstable_cache 不缓存异常，
    // 否则一次查询失败会让残缺的数据被缓存 6 小时
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    const [
      categories,
      motifs,
      imagery,
      annotations,
      lyrics,
      songs,
      songEmotions,
      emotions,
    ] = await Promise.all([
      fetchAll<ImageryCategory>(
        supabase,
        TABLES.IMAGERY_CAT,
        "id,name,domain,description",
      ),
      fetchAll<Motif>(
        supabase,
        TABLES.MOTIFS,
        "id,name,category_id,description",
      ),
      fetchAll<ImageryIndex["imagery"][number]>(
        supabase,
        TABLES.IMAGERY,
        "id,name",
      ),
      fetchAll<PublishedAnnotation>(
        supabase,
        TABLES.PUBLISHED_SONG_IMAGERY,
        "song_id,version_id,imagery_id,motif_id,part_motif_ids",
      ),
      fetchAll<{ version_id: number; lyrics: string | null }>(
        supabase,
        TABLES.PUBLISHED_SONGS,
        "version_id,lyrics",
      ),
      fetchAll<IndexSong>(
        supabase,
        TABLES.CATALOG,
        "id,title,artist,album,lyricist,hascover,has_audio,type,date",
      ),
      // 基调只参与排序与匹配；没标基调的歌当中性处理，这两张表允许为空
      fetchAll<ImageryIndex["songEmotions"][number]>(
        supabase,
        TABLES.PUBLISHED_SONG_EMOTIONS,
        "song_id,emotion_id,rank",
      ),
      fetchAll<ImageryIndex["emotions"][number]>(
        supabase,
        TABLES.EMOTIONS,
        "id,tone,energy",
      ),
    ]);
    // fetchAll 出错时只记日志并返回已取到的部分，这里至少拦住整表为空的情况
    const empty = Object.entries({
      categories,
      motifs,
      imagery,
      annotations,
      songs,
    })
      .filter(([, rows]) => rows.length === 0)
      .map(([name]) => name);
    if (empty.length > 0) {
      throw new Error(`意象索引数据为空：${empty.join(", ")}`);
    }
    const occurrences = expandAnnotations(
      annotations,
      new Map(lyrics.map((l) => [l.version_id, l.lyrics])),
      new Map(imagery.map((i) => [i.id, i.name])),
    );
    return {
      categories,
      motifs,
      imagery,
      occurrences,
      songs,
      songEmotions,
      emotions,
    };
  },
  // 标签也放进 key：改了标签名，旧标签打的条目刷不到，换 key 让它们作废。
  // v2：类别与母题分开、时间标签读时算（数据形状变了，旧缓存不能用）
  ["imagery-index-v2", IMAGERY_INDEX_TAG],
  { revalidate: 21600, tags: [IMAGERY_INDEX_TAG] },
);
