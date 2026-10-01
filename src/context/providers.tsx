"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { ChunkErrorHandler } from "@/components/shared/ChunkErrorHandler";
import { BrowserChromeColor } from "@/components/ui/browser-chrome";
import GlobalPlayer from "@/components/shared/GlobalPlayer";
import { UserProvider } from "@/context/UserContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { createQueryClient } from "@/lib/query-client";

// 兼容 React 19 & next-themes:
// next-themes 会在 SSR 期间注入一个阻止主题闪烁的 <script> 标签。
// React 19 对组件内部渲染 <script> 标签的警告在开发模式下会直接阻碍页面运行（弹出 Error Overlay）。
// 此拦截器在开发环境下安全过滤掉此误报，以保证正常的调试体验。
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes(
        "Encountered a script tag while rendering React component",
      )
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(createQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <ChunkErrorHandler />
          <BrowserChromeColor />
          <UserProvider>
            <FavoritesProvider>
              {children}
              {/* GlobalPlayer 在纯 Client 树内，zustand store 是模块级单例，
                  跨路由导航时音频状态完全不受影响 */}
              <GlobalPlayer />
            </FavoritesProvider>
          </UserProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
