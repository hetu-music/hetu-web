import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import {
  emailField,
  newPasswordField,
  otpCodeField,
} from "@/lib/forms/account-rules";
import { authErrorResponse } from "@/lib/server/auth-errors";
import { signOutOtherSessions, withPublicAuth } from "@/lib/server/auth-route";
import { clearAuthCookies } from "@/lib/server/server-utils";

const schema = z.object({
  email: emailField,
  otp: otpCodeField,
  password: newPasswordField,
});

/**
 * 找回密码第二步：验证码与新密码一起交上来，在一个请求里验码、改密。
 *
 * 不拆成「先验码、再改密」两个接口：验码成功就有了会话，第二个接口只能凭会话
 * 放行不带旧密码的改密，那么任何一个被盗的会话都能绕过改密页对旧密码的核对。
 *
 * 改完退出其他设备：找回密码多半是怕账号被别人用了。
 */
export const POST = withPublicAuth(
  "POST /api/auth/recovery/reset",
  schema,
  async ({ email, otp, password }) => {
    const supabase = await createSupabaseServerClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "recovery",
    });
    if (verifyError) {
      return authErrorResponse(
        "POST /api/auth/recovery/reset",
        verifyError,
        "验证失败",
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    // 新密码与原密码相同：密码本来就是用户想要的那个，当作成功
    if (updateError && updateError.code !== "same_password") {
      // 验证码已经用掉、会话已经建立，密码却没改成：退掉这次会话，
      // 免得用户以为改好了。要重来就得重发验证码
      await supabase.auth.signOut({ scope: "local" });
      await clearAuthCookies();
      return authErrorResponse(
        "POST /api/auth/recovery/reset",
        updateError,
        "重设失败，请重新获取验证码",
      );
    }

    await signOutOtherSessions(supabase, "POST /api/auth/recovery/reset");

    return NextResponse.json({ success: true });
  },
);
