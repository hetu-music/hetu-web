import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { updateMeaning, deleteMeaning } from "@/lib/server/service-imagery";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { z } from "zod";
import { parseJsonBody } from "@/lib/server/parse-body";

const UpdateMeaningSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

function getIdFromUrl(request: NextRequest): number | null {
  const segments = request.nextUrl.pathname.split("/");
  const id = parseInt(segments[segments.length - 1], 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

export const PUT = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const meaningId = getIdFromUrl(request);
    if (!meaningId)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateMeaningSchema,
      );
      if (invalid) return invalid;

      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const updated = await updateMeaning(
        meaningId,
        input.label,
        input.description ?? null,
        session.access_token,
      );
      return NextResponse.json(updated);
    } catch (e) {
      console.error("[PUT /api/admin/meanings/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);

export const DELETE = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const meaningId = getIdFromUrl(request);
    if (!meaningId)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      await deleteMeaning(meaningId, session.access_token);
      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("[DELETE /api/admin/meanings/[id]]", e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true, requireAdmin: true },
);
