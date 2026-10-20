import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { TABLES } from "@/lib/db/supabase-server";
import { displayNameField, introField } from "@/lib/forms/account-rules";
import { parseJsonBody, serverErrorResponse } from "@/lib/server/server-utils";

const schema = z.object({
  displayName: displayNameField,
  intro: introField.nullable().optional(),
  display: z.boolean().optional(),
});

/** 更新自己的公开资料：用户名、简介；管理员另可设「公开展示」 */
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    const update: { name: string; intro?: string | null; display?: boolean } = {
      name: data.displayName,
    };
    if (data.intro !== undefined) update.intro = data.intro || null;
    // 「公开展示」会把名字挂到关于页的维护团队里，只有管理员能给自己开。
    // 前端只对管理员显示这个开关，但接口不能只靠前端：普通用户直接调接口也得挡住。
    // 带了就忽略，不报错——普通用户的请求里本不该有它
    if (data.display !== undefined && user.app_metadata?.is_admin === true) {
      update.display = data.display;
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from(TABLES.USERS)
      .update(update)
      .eq("id", user.id);
    if (error) {
      return serverErrorResponse(
        "POST /api/auth/account",
        error,
        "保存失败",
        400,
      );
    }

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
