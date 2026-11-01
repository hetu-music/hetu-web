import {
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import type {
  CollationKind,
  CommentAnchor,
  SongCollation,
  SupplementKind,
} from "@/lib/types";
import type {
  CollationInput,
  SupplementInput,
} from "@/lib/utils/utils-collations";
import { toTraditional } from "@/lib/utils/utils-convert";

/**
 * 校记与补遗的读写（同存 song_collations，补遗的 anchor 为 song）。
 *
 * 读取走高权限客户端：要连带取校者、订者的名字，而 users 表对他人不可读。
 * 写入用管理员会话的客户端，由 RLS 把关；校者、订者由数据库触发器按会话写入。
 */

const FIELDS =
  "id, song_id, anchor, anchor_index, anchor_time, anchor_quote, kind, date, quote, sung, body, created_by";

interface CollationRow {
  id: number;
  song_id: number;
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
  revisers:
    | { first_at: string; user: { name: string | null } | null }[]
    | null;
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
 * 一首歌的全部校记与补遗。繁体页把原文、实唱、说明转成繁体：
 * 繁体页的歌词本就是库里简体转繁而来，原句转繁后才对得上那一行。
 * 出错时返回空：详情页不该因为校记读不出来就整页失败。
 */
export async function getSongCollations(
  songId: number,
  locale: string,
): Promise<SongCollation[]> {
  const db = getServiceClient();
  if (!db) return [];
  // song_collations 有两条外键指向 users，用列名指明校者走 created_by；
  // 订者名单由触发器记，校者本人不在其中
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .select(
      `${FIELDS}, collator:${TABLES.USERS}!created_by(name), revisers:${TABLES.SONG_COLLATION_REVISERS}(first_at, user:${TABLES.USERS}(name))`,
    )
    .eq("song_id", songId)
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

function userClient(accessToken: string) {
  const db = getUserClient(accessToken);
  if (!db) throw new Error("Supabase client unavailable");
  return db;
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

/** 新增一条，返回 id */
export async function createCollation(
  songId: number,
  row: EntryRow,
  accessToken: string,
): Promise<number> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.SONG_COLLATIONS)
    .insert({ song_id: songId, ...row })
    .select("id")
    .single();
  // 外键失败：歌不在正式曲库
  if (error?.code === "23503") {
    throw new CollationError("歌曲尚未发布，发布后才能录入", 400);
  }
  if (error) throw error;
  return (data as { id: number }).id;
}

/** 修改一条，返回所在的歌，好刷新那一页 */
export async function updateCollation(
  id: number,
  row: EntryRow,
  accessToken: string,
): Promise<number> {
  // 只改同一种：校记不能经补遗的接口改成补遗，反之亦然
  const { data, error } = await userClient(accessToken)
    .from(TABLES.SONG_COLLATIONS)
    .update(row)
    .eq("id", id)
    .eq("anchor", row.anchor)
    .select("song_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CollationError("这条校记已不存在", 404);
  return (data as { song_id: number }).song_id;
}

/** 删除一条，返回所在的歌 */
export async function deleteCollation(
  id: number,
  accessToken: string,
): Promise<number> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.SONG_COLLATIONS)
    .delete()
    .eq("id", id)
    .select("song_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CollationError("这条校记已不存在", 404);
  return (data as { song_id: number }).song_id;
}
