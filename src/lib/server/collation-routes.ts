import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  CollationError,
  createCollation,
  deleteCollation,
  type EntryRow,
  updateCollation,
} from "@/lib/server/service-collations";
import {
  refreshCollations,
  withPurgeStatus,
} from "@/lib/server/server-revalidate";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

/**
 * 校记与补遗的写接口：两者同存一表，只是内容的校验和写库的位置不同，
 * 新增、修改、删除的流程一样，由这里统一生成，各自的路由只给 schema 与 toRow。
 */

const id = z.number().int().positive();

async function accessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function failed(route: string, e: unknown) {
  if (e instanceof CollationError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return serverErrorResponse(route, e, "保存失败");
}

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export function entryWriteHandlers<T>(
  route: string,
  schema: z.ZodType<T>,
  toRow: (input: T) => EntryRow,
) {
  const CreateSchema = z.object({ song_id: id, entry: schema });
  const UpdateSchema = z.object({ id, entry: schema });

  const POST = withAuth(
    async (request: NextRequest, _user: AuthenticatedUser) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateSchema,
      );
      if (invalid) return invalid;
      const token = await accessToken();
      if (!token) return unauthorized();
      try {
        const newId = await createCollation(
          input.song_id,
          toRow(input.entry),
          token,
        );
        const purge = await refreshCollations(input.song_id);
        return withPurgeStatus(NextResponse.json({ id: newId }), purge);
      } catch (e) {
        return failed(`POST ${route}`, e);
      }
    },
    { requireCSRF: true, requireAdmin: true },
  );

  const PUT = withAuth(
    async (request: NextRequest, _user: AuthenticatedUser) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateSchema,
      );
      if (invalid) return invalid;
      const token = await accessToken();
      if (!token) return unauthorized();
      try {
        const songId = await updateCollation(
          input.id,
          toRow(input.entry),
          token,
        );
        const purge = await refreshCollations(songId);
        return withPurgeStatus(NextResponse.json({ success: true }), purge);
      } catch (e) {
        return failed(`PUT ${route}`, e);
      }
    },
    { requireCSRF: true, requireAdmin: true },
  );

  return { POST, PUT };
}

/** 删除不分校记、补遗 */
export const deleteEntryHandler = (route: string) =>
  withAuth(
    async (request: NextRequest, _user: AuthenticatedUser) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        z.object({ id }),
      );
      if (invalid) return invalid;
      const token = await accessToken();
      if (!token) return unauthorized();
      try {
        const songId = await deleteCollation(input.id, token);
        const purge = await refreshCollations(songId);
        return withPurgeStatus(NextResponse.json({ success: true }), purge);
      } catch (e) {
        return failed(`DELETE ${route}`, e);
      }
    },
    { requireCSRF: true, requireAdmin: true },
  );
