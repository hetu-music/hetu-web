import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";
import {
  createSupabaseServerClient,
  verifyPassword,
} from "@/lib/db/supabase-auth";
import { newPasswordField } from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { parseJsonBody } from "@/lib/server/auth-route";

const schema = z.object({
  oldPassword: z.string().min(1, "请输入当前密码"),
  newPassword: newPasswordField,
});

/** 改密码：先核对旧密码，改完退出其他设备上的登录（当前设备保留） */
export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    if (!user.email) {
      return NextResponse.json(
        { error: "账号没有邮箱，无法核对密码" },
        { status: 400 },
      );
    }

    const verifyError = await verifyPassword(user.email, data.oldPassword);
    if (verifyError) {
      if (verifyError.code === "invalid_credentials") {
        return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
      }
      return authErrorResponse(
        "POST /api/auth/change-password",
        verifyError,
        "修改失败",
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword,
    });
    if (updateError) {
      return authErrorResponse(
        "POST /api/auth/change-password",
        updateError,
        "修改失败",
      );
    }

    // 密码已经改好，这一步失败只记日志，不把整个操作报成失败
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "others",
    });
    if (signOutError) {
      console.error("[POST /api/auth/change-password] others", signOutError);
    }

    return NextResponse.json({ success: true });
  },
  { requireCSRF: true },
);
