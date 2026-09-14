"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import React, { createContext, useCallback, useContext } from "react";
import { getCsrfToken } from "@/lib/api/csrf";

export interface UserInfo {
  id: string;
  email?: string;
  name: string;
  display: boolean;
  intro: string | null;
  isAdmin: boolean;
  isSuper: boolean;
  hasBenefits: boolean;
}

interface UserContextValue {
  user: UserInfo | null;
  loaded: boolean;
  isLoggedIn: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
  loggingOut: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

async function fetchCurrentUser(): Promise<UserInfo | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    return null;
  }

  return res.json();
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const {
    data: user = null,
    isPending,
    refetch: refetchUser,
  } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
      });

      if (!response.ok) {
        throw new Error("退出登录失败");
      }
    },
    onSuccess: () => {
      // 直接跳转到带当前语言前缀的登录页。由于是全页刷新跳转（window.location.href），整个 React 状态和内存缓存会自动清空。
      // 避免在跳转成功前瞬间清空 queryData，从而解决页面闪烁显示“访客”UI 的视觉不连贯问题。
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/${locale}/login`;
    },
  });

  const refetch = useCallback(async () => {
    await refetchUser();
  }, [refetchUser]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = React.useMemo(
    () => ({
      user,
      loaded: !isPending,
      isLoggedIn: !!user,
      refetch,
      logout,
      loggingOut: logoutMutation.isPending,
    }),
    [user, isPending, refetch, logout, logoutMutation.isPending],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
