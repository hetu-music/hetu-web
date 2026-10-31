/**
 * 登录、注册页的封面墙与摘句：从曲库里挑有封面、有歌词的歌，
 * 每首取一句适合展示的歌词。纯函数，查询与缓存在 service-auth-gallery。
 */
import {
  buildFolio,
  markLines,
  pickExcerpt,
  type MarkInput,
} from "@/lib/utils/utils-folio";
import { toTraditional, toTraditionalLrc } from "@/lib/utils/utils-convert";

export interface GallerySong {
  id: number;
  title: string;
  /** 摘句：按空格分成若干短语，与歌曲页卷首的竖排摘句同一规则 */
  excerpt: string;
}

export interface GalleryRow {
  id: number;
  title: string | null;
  lyrics: string | null;
  lyrics_start?: string | null;
}

/** 墙上的封面数：宽屏四列、每列九张 */
export const GALLERY_SIZE = 36;
/** 轮换展示摘句的歌数 */
export const GALLERY_QUOTES = 8;

export interface GalleryOccurrence {
  song_id: number;
  imagery_id: number;
  lyric_timetag: string[] | null;
}

/**
 * 每首歌的意象标注，整理成 markLines 要的样子：一个词一条，时间标签取并集。
 * 与详情页（getSongImagery）的 marks 同一规则，摘句才挑得出同一句。
 */
export function groupMarks(
  occurrences: GalleryOccurrence[],
  imagery: Array<{ id: number; name: string }>,
): Map<number, MarkInput[]> {
  const nameById = new Map(imagery.map((i) => [i.id, i.name]));
  const bySong = new Map<number, Map<number, MarkInput>>();
  for (const occ of occurrences) {
    const name = nameById.get(occ.imagery_id);
    if (!name) continue;
    let marks = bySong.get(occ.song_id);
    if (!marks) bySong.set(occ.song_id, (marks = new Map()));
    let mark = marks.get(occ.imagery_id);
    if (!mark) {
      marks.set(
        occ.imagery_id,
        (mark = { id: occ.imagery_id, name, timetags: [] }),
      );
    }
    for (const tag of occ.lyric_timetag ?? []) {
      if (!mark.timetags.includes(tag)) mark.timetags.push(tag);
    }
  }
  return new Map([...bySong].map(([id, marks]) => [id, [...marks.values()]]));
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
    const { lines } = buildFolio(lyrics, {
      title,
      lyricsStart: row.lyrics_start,
    });
    const excerpt = pickExcerpt(lines, markLines(lines, marks));
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
