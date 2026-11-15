import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  type AuthenticatedUser,
  type AuthContext,
} from "@/lib/server/server-auth";
import {
  CollationError,
  createCollation,
  deleteCollation,
  type EntryRow,
  updateCollation,
} from "@/lib/server/service-collations";
import { serverErrorResponse } from "@/lib/server/server-utils";
import { parseJsonBody } from "@/lib/server/parse-body";

/**
 * 校记与补遗的写接口：两者同存一表，只是内容的校验和写库的位置不同，
 * 新增、修改、删除的流程一样，由这里统一生成，各自的路由只给 schema 与 toRow。
 * 都写在歌的草稿上，线上不变，不用刷新公开页；发布时再刷新。
 */

const id = z.number().int().positive();

function failed(route: string, e: unknown) {
  if (e instanceof CollationError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return serverErrorResponse(route, e, "保存失败");
}

export function entryWriteHandlers<T>(
  route: string,
  schema: z.ZodType<T>,
  toRow: (input: T) => EntryRow,
) {
  const CreateSchema = z.object({ song_id: id, entry: schema });
  const UpdateSchema = z.object({ id, entry: schema });

  const POST = withAuth(
    async (
      request: NextRequest,
      _user: AuthenticatedUser,
      { accessToken: token }: AuthContext,
    ) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        CreateSchema,
      );
      if (invalid) return invalid;
      try {
        const newId = await createCollation(
          input.song_id,
          toRow(input.entry),
          token,
        );
        return NextResponse.json({ id: newId });
      } catch (e) {
        return failed(`POST ${route}`, e);
      }
    },
    { requireCSRF: true, requireAdmin: true },
  );

  const PUT = withAuth(
    async (
      request: NextRequest,
      _user: AuthenticatedUser,
      { accessToken: token }: AuthContext,
    ) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        UpdateSchema,
      );
      if (invalid) return invalid;
      try {
        await updateCollation(input.id, toRow(input.entry), token);
        return NextResponse.json({ success: true });
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
    async (
      request: NextRequest,
      _user: AuthenticatedUser,
      { accessToken: token }: AuthContext,
    ) => {
      const { data: input, response: invalid } = await parseJsonBody(
        request,
        z.object({ id }),
      );
      if (invalid) return invalid;
      try {
        await deleteCollation(input.id, token);
        return NextResponse.json({ success: true });
      } catch (e) {
        return failed(`DELETE ${route}`, e);
      }
    },
    { requireCSRF: true, requireAdmin: true },
  );
