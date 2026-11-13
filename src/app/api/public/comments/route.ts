import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getServiceClient } from "@/lib/db/supabase-server";
import {
  CommentError,
  createComment,
  createCommentSchema,
} from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

// POST /api/public/comments — 写批注或回复
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data: input, response: invalid } = await parseJsonBody(
      request,
      createCommentSchema,
    );
    if (invalid) return invalid;

    // 用 service 连接写：库里不给 authenticated 插入评论的权限。限流和内容校验
    // 都在这个接口里，绕过接口直连 PostgREST 写不进去
    const db = getServiceClient();
    if (!db) {
      return serverErrorResponse(
        "POST /api/public/comments",
        new Error("Supabase service client unavailable"),
      );
    }

    try {
      const id = await createComment(db, user.id, input);
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
