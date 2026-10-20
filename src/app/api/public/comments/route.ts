import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
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

    try {
      const supabase = await createSupabaseServerClient();
      const id = await createComment(supabase, user.id, input);
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
