import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  deleteUnusedMotifs,
  getUnusedMotifs,
} from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { parseJsonBody } from "@/lib/server/parse-body";

const DeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
});

async function accessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** 没有标注的母题及登记了它的词：GET /api/admin/imagery/categories/unused */
export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const token = await accessToken();
      if (!token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.json(await getUnusedMotifs(token));
    } catch (e) {
      console.error("[GET /api/admin/imagery/categories/unused]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);

/** 删掉其中选中的：只删服务端重查后仍然没用上的，返回实际删掉的 id 与换了默认母题的词 */
export const DELETE = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        DeleteSchema,
      );
      if (invalid) return invalid;
      const token = await accessToken();
      if (!token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const result = await deleteUnusedMotifs(input.ids, token);
      if (result.deleted.length === 0) return NextResponse.json(result);
      // 没有标注的母题不在任何公开页上，但分类树进了意象索引
      const purge = await refreshImagery();
      return withPurgeStatus(NextResponse.json(result), purge);
    } catch (e) {
      console.error("[DELETE /api/admin/imagery/categories/unused]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
