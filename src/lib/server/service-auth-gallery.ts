import { unstable_cache } from "next/cache";
import {
  buildGalleryPool,
  pickGallery,
  type GalleryRow,
} from "@/lib/auth-gallery";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";
import { groupMarks } from "@/lib/utils/utils-excerpt";
import { IMAGERY_INDEX_TAG } from "@/lib/imagery/tags";
import { loadImageryIndex } from "@/lib/server/imagery-index";

/**
 * 候选池要读全库的歌词再逐首取摘句，登录页又是动态渲染的，
 * 因此跨请求缓存 6 小时（与全站 ISR 周期一致），每次请求只从池里随机挑。
 */
const loadGalleryPool = unstable_cache(
  async (locale: string): Promise<GallerySong[]> => {
    // 失败时抛错而不返回空数组：unstable_cache 不缓存异常，
    // 否则一次查询失败会让空池被缓存 6 小时
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    // 只取资料无争议的歌（同 music_catalog 的规则）；视图是 select * 建的，
    // 未必带 lyrics_start 这类后加的列，所以直接查主表
    const [rows, index] = await Promise.all([
      fetchAll<GalleryRow>(
        supabase,
        TABLES.MUSIC,
        "id,title,lyrics,lyrics_start",
        (q) =>
          q
            .is("dispute_note", null)
            .eq("hascover", true)
            .not("lyrics", "is", null)
            .order("id", { ascending: true }),
      ),
      // 摘句按意象标注挑，与歌曲页卷首同一句
      loadImageryIndex(),
    ]);
    const marks = groupMarks(index.occurrences, index.imagery);
    const pool = buildGalleryPool(rows, locale, marks);
    if (pool.length === 0) throw new Error("封面墙候选池为空");
    return pool;
  },
  ["auth-gallery-v2", IMAGERY_INDEX_TAG],
  { revalidate: 21600, tags: [IMAGERY_INDEX_TAG] },
);

/** 登录、注册页用：取不到就返回空数组，页面退回没有封面墙的样子 */
export async function getAuthGallery(locale: string): Promise<GallerySong[]> {
  const pool = await loadGalleryPool(locale).catch((e) => {
    console.error("[getAuthGallery] 加载候选池失败", e);
    return [];
  });
  return pickGallery(pool);
}
