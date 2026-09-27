import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
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
  try {
    const supabase = await createSupabaseServerClient();
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
