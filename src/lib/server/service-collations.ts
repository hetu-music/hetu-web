import {
  getServiceClient,
  getUserClient,
  TABLES,
} from "@/lib/db/supabase-server";
import type { CollationKind, CommentAnchor, SongCollation } from "@/lib/types";
import type { CollationInput } from "@/lib/utils/utils-collations";
import { toTraditional } from "@/lib/utils/utils-convert";

/**
 * 校记的读写。
 *
 * 读取走高权限客户端：要连带取校者、订者的名字，而 users 表对他人不可读。
 * 写入用管理员会话的客户端，由 RLS 把关；校者、订者由数据库触发器按会话写入。
 */

const FIELDS =
  "id, song_id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body, created_by, updated_by";

interface CollationRow {
  id: number;
  song_id: number;
  anchor: CommentAnchor;
  anchor_index: number | null;
  anchor_time: number | string | null;
  anchor_quote: string | null;
  kind: CollationKind;
  quote: string | null;
  sung: string | null;
  body: string;
  created_by: string | null;
  updated_by: string | null;
  collator: { name: string | null } | null;
  reviser: { name: string | null } | null;
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
 * 一首歌的全部校记。繁体页把原文、实唱、说明转成繁体：
 * 繁体页的歌词本就是库里简体转繁而来，原句转繁后才对得上那一行。
 * 出错时返回空：详情页不该因为校记读不出来就整页失败。
 */
export async function getSongCollations(
  songId: number,
  locale: string,
): Promise<SongCollation[]> {
  const db = getServiceClient();
  if (!db) return [];
  // 校者、订者都指向 users，用列名指明走哪条外键
  const { data, error } = await db
    .from(TABLES.SONG_COLLATIONS)
    .select(
      `${FIELDS}, collator:${TABLES.USERS}!created_by(name), reviser:${TABLES.USERS}!updated_by(name)`,
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
    quote: tr(r.quote),
    sung: tr(r.sung),
    body: tr(r.body) ?? "",
    collator: r.created_by ? (r.collator?.name ?? null) : null,
    // 自己改自己的不另署「订」
    reviser:
      r.updated_by && r.updated_by !== r.created_by
        ? (r.reviser?.name ?? null)
        : null,
  }));
}

function userClient(accessToken: string) {
  const db = getUserClient(accessToken);
  if (!db) throw new Error("Supabase client unavailable");
  return db;
}

function toRow(input: CollationInput) {
  return { anchor: "lyrics" as const, ...input };
}

/** 新增一条，返回 id */
export async function createCollation(
  songId: number,
  input: CollationInput,
  accessToken: string,
): Promise<number> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.SONG_COLLATIONS)
    .insert({ song_id: songId, ...toRow(input) })
    .select("id")
    .single();
  // 外键失败：歌不在正式曲库
  if (error?.code === "23503") {
    throw new CollationError("歌曲尚未发布，发布后才能写校记", 400);
  }
  if (error) throw error;
  return (data as { id: number }).id;
}

/** 修改一条，返回所在的歌，好刷新那一页 */
export async function updateCollation(
  id: number,
  input: CollationInput,
  accessToken: string,
): Promise<number> {
  const { data, error } = await userClient(accessToken)
    .from(TABLES.SONG_COLLATIONS)
    .update(toRow(input))
    .eq("id", id)
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
