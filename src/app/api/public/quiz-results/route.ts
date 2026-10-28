import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRIVATE_NO_STORE } from "@/lib/server/cache-headers";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { parseJsonBody } from "@/lib/server/parse-body";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { isRecordId } from "@/lib/quiz";
import {
  decodeQuizSlug,
  deleteQuizRecord,
  findQuizRecord,
  listQuizRecords,
  saveQuizRecord,
} from "@/lib/server/service-quiz";

const SlugSchema = z.object({ slug: z.string().max(32) });
const IdSchema = z.object({
  id: z.string().refine(isRecordId, "记录 ID 无效"),
});

// GET /api/public/quiz-results[?slug=<7 位乱码>] — 自己保存的记录，新的在前；
// 带上结果页的乱码时，另给出这份作答已存过的那条记录（savedId）
export const GET = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const locale = request.cookies.get("NEXT_LOCALE")?.value || "zh-CN";
    const slug = request.nextUrl.searchParams.get("slug");
    const answers = slug ? decodeQuizSlug(slug) : null;
    try {
      const supabase = await createSupabaseServerClient();
      const [records, savedId] = await Promise.all([
        listQuizRecords(supabase, user.id, locale),
        answers ? findQuizRecord(supabase, user.id, answers) : null,
      ]);
      return NextResponse.json(
        { records, savedId },
        { headers: { "Cache-Control": PRIVATE_NO_STORE } },
      );
    } catch (error) {
      return serverErrorResponse("GET /api/public/quiz-results", error);
    }
  },
);

// POST /api/public/quiz-results — 保存结果页上的这份结果。
// 只收 7 位乱码，结果在服务端重算
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      SlugSchema,
    );
    if (invalid) return invalid;
    const answers = decodeQuizSlug(input.slug);
    if (!answers) {
      return NextResponse.json({ error: "结果链接无效" }, { status: 400 });
    }

    try {
      const supabase = await createSupabaseServerClient();
      const id = await saveQuizRecord(supabase, user.id, answers);
      if (!id) {
        return NextResponse.json(
          { error: "暂时算不出结果，请稍后重试" },
          { status: 503 },
        );
      }
      return NextResponse.json({ id });
    } catch (error) {
      return serverErrorResponse("POST /api/public/quiz-results", error);
    }
  },
  { requireCSRF: true },
);

// DELETE /api/public/quiz-results — 删除自己的一条记录
export const DELETE = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      IdSchema,
    );
    if (invalid) return invalid;

    try {
      const supabase = await createSupabaseServerClient();
      await deleteQuizRecord(supabase, user.id, input.id);
      return NextResponse.json({ success: true });
    } catch (error) {
      return serverErrorResponse("DELETE /api/public/quiz-results", error);
    }
  },
  { requireCSRF: true },
);
