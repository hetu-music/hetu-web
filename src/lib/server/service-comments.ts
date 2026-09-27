import { getServiceClient, TABLES } from "@/lib/db/supabase-server";
import { getSongsByIds } from "@/lib/server/service-songs";
import type {
  CommentAnchor,
  MyComment,
  MyCommentGroup,
  SongComment,
} from "@/lib/types";
import {
  COMMENT_BODY_MAX,
  COMMENT_QUOTE_MAX,
} from "@/lib/utils/utils-comments";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { z } from "zod";

/**
 * 评点的读写。
 *
 * 读取走高权限客户端：要连带取作者名，而 users 表对他人不可读；
 * 可见范围在查询里自行限定（公开且正常的，加上看的人自己的）。
 * 写入一律用用户会话的客户端，由 RLS 与数据库函数把关。
 */

const STATUS = { NORMAL: 0, PENDING: 1, HIDDEN: 2, DELETED: 3 } as const;
const VISIBILITY = { PUBLIC: 0, PRIVATE: 1 } as const;

/** 每分钟最多发几条，挡住误触连发与刷屏 */
const RATE_LIMIT_PER_MINUTE = 5;

const FIELDS =
  "id, parent_id, user_id, anchor, anchor_index, anchor_time, anchor_quote, body, visibility, status, like_count, created_at, edited_at";

interface CommentRow {
  id: number;
  parent_id: number | null;
  user_id: string;
  anchor: CommentAnchor | null;
  anchor_index: number | null;
  anchor_time: number | string | null;
  anchor_quote: string | null;
  body: string;
  visibility: number;
  status: number;
  like_count: number;
  created_at: string;
  edited_at: string | null;
}

