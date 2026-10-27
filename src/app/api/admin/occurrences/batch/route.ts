import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  createOccurrencesBatch,
  getOccurrencesForSong,
} from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { parseJsonBody } from "@/lib/server/parse-body";

const BatchSchema = z.object({
  song_id: z.number().int().positive(),
  items: z
    .array(
      z.union([
        z.object({
          imagery_id: z.number().int().positive(),
          category_id: z.number().int().positive(),
        }),
        // 审核时改成了词典里没有的意象，保存时创建
        z.object({
          imagery_name: z.string().trim().min(1).max(50),
          category_id: z.number().int().positive(),
        }),
      ]),
    )
    .min(1)
    .max(200),
});

/** 批量新增一首歌的意象标注：POST /api/admin/occurrences/batch */
export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        BatchSchema,
      );
      if (invalid) return invalid;
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await createOccurrencesBatch(
        input.song_id,
        input.items,
        session.access_token,
      );
      if (result.created === 0) return NextResponse.json(result);
      // 新意象名可能落到已有意象上，按入库后的标注取母题
      const occurrences = await getOccurrencesForSong(input.song_id);
      const purge = await refreshImagery({
        songIds: [input.song_id],
        motifIds: occurrences.map((o) => o.category_id),
      });
      return withPurgeStatus(NextResponse.json(result), purge);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        e instanceof Error &&
        (code === "NOT_LEAF_CATEGORY" ||
          code === "SONG_NOT_PUBLISHED" ||
          code === "IMAGERY_NOT_IN_LYRICS")
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[POST /api/admin/occurrences/batch]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
