import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getOccurrencesForImagery,
  getOccurrencesForSong,
} from "@/lib/server/service-imagery";

// 新增标注（手动一条或审核后多条）统一走 POST /api/admin/occurrences/batch

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { searchParams } = request.nextUrl;
    const imageryIdStr = searchParams.get("imagery_id");
    const songIdStr = searchParams.get("song_id");
    try {
      if (imageryIdStr) {
        const imageryId = parseInt(imageryIdStr, 10);
        if (isNaN(imageryId) || imageryId < 1)
          return NextResponse.json(
            { error: "Invalid imagery_id" },
            { status: 400 },
          );
        const occurrences = await getOccurrencesForImagery(imageryId);
        return NextResponse.json(occurrences);
      } else if (songIdStr) {
        const songId = parseInt(songIdStr, 10);
        if (isNaN(songId) || songId < 1)
          return NextResponse.json(
            { error: "Invalid song_id" },
            { status: 400 },
          );
        const occurrences = await getOccurrencesForSong(songId);
        return NextResponse.json(occurrences);
      } else {
        return NextResponse.json(
          { error: "Missing imagery_id or song_id query param" },
          { status: 400 },
        );
      }
    } catch (e) {
      console.error("[GET /api/admin/occurrences]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);
