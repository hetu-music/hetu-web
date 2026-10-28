import { useCallback } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { loginPathFor } from "@/lib/utils/safe-next";

/** 去登录页，登录后回到当前页面（带上查询参数） */
export function useGoToLogin() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    router.push(loginPathFor(pathname + window.location.search));
  }, [router, pathname]);
}
