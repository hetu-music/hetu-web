import { cache } from "react";
import {
  getServiceClient,
  getUserClient,
  fetchAll,
  TABLES,
} from "@/lib/db/supabase-server";
import { Song, SongDetail, SONG_LIST_VIEW_FIELDS } from "@/lib/types";
import { mapAndSortSongs } from "@/lib/utils/utils-song";
import { applyCreditAliases } from "@/lib/utils/utils-credits";
import { getCreditAliases } from "@/lib/server/service-credit-aliases";
import {
  createSongRecord,
  ensureDraft,
  SongVersionError,
  userDb,
  type Db,
} from "@/lib/server/service-versions";
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
    if (s.creditAliases) {
      res.creditAliases = toTraditionalArray(s.creditAliases) ?? undefined;
    }
    if (item.albumartist) {
      res.albumartist = toTraditionalArray(item.albumartist);
    }
    return res as Song;
  });
}

/**
 * 获取所有歌曲数据
 *
 * - 公共展示路径（不传 accessToken）：高权限客户端 + 全量分页，读线上的歌
 * - 后台路径（传 accessToken）：用户权限客户端，读每首歌的工作版本
 *
 * @param table        - 默认 TABLES.PUBLISHED_SONGS；后台传 TABLES.WORKING_SONGS
 * @param accessToken  - 登录用户的 accessToken（仅 Admin 路径需要）
 * @param forListView  - 为 true 时只获取列表字段，排除歌词等大字段
 */
