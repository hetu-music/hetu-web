import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  getImageryWithCounts,
  createImagery,
} from "@/lib/server/service-imagery";
import {
  refreshImagery,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const CreateImagerySchema = z.object({
  name: z.string().min(1).max(50),
});

export const GET = withAuth(
  async (_request: NextRequest, _user: AuthenticatedUser) => {
    try {
      // 后台要看到全部词，包括只在争议歌曲里出现、或已没有标注的
      const items = await getImageryWithCounts();
      return NextResponse.json(items);
    } catch (e) {
      console.error("[GET /api/admin/imagery]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);

export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateImagerySchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const created = await createImagery(input.name, session.access_token);
      const purge = await refreshImagery();
      return withPurgeStatus(NextResponse.json(created), purge);
    } catch (e) {
      console.error("[POST /api/admin/imagery]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
