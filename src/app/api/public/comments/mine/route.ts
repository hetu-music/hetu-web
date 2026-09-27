import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { listMyComments } from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";

// GET /api/public/comments/mine — 自己写过的批注与回复，按歌分组
export const GET = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const locale = request.cookies.get("NEXT_LOCALE")?.value || "zh-CN";
    try {
      const supabase = await createSupabaseServerClient();
      const groups = await listMyComments(supabase, user.id, locale);
      return NextResponse.json(
        { groups },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      return serverErrorResponse("GET /api/public/comments/mine", error);
    }
  },
);
