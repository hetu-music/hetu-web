/**
 * 登录、注册页的封面墙与摘句：从曲库里挑有封面、有歌词的歌，
 * 每首取一句适合展示的歌词。纯函数，查询与缓存在 service-auth-gallery。
 * 挑摘句只能在服务端做（见 utils-excerpt）；客户端要的类型与常量在 auth-gallery-shared。
 */
import "server-only";
import { GALLERY_SIZE, type GallerySong } from "@/lib/auth-gallery-shared";
import type { MarkInput } from "@/lib/utils/utils-folio";
import { songExcerpt } from "@/lib/utils/utils-excerpt";
import { toTraditional, toTraditionalLrc } from "@/lib/utils/utils-convert";

export interface GalleryRow {
  id: number;
  title: string | null;
  lyrics: string | null;
  lyrics_start?: string | null;
}

/**
 * 把查到的歌整理成候选池：取不出摘句的歌不要。
 * 摘句与歌曲页卷首一致：按意象标注挑，繁体先转歌词再挑（详情页也是先转再折句）。
 */
export function buildGalleryPool(
  rows: GalleryRow[],
  locale: string,
  marksBySong: Map<number, MarkInput[]> = new Map(),
): GallerySong[] {
  const tw = locale === "zh-TW";
  const tr = (s: string) => (tw ? (toTraditional(s) ?? s) : s);
  return rows.flatMap((row) => {
    if (!row.title || !row.lyrics) return [];
    const title = tr(row.title);
    const lyrics =
      (tw ? toTraditionalLrc(row.lyrics) : row.lyrics) ?? row.lyrics;
    const marks = (marksBySong.get(row.id) ?? []).map((m) => ({
      ...m,
      name: tr(m.name),
    }));
    const excerpt = songExcerpt(lyrics, {
      title,
      lyricsStart: row.lyrics_start,
      marks,
    });
    if (!excerpt) return [];
    return [{ id: row.id, title, excerpt }];
  });
}

/**
 * 每次打开页面随机挑一批：前 GALLERY_QUOTES 首轮换展示摘句，
 * 全部上墙。random 可注入，便于测试。
 */
export function pickGallery(
  pool: GallerySong[],
  random: () => number = Math.random,
): GallerySong[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, GALLERY_SIZE);
}
