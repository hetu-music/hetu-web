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
import { parseJsonBody } from "@/lib/server/parse-body";

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

    const { data: input, response: invalid } = await parseJsonBody(
      request,
      editCommentSchema,
    );
    if (invalid) return invalid;

    try {
      const supabase = await createSupabaseServerClient();
      await editComment(supabase, id, input.body);
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
