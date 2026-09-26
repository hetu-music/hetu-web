import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getImagerySuggestions } from "@/lib/server/service-imagery-suggest";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";

/** 为一首歌生成意象标注候选：GET /api/admin/occurrences/suggestions?song_id= */
export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const songId = Number(request.nextUrl.searchParams.get("song_id"));
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid song_id" }, { status: 400 });
    }
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await getImagerySuggestions(songId, session.access_token);
      if (!result)
        return NextResponse.json({ error: "Song not found" }, { status: 404 });
      return NextResponse.json(result);
    } catch (e) {
      console.error("[GET /api/admin/occurrences/suggestions]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);
