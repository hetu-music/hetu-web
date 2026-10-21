import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getOccurrencesForImagery,
  getOccurrencesForSong,
  createOccurrence,
} from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const CreateOccurrenceSchema = z.object({
  song_id: z.number().int().positive(),
  imagery_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  meaning_id: z.number().int().positive().nullable().optional(),
  lyric_timetag: z.array(z.string()).default([]),
});

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

export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateOccurrenceSchema,
      );
      if (invalid) return invalid;
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const created = await createOccurrence(input, session.access_token);
      const purge = await refreshImagery({
        songIds: [created.song_id],
        imageryIds: [created.imagery_id],
      });
      return withPurgeStatus(NextResponse.json(created), purge);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "NOT_LEAF_CATEGORY"
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[POST /api/admin/occurrences]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
