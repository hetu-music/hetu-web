import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import { Song, SongDetail, SONG_LIST_VIEW_FIELDS } from "@/lib/types";
import { mapAndSortSongs } from "@/lib/utils/utils-song";
import { processLyrics } from "@/lib/utils/utils-lyrics";
import {
  toTraditional,
  toTraditionalArray,
  toTraditionalLrc,
} from "@/lib/utils/utils-convert";

/**
 * 列表字段的简→繁转换（zh-TW）
 * getSongs 与 getSongsByIds 共用，避免两处转换逻辑漂移。
 */
function toTraditionalSongList(songs: Song[]): Song[] {
  return songs.map((s) => {
    const item = s as Song & { albumartist?: string[] | null };
    const res: Song & { albumartist?: string[] | null } = {
      ...s,
      title: toTraditional(s.title) ?? s.title,
      album: toTraditional(s.album),
      artist: toTraditionalArray(s.artist),
      lyricist: toTraditionalArray(s.lyricist),
      composer: toTraditionalArray(s.composer),
      arranger: toTraditionalArray(s.arranger),
    };
    if (item.albumartist) {
      res.albumartist = toTraditionalArray(item.albumartist);
    }
    return res as Song;
  });
}

/**
 * 获取所有歌曲数据
 *
 * - 公共展示路径（不传 accessToken）：高权限客户端 + 全量分页，确保获取全部数据
 * - Admin 路径（传 accessToken）：用户权限客户端，操作 temp 表
 *
 * @param table        - 表名，默认 TABLES.MUSIC；Admin 路径传 TABLES.ADMIN
 * @param accessToken  - 登录用户的 accessToken（仅 Admin 路径需要）
 * @param forListView  - 为 true 时只获取列表字段，排除歌词等大字段
 */
