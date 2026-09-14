"use client";

import { useQuery } from "@tanstack/react-query";
import { getCsrfToken } from "@/lib/api/csrf";

/**
 * 全局共享的 CSRF token hook。
 * 底层走 lib/api/csrf 的模块级缓存，与非 hook 调用方（FavoritesContext、
 * UserContext、AuthClient）共用同一份 token。
 */
export function useCsrfToken() {
  const { data: csrfToken = "" } = useQuery({
    queryKey: ["csrf-token"],
    queryFn: getCsrfToken,
    staleTime: Infinity,
    retry: 2,
  });

  return csrfToken;
}
