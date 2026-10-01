"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import { useUserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils/utils";
import MoreMenu from "@/components/shared/MoreMenu";
import {
  NAV_ACTIONS_CLASS,
  NAV_BAR_CLASS,
  NAV_BAR_INNER_CLASS,
  NAV_BUTTON_CLASS,
} from "@/components/shared/nav-button";
import { InstallButton } from "@/components/pwa/useInstallAction";
import { Info, Share2, User } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import React, { forwardRef, useCallback } from "react";

interface AppNavbarProps {
  /** 点击站名，默认回主页 */
  onTitleClick?: () => void;
  onAboutClick?: () => void;
  /** 分享本页：宽屏平铺在顶栏，窄屏收进「更多」 */
  onShare?: () => void;
  titleTooltip?: string;
  /** 登录注册页本身就是登录入口，不需要用户按钮 */
  showUser?: boolean;
  className?: string;
}

/**
 * 首页、意象、测试、登录注册等以站名开头的页面共用的顶栏。外壳、间距与歌曲页一致，
 * 只是左侧放站名而不是返回按钮。
 */
const AppNavbar = forwardRef<HTMLElement, AppNavbarProps>(function AppNavbar(
  {
    onTitleClick,
    onAboutClick,
    onShare,
    titleTooltip,
    showUser = true,
    className,
  },
  ref,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loaded } = useUserContext();
  const tNav = useTranslations("common.nav");
  const tLogo = useTranslations("common.site.logo");

  const handleTitleClick = useCallback(() => {
    if (onTitleClick) onTitleClick();
    else router.push("/");
  }, [onTitleClick, router]);

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
    <nav ref={ref} className={cn(NAV_BAR_CLASS, className)}>
      <div className={NAV_BAR_INNER_CLASS}>
        <button
          onClick={handleTitleClick}
          className="flex min-w-0 cursor-pointer items-center gap-1 text-2xl font-bold tracking-tight text-slate-900 transition-colors hover:text-(--tone) dark:text-white dark:hover:text-(--tone) font-serif"
          title={titleTooltip ?? tNav("backToHome")}
        >
          {tLogo("part1")}
          {/* 站名中间的竖线是站标的一部分，固定用蓝色，不随页面强调色变 */}
          <span className="mx-2 h-5 w-0.5 translate-y-[1.5px] rounded-full bg-blue-600" />
          {tLogo("part2")}
        </button>
        <div className={NAV_ACTIONS_CLASS}>
          {onAboutClick && (
            <button
              onClick={onAboutClick}
              className={NAV_BUTTON_CLASS}
              title={tNav("about")}
            >
              <Info size={20} />
            </button>
          )}
          {showUser && (
            <button
              onClick={openUserPanel}
              className={cn(
                NAV_BUTTON_CLASS,
                "disabled:opacity-50 disabled:cursor-wait",
              )}
              title={
                !loaded ? tNav("loading") : user ? user.name : tNav("login")
              }
              disabled={!loaded}
            >
              <User size={20} className={user ? "text-(--tone)" : ""} />
            </button>
          )}

          {/* 宽屏平铺 分享、安装、语言 和 主题切换 */}
          <div className="hidden md:flex items-center gap-2">
            {onShare && (
              <button
                onClick={onShare}
                className={NAV_BUTTON_CLASS}
                title={tNav("share")}
                aria-label={tNav("share")}
              >
                <Share2 size={20} />
              </button>
            )}
            <InstallButton className={NAV_BUTTON_CLASS} />
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          {/* 窄屏收进「更多」 */}
          <div className="flex md:hidden relative">
            <MoreMenu
              actions={
                onShare
                  ? [
                      {
                        key: "share",
                        icon: Share2,
                        label: tNav("share"),
                        onClick: onShare,
                      },
                    ]
                  : []
              }
            />
          </div>
        </div>
      </div>
    </nav>
  );
});

export default AppNavbar;