export const getSongs = cache(async function getSongs(
  table: string = TABLES.PUBLISHED_SONGS,
  accessToken?: string,
  forListView: boolean = false,
  locale: string = "zh-CN",
): Promise<Song[]> {
  const selectFields = forListView ? SONG_LIST_VIEW_FIELDS.join(",") : "*";
  let songs: Song[];

  // 公共主表：高权限 + 分页全量获取
  if (table === TABLES.PUBLISHED_SONGS && !accessToken) {
    const supabase = getServiceClient();
    if (!supabase) {
      console.warn(
        "[getSongs] Service client unavailable, returning empty data",
      );
      return [];
    }
    const [data, aliases] = await Promise.all([
      fetchAll<Record<string, unknown>>(supabase, table, selectFields, (q) =>
        q.order("id", { ascending: true }),
      ),
      getCreditAliases(),
    ]);
    // 公开展示用主名；后台读工作版本，署名保持原样
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    songs = mapAndSortSongs(data as any).map((song) =>
      applyCreditAliases(song, aliases),
    );
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
      .from(TABLES.PUBLISHED_SONGS)
      .select(selectFields)
      .in("id", batch);

    if (error) {
      console.error("[getSongsByIds] Supabase error:", error);
      throw new Error("Failed to fetch songs");
    }
    if (data) rows.push(...(data as unknown as Record<string, unknown>[]));
  }

  const aliases = await getCreditAliases();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const songs = mapAndSortSongs(rows as any).map((song) =>
    applyCreditAliases(song, aliases),
  );

  return locale === "zh-TW" ? toTraditionalSongList(songs) : songs;
}

/**
 * 这首歌在不在线上。读者数据（收藏、评点、反馈、试听）挂在 songs 上，
 * 没上线或已下架的歌也有 id，写之前用它确认（DATABASE.md 第六节）。
 */
export async function isSongPublished(songId: number): Promise<boolean> {
  const supabase = getServiceClient();
  if (!supabase) throw new Error("Supabase service client unavailable");
  const { data, error } = await supabase
    .from(TABLES.PUBLISHED_SONGS)
    .select("id")
    .eq("id", songId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * 获取每首歌的最后修改时间，供 sitemap 的 lastModified 使用。
 *
 * 数据来源是 published_songs.updated_at，即线上版本的发布时间。
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
      TABLES.PUBLISHED_SONGS,
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
 * 根据 ID 获取歌曲详情：公开端读线上版本，后台（传 accessToken 与 TABLES.WORKING_SONGS）读工作版本
 * @param locale - 当前语言，'zh-TW' 时自动转换繁体
 */
export const getSongById = cache(async function getSongById(
  id: number,
  table: string = TABLES.PUBLISHED_SONGS,
  accessToken?: string,
  locale: string = "zh-CN",
): Promise<SongDetail | null> {
  const supabase =
    table === TABLES.PUBLISHED_SONGS && !accessToken
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
    .maybeSingle();

  if (error) {
    console.error("[getSongById] query failed for id:", id, error);
    return null;
  }
  if (!data) {
    console.warn("[getSongById] No song found for id:", id);
    return null;
  }

  const detail = {
    ...data,
    year: data.date ? new Date(data.date).getFullYear() : null,
  } as SongDetail;
  // 公开页卷首用主名，原署留在 credited 里给版记；后台编辑看到的仍是原样
  const isPublic = table === TABLES.PUBLISHED_SONGS && !accessToken;
  const result = isPublic
    ? applyCreditAliases(detail, await getCreditAliases())
    : detail;

  // 繁体转换：服务端完成，客户端零负担
  if (locale === "zh-TW") {
    return {
      ...result,
      title: toTraditional(result.title) ?? result.title,
      album: toTraditional(result.album),
      comment: toTraditional(result.comment),
      dispute_note: toTraditional(result.dispute_note),
      lyrics: toTraditionalLrc(result.lyrics),
      // 人名字段也转换
      artist: toTraditionalArray(result.artist),
      lyricist: toTraditionalArray(result.lyricist),
      composer: toTraditionalArray(result.composer),
      arranger: toTraditionalArray(result.arranger),
      albumartist: toTraditionalArray(result.albumartist),
      // 只转有的字段：版记会拿它覆盖署名，补出来的 null 会把原有署名盖掉
      credited:
        result.credited &&
        Object.fromEntries(
          Object.entries(result.credited).map(([k, v]) => [
            k,
            toTraditionalArray(v),
          ]),
        ),
      aliasOf:
        result.aliasOf &&
        Object.fromEntries(
          Object.entries(result.aliasOf).map(([alias, name]) => [
            toTraditional(alias) ?? alias,
            toTraditional(name) ?? name,
          ]),
        ),
    };
  }

  return result;
});

// ─── 后台写入 ─────────────────────────────────────────────────────────────────

/** 资料表单里的链接字段 → song_links 的平台。链接挂在歌上，保存即生效，不进版本 */
const LINK_PLATFORMS = {
  nelink: "netease",
  qmlink: "qq",
  kugolink: "kugou",
} as const;
type LinkField = keyof typeof LINK_PLATFORMS;
const LINK_FIELDS = Object.keys(LINK_PLATFORMS) as LinkField[];

/** 进版本的资料字段（song_versions 上 authenticated 能改的列） */
const VERSION_FIELDS = [
  "title",
  "date",
  "album",
  "track",
  "tracktotal",
  "discnumber",
  "disctotal",
  "artist",
  "lyricist",
  "composer",
  "arranger",
  "albumartist",
  "genre",
  "type",
  "length",
  "lyrics",
  "lyrics_start",
  "comment",
  "dispute_note",
  "hascover",
  "nmn_status",
] as const;

type SongInput = Partial<
  Record<(typeof VERSION_FIELDS)[number] | LinkField, unknown>
>;

function pickVersionFields(song: SongInput): Record<string, unknown> {
  return Object.fromEntries(
    VERSION_FIELDS.filter((k) => k in song).map((k) => [k, song[k]]),
  );
}

/** 空串、空白算没填 */
function normalizeLink(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function conflict(message: string) {
  return new SongVersionError(message, 409);
}

/** 写链接：给了哪个平台就改哪个，清空即删除 */
async function saveLinks(
  db: Db,
  songId: number,
  song: SongInput,
  current: Partial<Record<LinkField, string | null>>,
): Promise<void> {
  for (const field of LINK_FIELDS) {
    if (!(field in song)) continue;
    const next = normalizeLink(song[field]);
    if (next === (current[field] ?? null)) continue;
    const platform = LINK_PLATFORMS[field];
    const { error } =
      next === null
        ? await db
            .from(TABLES.SONG_LINKS)
            .delete()
            .eq("song_id", songId)
            .eq("platform", platform)
        : await db
            .from(TABLES.SONG_LINKS)
            .upsert(
              { song_id: songId, platform, url: next },
              { onConflict: "song_id,platform" },
            );
    if (error?.code === "23505") {
      throw conflict(`这个链接已挂在别的歌上：${next}`);
    }
    if (error) throw error;
  }
}

async function readWorkingSong(db: Db, id: number): Promise<SongDetail | null> {
  const { data, error } = await db
    .from(TABLES.WORKING_SONGS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as SongDetail | null;
}

/** 新增歌曲：一首歌 + 它的草稿，链接另存。返回工作版本 */
export async function createSong(
  song: SongInput,
  accessToken: string,
): Promise<SongDetail> {
  const db = userDb(accessToken);
  const id = await createSongRecord(db, pickVersionFields(song));
  await saveLinks(db, id, song, {});
  const created = await readWorkingSong(db, id);
  if (!created) throw new Error("Failed to create song");
  return created;
}

/**
 * 保存资料：资料字段写进草稿（有改动才开草稿），链接直接改。
 * 乐观锁：updated_at 是调用方读到的工作版本的保存时间，与现在的对不上就 409。
 * 开草稿时沿用源版本的 updated_at，所以打开着的表单在草稿刚开出来时不会误报冲突。
 */
export async function updateSong(
  id: number,
  song: SongInput & { updated_at?: string },
  accessToken: string,
): Promise<SongDetail> {
  const db = userDb(accessToken);
  const current = await readWorkingSong(db, id);
  if (!current) throw new SongVersionError("歌曲不存在", 404);
  if (song.updated_at && song.updated_at !== current.updated_at) {
    throw conflict("乐观锁冲突");
  }

  await saveLinks(db, id, song, current);

  const before = current as unknown as Record<string, unknown>;
  const changed = Object.fromEntries(
    Object.entries(pickVersionFields(song)).filter(
      ([k, v]) =>
        JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null),
    ),
  );
  if (Object.keys(changed).length > 0) {
    const draft = await ensureDraft(db, id);
    const { data, error } = await db
      .from(TABLES.SONG_VERSIONS)
      .update(changed)
      .eq("id", draft)
      .eq("updated_at", current.updated_at)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw conflict("乐观锁冲突");
  }

  const saved = await readWorkingSong(db, id);
  if (!saved) throw new SongVersionError("歌曲不存在", 404);
  return saved;
}
