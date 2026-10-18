import "server-only";
import { redirect } from "next/navigation";
import {
  type AdminPageSession,
  getAdminPageSession,
} from "@/lib/server/server-auth";
import { loginPathFor } from "@/lib/utils/safe-next";

/**
 * 后台页面的入口校验：未登录去登录页（登录后回到 path），不是管理员也去登录页，
 * superOnly 的板块对普通管理员退回后台首页。
 *
 * 每个 page.tsx 自己调用，不放进 layout：layout 在客户端导航时不会重新渲染，
 * 也挡不住子路由与 Server Action（见 Next.js 文档 authentication「Layouts and auth checks」）。
 */
export async function requireAdminPage(
  locale: string,
  path: string,
  { superOnly = false }: { superOnly?: boolean } = {},
): Promise<AdminPageSession> {
  const session = await getAdminPageSession();
  if (!session) redirect(`/${locale}${loginPathFor(path)}`);
  // 对应 API 同样以 requireSuperAdmin 校验，这里只是不让人进到一个处处报错的页面
  if (superOnly && session.user.app_metadata?.is_super !== true) {
    redirect(`/${locale}/admin`);
  }
  return session;
}
