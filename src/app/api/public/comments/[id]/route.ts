import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  CommentError,
  commentIdFromUrl,
  deleteComment,
  editComment,
  editCommentSchema,
} from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";

function errorResponse(scope: string, error: unknown) {
  if (error instanceof CommentError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return serverErrorResponse(scope, error);
}

// PATCH /api/public/comments/[id] — 修改自己的批注
export const PATCH = withAuth(
  async (request: NextRequest) => {
    const id = commentIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
    }
    const parsed = editCommentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "参数校验失败" },
        { status: 400 },
      );
    }

    try {
      const supabase = await createSupabaseServerClient();
      await editComment(supabase, id, parsed.data.body);
      return NextResponse.json({ success: true });
    } catch (error) {
      return errorResponse("PATCH /api/public/comments/[id]", error);
    }
  },
  { requireCSRF: true },
);

// DELETE /api/public/comments/[id] — 删除自己的批注
export const DELETE = withAuth(
  async (request: NextRequest) => {
    const id = commentIdFromUrl(request);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
      const supabase = await createSupabaseServerClient();
      await deleteComment(supabase, id);
      return NextResponse.json({ success: true });
    } catch (error) {
      return errorResponse("DELETE /api/public/comments/[id]", error);
    }
  },
  { requireCSRF: true },
);
