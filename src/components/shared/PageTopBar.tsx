"use client";

import { InstallButton } from "@/components/pwa/useInstallAction";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import MoreMenu, { type MoreMenuAction } from "@/components/shared/MoreMenu";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { ArrowLeft, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

/**
 * 没有目录的页面（个人中心、登录注册）共用的顶栏，与歌曲页一致：
 * 左侧返回与回主页，右侧宽屏平铺安装、语言、主题，窄屏收进「更多」。
 */
export default function PageTopBar({ title }: { title?: string }) {
  const router = useRouter();
  const tNav = useTranslations("common.nav");

  // 通过导航深度判断是否有站内历史，没有就回主页（同歌曲页）
  const handleBack = useCallback(() => {
    const navDepth = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    if (navDepth > 0) {
      sessionStorage.setItem("__hetu_web_nav_depth", String(navDepth - 1));
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  const goHome = useCallback(() => router.push("/"), [router]);
  const moreActions = useMemo<MoreMenuAction[]>(
    () => [{ key: "home", icon: Home, label: tNav("home"), onClick: goHome }],
    [tNav, goHome],
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 -ml-2 shrink-0">
            <button
              onClick={handleBack}
              className={cn(NAV_BUTTON_CLASS, "group")}
              title={tNav("back")}
            >
              <ArrowLeft
                size={20}
                className="transition-transform group-hover:-translate-x-0.5"
              />
            </button>

            {/* 窄屏放不下，回主页收进「更多」 */}
            <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
            <button
              onClick={goHome}
              className={cn(NAV_BUTTON_CLASS, "group hidden md:inline-flex")}
              title={tNav("home")}
            >
              <Home
                size={20}
                className="transition-transform group-hover:scale-105 group-active:scale-95"
              />
            </button>
          </div>

          {title && (
            <h1 className="px-2 min-w-0 truncate font-serif text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <InstallButton className={NAV_BUTTON_CLASS} />
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex md:hidden relative">
            <MoreMenu actions={moreActions} />
          </div>
        </div>
      </div>
    </nav>
  );
}
