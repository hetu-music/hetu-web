import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { reviewImagerySuggestions } from "@/lib/server/service-imagery-suggest";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { LlmError } from "@/lib/server/llm";
import { parseJsonBody } from "@/lib/server/parse-body";

const ReviewSchema = z.object({
  song_id: z.number().int().positive(),
  candidates: z
    .array(
      z.object({
        imageryId: z.number().int(),
        name: z.string().trim().min(1).max(50),
        rate: z.number().min(0).max(1).nullable(),
        recommended: z.boolean(),
      }),
    )
    .max(300),
});

/**
 * 用 LLM 校验意象标注候选：POST /api/admin/occurrences/review
 * 每次调用都会产生模型费用，因此走 POST + CSRF，由管理员手动触发。
 */
export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        ReviewSchema,
      );
      if (invalid) return invalid;
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await reviewImagerySuggestions(
        input.song_id,
        input.candidates,
        session.access_token,
      );
      if (!result)
        return NextResponse.json({ error: "Song not found" }, { status: 404 });
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof LlmError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.code === "NOT_CONFIGURED" ? 503 : 502 },
        );
      }
      console.error("[POST /api/admin/occurrences/review]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
