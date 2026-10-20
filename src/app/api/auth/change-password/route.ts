import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { newPasswordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import {
  checkCurrentPassword,
  signOutOtherSessions,
} from "@/lib/server/auth-route";
import { parseJsonBody } from "@/lib/server/server-utils";

const SCOPE = "POST /api/auth/change-password";

const schema = z.object({
  oldPassword: z.string().min(1, "请输入当前密码"),
  newPassword: newPasswordField,
});

/** 改密码：先核对旧密码，改完退出其他设备上的登录（当前设备保留） */
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    const rejected = await checkCurrentPassword(user, data.oldPassword, SCOPE);
    if (rejected) return rejected;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });
    if (error) return authErrorResponse(SCOPE, error, "修改失败");

    await signOutOtherSessions(supabase, SCOPE);
    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
