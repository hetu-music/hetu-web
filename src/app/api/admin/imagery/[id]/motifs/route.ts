import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { setWordMotifs } from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { parseJsonBody } from "@/lib/server/parse-body";

const id = z.number().int().positive();
const WordMotifsSchema = z.object({
  primary: id,
  alternatives: z.array(id).max(20),
  parts: z.array(id).max(20),
});

/** 路径是 /api/admin/imagery/[id]/motifs，词的 id 在倒数第二段 */
function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const value = parseInt(segments[segments.length - 2], 10);
  return isNaN(value) || value < 1 ? null : value;
}

/**
 * 整体改写一个词登记的母题：PUT /api/admin/imagery/[id]/motifs。
 * imagery_motifs 只在后台用（标注时的候选、检查、整理），公开页面不读，不用刷新缓存
 */
export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const imageryId = getIdFromUrl(request);
    if (!imageryId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        WordMotifsSchema,
      );
      if (invalid) return invalid;
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const saved = await setWordMotifs(imageryId, input, session.access_token);
      return NextResponse.json(saved);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        e instanceof Error &&
        (code === "NOT_MOTIF" ||
          code === "DUPLICATE_MOTIF" ||
          code === "MOTIF_IN_USE")
      ) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("[PUT /api/admin/imagery/[id]/motifs]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
