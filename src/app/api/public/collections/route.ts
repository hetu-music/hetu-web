import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { getSongsByIds } from "@/lib/server/service-songs";
import { TABLES } from "@/lib/db/supabase-server";

const TARGET_TYPE_FAVORITE = 0;

// GET /api/public/collections — 获取当前用户的收藏，返回 songIds 和完整 songs 数据
export const GET = withAuth(
  async (_request: NextRequest, user: AuthenticatedUser) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from(TABLES.COLLECTIONS)
      .select("song_id, created_at, review, snippet")
      .eq("user_id", user.id)
      .eq("target_type", TARGET_TYPE_FAVORITE)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET collections error:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const songIds: number[] = data.map((r) => r.song_id);

    if (songIds.length === 0) {
      return NextResponse.json({ songIds: [], songs: [] });
    }

    // 服务端直接查歌曲数据，避免客户端二次请求。
    // 只查收藏涉及的这几首，不再拉全表——songIds 通常是个位数到几十。
    const locale = _request.cookies.get("NEXT_LOCALE")?.value || "zh-CN";
    const favoriteSongs = await getSongsByIds(songIds, locale);

    // 从数据行转为映射
    const idToCol = Object.fromEntries(
      data.map((r) => [
        r.song_id,
        {
          created_at: r.created_at,
          review: r.review,
          snippet: r.snippet,
        },
      ]),
    );

    // 按 songIds 的顺序（收藏时间倒序）重排，与此前行为一致
    const songById = new Map(favoriteSongs.map((s) => [s.id, s]));
    const songs = songIds
      .map((id) => songById.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((song) => ({
        ...song,
        collectionInfo: idToCol[song.id],
      }));

    return NextResponse.json({ songIds, songs });
  },
);

// POST /api/public/collections — 添加收藏
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const body = await request.json();
    const songId = Number(body?.songId);
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid songId" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from(TABLES.COLLECTIONS).insert({
      user_id: user.id,
      song_id: songId,
      target_type: TARGET_TYPE_FAVORITE,
    });

    if (error) {
      // 唯一约束冲突 — 已收藏，视为成功
      if (error.code === "23505") {
        return NextResponse.json({ success: true });
      }
      console.error("POST collections error:", error);
      return NextResponse.json({ error: "Failed to add" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);

// DELETE /api/public/collections — 取消收藏
export const DELETE = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const body = await request.json();
    const songId = Number(body?.songId);
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid songId" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from(TABLES.COLLECTIONS)
      .delete()
      .eq("user_id", user.id)
      .eq("song_id", songId)
      .eq("target_type", TARGET_TYPE_FAVORITE);

    if (error) {
      console.error("DELETE collections error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
