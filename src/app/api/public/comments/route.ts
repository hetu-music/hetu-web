import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  CommentError,
  createComment,
  createCommentSchema,
} from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";

// POST /api/public/comments — 写批注或回复
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
    }

    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "参数校验失败" },
        { status: 400 },
      );
    }

    try {
      const supabase = await createSupabaseServerClient();
      const id = await createComment(supabase, user.id, parsed.data);
      return NextResponse.json({ id }, { status: 201 });
    } catch (error) {
      if (error instanceof CommentError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      return serverErrorResponse("POST /api/public/comments", error);
    }
  },
  { requireCSRF: true },
);
