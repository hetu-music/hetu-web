import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { getServiceClient } from "@/lib/db/supabase-server";
import {
  CommentError,
  commentIdFromUrl,
  likeComment,
  unlikeComment,
} from "@/lib/server/service-comments";
import { serverErrorResponse } from "@/lib/server/server-utils";

async function handle(
  request: NextRequest,
  user: AuthenticatedUser,
  action: typeof likeComment,
  scope: string,
) {
  const id = commentIdFromUrl(request);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  // 走 service 连接：库里不给 authenticated 写 comment_likes，能不能赞在 likeComment 里查
  const supabase = getServiceClient();
  if (!supabase) {
    return serverErrorResponse(
      scope,
      new Error("Supabase service client unavailable"),
    );
  }
  try {
    await action(supabase, user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return serverErrorResponse(scope, error);
  }
}

// POST /api/public/comments/[id]/like — 赞
export const POST = withAuth(
  (request, user) =>
    handle(request, user, likeComment, "POST /api/public/comments/[id]/like"),
  { requireCSRF: true },
);

// DELETE /api/public/comments/[id]/like — 取消赞
export const DELETE = withAuth(
  (request, user) =>
    handle(
      request,
      user,
      unlikeComment,
      "DELETE /api/public/comments/[id]/like",
    ),
  { requireCSRF: true },
);
