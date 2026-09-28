import { unstable_cache } from "next/cache";
import {
  buildGalleryPool,
  pickGallery,
  type GalleryRow,
  type GallerySong,
} from "@/lib/auth-gallery";
import { getServiceClient, fetchAll, TABLES } from "@/lib/db/supabase-server";

/**
 * 候选池要读全库的歌词再逐首取摘句，登录页又是动态渲染的，
 * 因此跨请求缓存 2 小时（与曲库 ISR 周期一致），每次请求只从池里随机挑。
 */
const loadGalleryPool = unstable_cache(
  async (locale: string): Promise<GallerySong[]> => {
    // 失败时抛错而不返回空数组：unstable_cache 不缓存异常，
    // 否则一次查询失败会让空池被缓存 2 小时
    const supabase = getServiceClient();
    if (!supabase) throw new Error("Supabase 未配置");
    // 只取资料无争议的歌（同 music_catalog 的规则）；视图是 select * 建的，
    // 未必带 lyrics_start 这类后加的列，所以直接查主表
    const rows = await fetchAll<GalleryRow>(
      supabase,
      TABLES.MUSIC,
      "id,title,lyrics,lyrics_start",
      (q) =>
        q
          .is("dispute_note", null)
          .eq("hascover", true)
          .not("lyrics", "is", null)
          .order("id", { ascending: true }),
    );
    const pool = buildGalleryPool(rows, locale);
    if (pool.length === 0) throw new Error("封面墙候选池为空");
    return pool;
  },
  ["auth-gallery-v1"],
  { revalidate: 7200 },
);

/** 登录、注册页用：取不到就返回空数组，页面退回没有封面墙的样子 */
export async function getAuthGallery(locale: string): Promise<GallerySong[]> {
  const pool = await loadGalleryPool(locale).catch((e) => {
    console.error("[getAuthGallery] 加载候选池失败", e);
    return [];
  });
  return pickGallery(pool);
}
