import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  type AuthenticatedUser,
  type AuthContext,
} from "@/lib/server/server-auth";
import { getImagerySuggestions } from "@/lib/server/service-imagery-suggest";

/** 为一首歌生成意象标注候选：GET /api/admin/occurrences/suggestions?song_id= */
export const GET = withAuth(
  async (
    request: NextRequest,
    _user: AuthenticatedUser,
    { accessToken }: AuthContext,
  ) => {
    const songId = Number(request.nextUrl.searchParams.get("song_id"));
    if (!Number.isInteger(songId) || songId < 1) {
      return NextResponse.json({ error: "Invalid song_id" }, { status: 400 });
    }
    try {
      const result = await getImagerySuggestions(songId, accessToken);
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
