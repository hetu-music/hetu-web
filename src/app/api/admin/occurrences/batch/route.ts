import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createOccurrencesBatch } from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { lyricTimetagPattern } from "@/lib/forms/imagery-form";

const timetags = z.array(z.string().regex(lyricTimetagPattern)).max(50);

const BatchSchema = z.object({
  song_id: z.number().int().positive(),
  items: z
    .array(
      z.union([
        z.object({
          imagery_id: z.number().int().positive(),
          category_id: z.number().int().positive(),
          lyric_timetag: timetags,
        }),
        // 审核时改成了词典里没有的意象，保存时创建
        z.object({
          imagery_name: z.string().trim().min(1).max(50),
          category_id: z.number().int().positive(),
          lyric_timetag: timetags,
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
      const parsed = BatchSchema.safeParse(await request.json());
      if (!parsed.success)
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.issues },
          { status: 400 },
        );
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await createOccurrencesBatch(
        parsed.data.song_id,
        parsed.data.items,
        session.access_token,
      );
      return NextResponse.json(result);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        e instanceof Error &&
        (code === "NOT_LEAF_CATEGORY" || code === "SONG_NOT_PUBLISHED")
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
