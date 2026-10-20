import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-auth";
import { clearAuthCookies, parseJsonBody } from "@/lib/server/server-utils";
import { withAuth, type AuthenticatedUser } from "@/lib/server/server-auth";

const schema = z.object({
  /** 不带：退出当前设备；others：退出其他设备，当前设备保留 */
  scope: z.enum(["others"]).optional(),
});

export const POST = withAuth(
  async (request: NextRequest, _user: AuthenticatedUser) => {
    const { data, response } = await parseJsonBody(request, schema);
    if (response) return response;

    try {
      const supabase = await createSupabaseServerClient();

      if (data.scope === "others") {
        // 其他会话的 refresh token 当场作废；它们手里的 access token 也随即失效，
        // 因为每个接口都用 getUser 向 GoTrue 核对，而 GoTrue 会查会话是否还在
        const { error } = await supabase.auth.signOut({ scope: "others" });
        if (error) {
          console.error("Supabase signOut others error:", error);
          return NextResponse.json({ error: "操作失败" }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase signOut error:", error);
        return NextResponse.json({ error: "Logout failed" }, { status: 500 });
      }

      // 清理认证相关的 cookies
      await clearAuthCookies();

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Logout error:", error);
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }
  },
  { requireCSRF: true },
);