export const getSongs = cache(async function getSongs(
  table: string = TABLES.MUSIC,
  accessToken?: string,
  forListView: boolean = false,
  locale: string = "zh-CN",
): Promise<Song[]> {
  const selectFields = forListView ? SONG_LIST_VIEW_FIELDS.join(",") : "*";
  let songs: Song[] = [];

  // 公共主表：高权限 + 分页全量获取
  if (table === TABLES.MUSIC && !accessToken) {
    const supabase = getServiceClient();
    if (!supabase) {
      console.warn(
        "[getSongs] Service client unavailable, returning empty data",
      );
      return [];
    }
    const data = await fetchAll<Record<string, unknown>>(
      supabase,
      table,
      selectFields,
      (q) => q.order("id", { ascending: true }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    songs = mapAndSortSongs(data as any);
  } else {
    // Admin / 其他表：用户权限客户端
    const supabase = getUserClient(accessToken);
    if (!supabase) {
      console.warn("[getSongs] User client unavailable, returning empty data");
      return [];
    }
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .order("id", { ascending: true });

    if (error) {
      console.error("[getSongs] Supabase error:", error);
      throw new Error("Failed to fetch songs");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    songs = mapAndSortSongs(data as any);
  }

  if (locale === "zh-TW") {
    return toTraditionalSongList(songs);
  }

  return songs;
});

/**
 * 按 ID 批量获取歌曲列表字段（公共主表）
 *
 * 供收藏等「只要其中几首」的场景使用——此前这类调用走的是 getSongs 全量
 * 拉取再在内存里 find，随曲库线性增长。
 *
 * @param ids    - 歌曲 ID 列表，返回结果不保证顺序，由调用方按需重排
 * @param locale - 当前语言，'zh-TW' 时自动转换繁体
 */
export async function getSongsByIds(
  ids: number[],
  locale: string = "zh-CN",
): Promise<Song[]> {
  if (ids.length === 0) return [];

  const supabase = getServiceClient();
  if (!supabase) {
    console.warn("[getSongsByIds] Service client unavailable");
    return [];
  }

  const selectFields = SONG_LIST_VIEW_FIELDS.join(",");
  const uniqueIds = [...new Set(ids)];
  const rows: Record<string, unknown>[] = [];

  // 分批查询：单次 .in() 的 id 过多会把 PostgREST 的查询串撑得过长，
  // 且单次响应同样受 1000 行上限约束。
  const BATCH_SIZE = 200;
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from(TABLES.MUSIC)
      .select(selectFields)
      .in("id", batch);

    if (error) {
      console.error("[getSongsByIds] Supabase error:", error);
      throw new Error("Failed to fetch songs");
    }
    if (data) rows.push(...(data as unknown as Record<string, unknown>[]));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const songs = mapAndSortSongs(rows as any);

  return locale === "zh-TW" ? toTraditionalSongList(songs) : songs;
}

/**
 * 获取每首歌的最后修改时间，供 sitemap 的 lastModified 使用。
 *
 * 数据来源是 music.updated_at，由 temp→music 的两条同步路径维护
 * （后台发布、每日定时同步）。
 *
 * 不要改用发行日期 date：那是发行时间不是修改时间，一首 2012 年的歌即使
 * 昨天刚勘误过歌词也会声称「2012 年后未变更」，反而抑制搜索引擎重新抓取，
 * 与本站勘误的用途正好相反。
 */
export const getSongLastModifiedMap = cache(
  async function getSongLastModifiedMap(): Promise<Map<number, Date>> {
    const result = new Map<number, Date>();

    const supabase = getServiceClient();
    if (!supabase) {
      console.warn("[getSongLastModifiedMap] Service client unavailable");
      return result;
    }

    const rows = await fetchAll<{ id: number; updated_at: string | null }>(
      supabase,
      TABLES.MUSIC,
      "id,updated_at",
      (q) => q.order("id", { ascending: true }),
    );

    for (const row of rows) {
      if (!row.updated_at) continue;
      const parsed = new Date(row.updated_at);
      if (!Number.isNaN(parsed.getTime())) result.set(row.id, parsed);
    }

    return result;
  },
);

/**
 * 根据 ID 获取歌曲详情（兼容 music 和 temp 表）
 * @param locale - 当前语言，'zh-TW' 时自动转换繁体
 */
export const getSongById = cache(async function getSongById(
  id: number,
  table: string = TABLES.MUSIC,
  accessToken?: string,
  locale: string = "zh-CN",
): Promise<SongDetail | null> {
  const supabase =
    table === TABLES.MUSIC && !accessToken
      ? getServiceClient()
      : getUserClient(accessToken);

  if (!supabase) {
    console.warn("[getSongById] Supabase client unavailable");
    return null;
  }

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[getSongById] query failed for id:", id, error);
    return null;
  }
  if (!data) {
    console.warn("[getSongById] No song found for id:", id);
    return null;
  }

  let normalLyrics = "";
  if (data.lyrics) {
    try {
      normalLyrics = processLyrics(data.lyrics).lyrics;
    } catch {
      console.error("[getSongById] Error processing lyrics for song", id);
      normalLyrics = "歌词转换失败，请检查LRC格式";
    }
  }

  const result: SongDetail & { normalLyrics: string } = {
    ...data,
    year: data.date ? new Date(data.date).getFullYear() : null,
    normalLyrics,
  } as SongDetail & { normalLyrics: string };

  // 繁体转换：服务端完成，客户端零负担
  if (locale === "zh-TW") {
    return {
      ...result,
      title: toTraditional(result.title) ?? result.title,
      album: toTraditional(result.album),
      comment: toTraditional(result.comment),
      lyrics: toTraditionalLrc(result.lyrics),
      normalLyrics: toTraditional(result.normalLyrics) ?? result.normalLyrics,
      // 人名字段也转换
      artist: toTraditionalArray(result.artist),
      lyricist: toTraditionalArray(result.lyricist),
      composer: toTraditionalArray(result.composer),
      arranger: toTraditionalArray(result.arranger),
      albumartist: toTraditionalArray(result.albumartist),
    };
  }

  return result;
});

/**
 * 新增歌曲（仅用于 Admin 路径，操作 temp 表）
 */
export async function createSong(
  song: Partial<Song>,
  table: string = TABLES.ADMIN,
  accessToken?: string,
): Promise<Song> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("[createSong] User client unavailable");

  const { data, error } = await supabase
    .from(table)
    .insert([song])
    .select()
    .single();

  if (error) throw new Error("Failed to create song");
  return data as Song;
}

/**
 * 更新歌曲（仅用于 Admin 路径，操作 temp 表，含乐观锁）
 */
export async function updateSong(
  id: number,
  song: Partial<Song>,
  table: string = TABLES.ADMIN,
  accessToken?: string,
): Promise<Song> {
  const supabase = getUserClient(accessToken);
  if (!supabase) throw new Error("[updateSong] User client unavailable");

  let query = supabase.from(table).update(song).eq("id", id);
  if (song.updated_at) {
    query = query.eq("updated_at", song.updated_at);
  }
  const { data, error } = await query.select().single();

  if (error) {
    if (
      error.code === "PGRST116" ||
      error.message.includes("Results contain 0 rows")
    ) {
      const conflictError: Error & { status?: number } = new Error(
        "乐观锁冲突",
      );
      conflictError.status = 409;
      throw conflictError;
    }
    throw new Error("Failed to update song");
  }
  return data as Song;
}
