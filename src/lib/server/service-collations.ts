import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import type {
  CollationKind,
  CommentAnchor,
  SongCollation,
  SupplementKind,
} from "@/lib/types";
import type {
  CollationInput,
  SupplementInput,
} from "@/lib/forms/collation-form";
import { toTraditional } from "@/lib/utils/utils-convert";
import {
  ensureDraft,
  liveVersionId,
  SongVersionError,
  userDb,
  workingVersionId,
  type Db,
} from "@/lib/server/service-versions";

/**
 * 校记与补遗的读写（同存 song_collations，补遗的 anchor 为 song）。
 *
 * 挂在版本上：公开页读线上版本，后台读工作版本；写在草稿上（没有就开一份），发布时随整首歌上线。
 * 行的 id 在各版本间不变，后台拿着的 id 在开草稿前后都能用。
 *
 * 读取走高权限客户端：要连带取校者、订者的名字，而 users 表对他人不可读。
 * 写入用管理员会话的客户端，由 RLS 把关；校者、订者由数据库触发器按会话写入。
 */

const FIELDS =
  "id, version_id, anchor, anchor_index, anchor_time, anchor_quote, kind, date, quote, sung, body, created_by";

interface CollationRow {
  id: number;
  version_id: number;
  anchor: CommentAnchor;
  anchor_index: number | null;
  anchor_time: number | string | null;
  anchor_quote: string | null;
  kind: CollationKind | SupplementKind;
  date: string | null;
  quote: string | null;
  sung: string | null;
  body: string;
  created_by: string | null;
  collator: { name: string | null } | null;
  revisers: { first_at: string; user: { name: string | null } | null }[] | null;
}

export class CollationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * 一首歌的全部校记与补遗。scope 为 live 读线上版本（公开页），working 读工作版本（后台）。
 * 繁体页把原文、实唱、说明转成繁体：
 * 繁体页的歌词本就是库里简体转繁而来，原句转繁后才对得上那一行。
 * 出错时返回空：详情页不该因为校记读不出来就整页失败。
 */
export async function getSongCollations(
  songId: number,
  locale: string,
  scope: "live" | "working" = "live",
): Promise<SongCollation[]> {
  const db = getServiceClient();
  if (!db) return [];
  let versionId: number | null;
  try {
    versionId =
      scope === "live"
        ? await liveVersionId(db, songId)
        : await workingVersionId(db, songId);
  } catch (e) {
    console.error("[getSongCollations]", e);
    return [];
  }
  if (versionId === null) return [];
  // song_collations 有两条外键指向 users，用列名指明校者走 created_by；
  // 订者名单由触发器记，校者本人不在其中
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .select(
      `${FIELDS}, collator:${TABLES.USERS}!created_by(name), revisers:${TABLES.SONG_COLLATION_REVISERS}(first_at, user:${TABLES.USERS}(name))`,
    )
    .eq("version_id", versionId)
    .order("id");
  if (error) {
    console.error("[getSongCollations]", error);
    return [];
  }
  const tr =
    locale === "zh-TW"
      ? (s: string | null) => (s === null ? null : (toTraditional(s) ?? s))
      : (s: string | null) => s;
  return ((data ?? []) as unknown as CollationRow[]).map((r) => ({
    id: r.id,
    anchor: r.anchor,
    anchorIndex: r.anchor_index,
    anchorTime: r.anchor_time === null ? null : Number(r.anchor_time),
    anchorQuote: tr(r.anchor_quote),
    kind: r.kind,
    date: r.date,
    quote: tr(r.quote),
    sung: tr(r.sung),
    body: tr(r.body) ?? "",
    collator: r.created_by ? (r.collator?.name ?? null) : null,
    revisers: [...(r.revisers ?? [])]
      .sort((a, b) => Date.parse(a.first_at) - Date.parse(b.first_at))
      .flatMap((v) => (v.user?.name ? [v.user.name] : [])),
  }));
}

/** 开草稿；歌不存在时报 404 */
async function draftOf(db: Db, songId: number): Promise<number> {
  try {
    return await ensureDraft(db, songId);
  } catch (e) {
    if (e instanceof SongVersionError)
      throw new CollationError(e.message, e.status);
    throw e;
  }
}

/** 一条校记属于哪首歌（任一版本里有它即可，各版本的同一条 id 相同） */
async function songOfCollation(db: Db, id: number): Promise<number> {
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .select("version:song_versions(song_id)")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const songId = (data as { version: { song_id: number } | null } | null)
    ?.version?.song_id;
  if (songId === undefined) throw new CollationError("这条校记已不存在", 404);
  return songId;
}

/** 写库的一行：歌词校记挂在某一句上，补遗记在整首歌上、位置几列都空着 */
export type EntryRow = ReturnType<typeof lyricRow> | ReturnType<typeof songRow>;

export function lyricRow(input: CollationInput) {
  return { anchor: "lyrics" as const, date: null, ...input };
}

export function songRow(input: SupplementInput) {
  return {
    anchor: "song" as const,
    anchor_index: null,
    anchor_time: null,
    anchor_quote: null,
    quote: null,
    sung: null,
    ...input,
  };
}

/** 新增一条（写在草稿上），返回 id */
export async function createCollation(
  songId: number,
  row: EntryRow,
  accessToken: string,
): Promise<number> {
  const db = userDb(accessToken);
  const draft = await draftOf(db, songId);
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .insert({ version_id: draft, ...row })
    .select("id")
    .single();
  // 外键失败：草稿在两次请求之间被放弃或歌被删了
  if (error?.code === "23503") {
    throw new CollationError("歌曲不存在", 404);
  }
  if (error) throw error;
  return (data as { id: number }).id;
}

/** 修改一条（改在草稿上），返回所在的歌 */
export async function updateCollation(
  id: number,
  row: EntryRow,
  accessToken: string,
): Promise<number> {
  const db = userDb(accessToken);
  const songId = await songOfCollation(db, id);
  const draft = await draftOf(db, songId);
  // 只改同一种：校记不能经补遗的接口改成补遗，反之亦然
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .update(row)
    .eq("version_id", draft)
    .eq("id", id)
    .eq("anchor", row.anchor)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CollationError("这条校记已不存在", 404);
  return songId;
}

/** 删除一条（删在草稿上），返回所在的歌 */
export async function deleteCollation(
  id: number,
  accessToken: string,
): Promise<number> {
  const db = userDb(accessToken);
  const songId = await songOfCollation(db, id);
  const draft = await draftOf(db, songId);
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .delete()
    .eq("version_id", draft)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CollationError("这条校记已不存在", 404);
  return songId;
}
