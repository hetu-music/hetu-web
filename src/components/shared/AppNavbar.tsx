"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import { useUserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils/utils";
import MoreMenu from "@/components/shared/MoreMenu";
import { Info, User } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import React, { forwardRef, useCallback } from "react";

interface AppNavbarProps {
  title: React.ReactNode;
  onTitleClick: () => void;
  onAboutClick?: () => void;
  titleTooltip?: string;
  className?: string;
}

const AppNavbar = forwardRef<HTMLElement, AppNavbarProps>(function AppNavbar(
  { title, onTitleClick, onAboutClick, titleTooltip = "返回首页", className },
  ref,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loaded } = useUserContext();

  const openUserPanel = useCallback(() => {
    // 登录状态尚未同步完成，忽略点击，避免误跳转到登录页
    if (!loaded) return;

    if (!user) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    }

    const navDepth = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    sessionStorage.setItem("__hetu_web_nav_depth", String(navDepth + 1));
    router.push("/profile?tab=favorites");
  }, [router, pathname, user, loaded]);

  return (
    <nav
      ref={ref}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 bg-[#FAFAFA]/80 backdrop-blur-md transition-colors duration-500 dark:border-slate-800/50 dark:bg-[#0B0F19]/80",
        className,
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <button
          onClick={onTitleClick}
          className="flex cursor-pointer items-center gap-1 text-2xl font-bold tracking-tight text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400 font-serif"
          title={titleTooltip}
        >
          {title}
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onAboutClick && (
            <button
              onClick={onAboutClick}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800"
              title="关于"
            >
              <Info size={20} />
            </button>
          )}
          <button
            onClick={openUserPanel}
            className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-wait"
            title={!loaded ? "加载中…" : user ? user.name : "登录"}
            disabled={!loaded}
          >
            <User
              size={20}
              className={user ? "text-blue-500 dark:text-blue-400" : ""}
            />
          </button>

          {/* PC端显示的 语言 和 主题切换 */}
          <div className="hidden md:flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          {/* 移动端显示的“更多”下拉菜单 */}
          <div className="flex md:hidden relative">
            <MoreMenu />
          </div>
        </div>
      </div>
    </nav>
  );
});

export default AppNavbar;