export class CommentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** withAuth 不传路由参数，从路径里取 /comments/[id] */
export function commentIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = Number(segments[segments.indexOf("comments") + 1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ─── 读取 ────────────────────────────────────────────────────────────────────

export async function listSongComments(
  songId: number,
  viewerId: string | null,
): Promise<SongComment[]> {
  const db = getServiceClient();
  if (!db) return [];

  // 已删（3）的批注只为留住回复，内容已清空，照样返回占位
  const publicFilter = `and(visibility.eq.${VISIBILITY.PUBLIC},status.in.(${STATUS.NORMAL},${STATUS.DELETED}))`;
  const filter = viewerId
    ? `${publicFilter},and(user_id.eq.${viewerId},status.in.(${STATUS.NORMAL},${STATUS.PENDING}))`
    : publicFilter;

  const { data, error } = await db
    .from(TABLES.COMMENTS)
    .select(FIELDS)
    .eq("song_id", songId)
    .or(filter)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw error;

  let rows = (data ?? []) as CommentRow[];
  // 已删的批注在回复也都删光后不再显示；父批注不可见的回复一并丢掉
  const liveParents = new Set(
    rows
      .filter((r) => r.parent_id !== null && r.status !== STATUS.DELETED)
      .map((r) => r.parent_id),
  );
  rows = rows.filter(
    (r) => r.status !== STATUS.DELETED || liveParents.has(r.id),
  );
  const ids = new Set(rows.map((r) => r.id));
  rows = rows.filter((r) => r.parent_id === null || ids.has(r.parent_id));
  if (rows.length === 0) return [];

  const authorIds = [
    ...new Set(
      rows.filter((r) => r.status !== STATUS.DELETED).map((r) => r.user_id),
    ),
  ];
  const [authorsRes, likesRes] = await Promise.all([
    authorIds.length > 0
      ? db.from(TABLES.USERS).select("id, name").in("id", authorIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId
      ? db
          .from(TABLES.COMMENT_LIKES)
          .select("comment_id")
          .eq("user_id", viewerId)
          .in("comment_id", [...ids])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (authorsRes.error) throw authorsRes.error;
  if (likesRes.error) throw likesRes.error;

  const names = new Map(
    ((authorsRes.data ?? []) as { id: string; name: string | null }[]).map(
      (u) => [u.id, u.name],
    ),
  );
  const liked = new Set(
    ((likesRes.data ?? []) as { comment_id: number }[]).map(
      (l) => l.comment_id,
    ),
  );

  return rows.map((r) => {
    const deleted = r.status === STATUS.DELETED;
    return {
      id: r.id,
      parentId: r.parent_id,
      anchor: r.anchor,
      anchorIndex: r.anchor_index,
      anchorTime: r.anchor_time === null ? null : Number(r.anchor_time),
      anchorQuote: r.anchor_quote,
      body: deleted ? "" : r.body,
      private: r.visibility === VISIBILITY.PRIVATE,
      pending: r.status === STATUS.PENDING,
      deleted,
      likeCount: r.like_count,
      liked: liked.has(r.id),
      mine: !deleted && r.user_id === viewerId,
      author: deleted ? null : (names.get(r.user_id) ?? null),
      createdAt: r.created_at,
      editedAt: r.edited_at,
    };
  });
}

/**
 * 个人页：自己写过的批注与回复，按歌分组，最近写过的歌在前。
 * 自己的行用用户会话读（RLS 允许读自己的正常与待审批注）；
 * 歌名、所回复的批注及其作者要跨用户读，走高权限客户端。
 */
export async function listMyComments(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
): Promise<MyCommentGroup[]> {
  const { data, error } = await supabase
    .from(TABLES.COMMENTS)
    .select(FIELDS + ", song_id")
    .eq("user_id", userId)
    .in("status", [STATUS.NORMAL, STATUS.PENDING])
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (CommentRow & { song_id: number })[];
  if (rows.length === 0) return [];

  const db = getServiceClient();
  const songIds = [...new Set(rows.map((r) => r.song_id))];
  const parentIds = [
    ...new Set(
      rows.flatMap((r) => (r.parent_id === null ? [] : [r.parent_id])),
    ),
  ];

  const [songs, parentsRes] = await Promise.all([
    getSongsByIds(songIds, locale),
    db && parentIds.length > 0
      ? db
          .from(TABLES.COMMENTS)
          .select("id, user_id, body, status, anchor, anchor_quote")
          .in("id", parentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (parentsRes.error) throw parentsRes.error;
  const parents = new Map(
    (
      (parentsRes.data ?? []) as {
        id: number;
        user_id: string;
        body: string;
        status: number;
        anchor: CommentAnchor;
        anchor_quote: string | null;
      }[]
    ).map((p) => [p.id, p]),
  );

  const authorIds = [...parents.values()].map((p) => p.user_id);
  const names = new Map<string, string | null>();
  if (db && authorIds.length > 0) {
    const { data: users, error: usersError } = await db
      .from(TABLES.USERS)
      .select("id, name")
      .in("id", [...new Set(authorIds)]);
    if (usersError) throw usersError;
    for (const u of (users ?? []) as { id: string; name: string | null }[]) {
      names.set(u.id, u.name);
    }
  }

  const songById = new Map(songs.map((s) => [s.id, s]));
  const groups = new Map<number, MyCommentGroup>();
  for (const r of rows) {
    const song = songById.get(r.song_id);
    if (!song) continue;
    const parent = r.parent_id !== null ? parents.get(r.parent_id) : undefined;
    const parentLive = parent && parent.status === STATUS.NORMAL;
    const comment: MyComment = {
      id: r.id,
      anchor: (parent ? parent.anchor : r.anchor) ?? "song",
      anchorQuote: parent ? parent.anchor_quote : r.anchor_quote,
      body: r.body,
      private: r.visibility === VISIBILITY.PRIVATE,
      pending: r.status === STATUS.PENDING,
      likeCount: r.like_count,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      isReply: r.parent_id !== null,
      replyTo: parentLive
        ? { author: names.get(parent.user_id) ?? null, body: parent.body }
        : null,
    };
    const group = groups.get(r.song_id);
    if (group) group.comments.push(comment);
    else
      groups.set(r.song_id, {
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          hascover: song.hascover ?? null,
        },
        comments: [comment],
      });
  }
  // rows 已按时间倒序，Map 的插入顺序即「最近写过的歌在前」
  return [...groups.values()];
}

// ─── 写入 ────────────────────────────────────────────────────────────────────

const body = z
  .string()
  .trim()
  .min(1, "内容不能为空")
  .max(COMMENT_BODY_MAX, `不能超过 ${COMMENT_BODY_MAX} 字`);

export const createCommentSchema = z.union([
  // 顶层批注：必须有位置
  z.object({
    songId: z.number().int().positive(),
    parentId: z.null().optional(),
    anchor: z.enum(["song", "notes", "lyrics", "score"]),
    anchorIndex: z.number().int().min(0).nullable(),
    anchorTime: z.number().min(0).max(99999).nullable(),
    anchorQuote: z.string().max(COMMENT_QUOTE_MAX).nullable(),
    body,
    private: z.boolean(),
  }),
  // 回复：跟随父批注，总是公开
  z.object({
    songId: z.number().int().positive(),
    parentId: z.number().int().positive(),
    body,
  }),
]);

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const editCommentSchema = z.object({ body });

export async function createComment(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCommentInput,
): Promise<number> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await supabase
    .from(TABLES.COMMENTS)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    throw new CommentError("写得太快了，歇一会儿再来", 429);
  }

  const row: Record<string, unknown> =
    input.parentId != null
      ? {
          song_id: input.songId,
          user_id: userId,
          parent_id: input.parentId,
          body: input.body,
        }
      : {
          song_id: input.songId,
          user_id: userId,
          anchor: input.anchor,
          anchor_index: input.anchorIndex,
          anchor_time: input.anchorTime,
          anchor_quote: input.anchorQuote,
          body: input.body,
          visibility: input.private ? VISIBILITY.PRIVATE : VISIBILITY.PUBLIC,
        };

  const { data, error } = await supabase
    .from(TABLES.COMMENTS)
    .insert(row)
    .select("id")
    .single();
  if (error) {
    // 23503 歌曲不存在；23514 回复的对象不可回复（触发器）或字段不合约束
    if (error.code === "23503" || error.code === "23514") {
      throw new CommentError("无法批注", 400);
    }
    throw error;
  }
  return (data as { id: number }).id;
}

function rpcError(error: { code?: string }): never {
  if (error.code === "P0002") throw new CommentError("批注不存在", 404);
  if (error.code === "23514") throw new CommentError("内容不合要求", 400);
  throw error;
}

export async function editComment(
  supabase: SupabaseClient,
  id: number,
  text: string,
): Promise<void> {
  const { error } = await supabase.rpc("edit_comment", {
    p_id: id,
    p_body: text,
  });
  if (error) rpcError(error);
}

export async function deleteComment(
  supabase: SupabaseClient,
  id: number,
): Promise<void> {
  const { error } = await supabase.rpc("delete_comment", { p_id: id });
  if (error) rpcError(error);
}

export async function likeComment(
  supabase: SupabaseClient,
  userId: string,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.COMMENT_LIKES)
    .insert({ comment_id: id, user_id: userId });
  if (!error || error.code === "23505") return; // 已赞过，视为成功
  // 42501 RLS 拒绝：私批、已删或不存在的批注不能赞
  if (error.code === "42501" || error.code === "23503") {
    throw new CommentError("批注不存在", 404);
  }
  throw error;
}

export async function unlikeComment(
  supabase: SupabaseClient,
  userId: string,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.COMMENT_LIKES)
    .delete()
    .eq("comment_id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
