import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  updateOccurrence,
  deleteOccurrence,
  getOccurrenceRefs,
} from "@/lib/server/service-imagery";
import { refreshImagery } from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const UpdateOccurrenceSchema = z.object({
  imagery_id: z.number().int().positive().optional(),
  category_id: z.number().int().positive().optional(),
  meaning_id: z.number().int().positive().nullable().optional(),
  lyric_timetag: z.array(z.string()).optional(),
});

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = parseInt(segments[segments.length - 1], 10);
  return isNaN(id) || id < 1 ? null : id;
}

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const id = getIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateOccurrenceSchema,
      );
      if (invalid) return invalid;
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      // 换了意象的话，原意象的歌曲列表也要刷新
      const before = await getOccurrenceRefs(id);
      const updated = await updateOccurrence(id, input, session.access_token);
      await refreshImagery({
        songIds: [updated.song_id],
        imageryIds: [
          updated.imagery_id,
          ...(before ? [before.imagery_id] : []),
        ],
      });
      return NextResponse.json(updated);
    } catch (e) {
      if (
        e instanceof Error &&
        (e as Error & { code?: string }).code === "NOT_LEAF_CATEGORY"
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[PUT /api/admin/occurrences/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

export const DELETE = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const id = getIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const before = await getOccurrenceRefs(id);
      await deleteOccurrence(id, session.access_token);
      if (before) {
        await refreshImagery({
          songIds: [before.song_id],
          imageryIds: [before.imagery_id],
        });
      }
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[DELETE /api/admin/occurrences/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
