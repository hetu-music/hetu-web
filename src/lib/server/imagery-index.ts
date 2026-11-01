import { unstable_cache } from "next/cache";
import { fetchAll, getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";

/**
 * 意象相关公开页面共用的一份全库数据：详情页的意象与相关作品（service-song-imagery）、
 * 意象词云（service-imagery-cloud）、寻曲候选池（service-quiz）都从它算，
 * 数据库只读一次、内存里只存一份。各处要的字段取并集。
 *
 * 标注取全部歌（资料存疑的歌自己的详情页也要标意象），歌曲只取计入曲库的；
 * 统计、推荐、候选池都以曲库为范围，各自按 songs 过滤标注。
 *
 * 跨请求缓存，6 小时刷新（与全站 ISR 一致）；其中任何数据变了由 server-revalidate 按标签失效。
 */

export type IndexCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number | null;
  description: string | null;
};

export type IndexOccurrence = {
  song_id: number;
  imagery_id: number;
  category_id: number;
  lyric_timetag: string[] | null;
};

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
  categories: IndexCategory[];
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
    const [categories, imagery, occurrences, songs, songEmotions, emotions] =
      await Promise.all([
        fetchAll<IndexCategory>(
          supabase,
          TABLES.IMAGERY_CAT,
          "id,name,parent_id,level,description",
        ),
        fetchAll<ImageryIndex["imagery"][number]>(
          supabase,
          TABLES.IMAGERY,
          "id,name",
        ),
        fetchAll<IndexOccurrence>(
          supabase,
          TABLES.IMAGERY_OCC,
          "song_id,imagery_id,category_id,lyric_timetag",
        ),
        fetchAll<IndexSong>(
          supabase,
          TABLES.MUSIC_CATALOG,
          "id,title,artist,album,lyricist,hascover,has_audio,type,date",
        ),
        // 基调只参与排序与匹配；没标基调的歌当中性处理，这两张表允许为空
        fetchAll<ImageryIndex["songEmotions"][number]>(
          supabase,
          TABLES.SONG_EMOTIONS,
          "song_id,emotion_id,rank",
        ),
        fetchAll<ImageryIndex["emotions"][number]>(
          supabase,
          TABLES.EMOTIONS,
          "id,tone,energy",
        ),
      ]);
    // fetchAll 出错时只记日志并返回已取到的部分，这里至少拦住整表为空的情况
    const empty = Object.entries({ categories, imagery, occurrences, songs })
      .filter(([, rows]) => rows.length === 0)
      .map(([name]) => name);
    if (empty.length > 0) {
      throw new Error(`意象索引数据为空：${empty.join(", ")}`);
    }
    return { categories, imagery, occurrences, songs, songEmotions, emotions };
  },
  // 标签也放进 key：改了标签名，旧标签打的条目刷不到，换 key 让它们作废
  ["imagery-index-v1", IMAGERY_INDEX_TAG],
  { revalidate: 21600, tags: [IMAGERY_INDEX_TAG] },
);
