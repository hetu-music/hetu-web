import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  updateImagery,
  getOccurrencesForImagery,
} from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const UpdateImagerySchema = z.object({
  name: z.string().min(1).max(50),
});

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = parseInt(segments[segments.length - 1], 10);
  return isNaN(id) || id < 1 ? null : id;
}

export const GET = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const imageryId = getIdFromUrl(request);
    if (!imageryId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    try {
      const occurrences = await getOccurrencesForImagery(imageryId);
      return NextResponse.json(occurrences);
    } catch (e) {
      console.error("[GET /api/admin/imagery/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireAdmin: true },
);

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const imageryId = getIdFromUrl(request);
    if (!imageryId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateImagerySchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const updated = await updateImagery(
        imageryId,
        input.name,
        session.access_token,
      );
      return NextResponse.json(updated);
    } catch (e) {
      console.error("[PUT /api/admin/imagery/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
