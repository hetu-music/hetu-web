import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { newPasswordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { signOutOtherSessions } from "@/lib/server/auth-route";
import { parseJsonBody } from "@/lib/server/parse-body";

const SCOPE = "POST /api/auth/change-password";

const schema = z.object({
  oldPassword: z.string().min(1, "请输入当前密码"),
  newPassword: newPasswordField,
});

/**
 * 改密码，改完退出其他设备上的登录（当前设备保留）。
 *
 * 旧密码由 GoTrue 核对：要开「Require current password when updating」，
 * 否则 current_password 会被忽略，旧密码填什么都能改。开了之后直接调
 * GoTrue 改密码同样要旧密码，拿到会话的人绕过本接口也改不了；
 * 找回密码的会话 GoTrue 自动放行，不受影响。
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
      current_password: data.oldPassword,
    });
    if (error) return authErrorResponse(SCOPE, error, "修改失败");

    await signOutOtherSessions(supabase, SCOPE);
    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
