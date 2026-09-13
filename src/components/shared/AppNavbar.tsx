"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import LocaleSwitcher from "@/components/shared/LocaleSwitcher";
import { useUserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils/utils";
import { Info, User, MoreHorizontal, Check, Sun, Moon } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import React, {
  forwardRef,
  useCallback,
  useState,
  useRef,
  useEffect,
  useTransition,
} from "react";
import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { runThemeTransition } from "@/lib/theme-transition";

const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
];

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

function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { setTheme, resolvedTheme } = useTheme();

  // 点击外部区域自动收起下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 预加载非当前语系
  const handlePrefetch = useCallback(() => {
    LANGUAGES.forEach((lang) => {
      if (lang.code !== locale) {
        router.prefetch(pathname, { locale: lang.code });
      }
    });
  }, [router, pathname, locale]);

  const handleSwitch = (targetLocale: string) => {
    setIsOpen(false);
    if (targetLocale === locale || isPending) return;
    startTransition(() => {
      router.replace(pathname, { locale: targetLocale });
    });
  };

  const changeTheme = (
    targetTheme: "light" | "dark",
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (resolvedTheme === targetTheme) return;
    runThemeTransition(e.clientX, e.clientY, () => {
      setTheme(targetTheme);
    });
  };

  return (
    <div
      ref={dropdownRef}
      className="relative flex items-center"
      onMouseEnter={handlePrefetch}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="更多设置"
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          "text-slate-600 dark:text-slate-400",
          isOpen
            ? "bg-slate-200/60 dark:bg-slate-800 text-blue-600 dark:text-blue-400"
            : "hover:bg-slate-200/50 dark:hover:bg-slate-800",
        )}
      >
        <MoreHorizontal size={20} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-12 z-50 w-56 p-4 rounded-[22px] border",
            "bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl shadow-[0_20px_40px_-5px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.05)] border-slate-200/60 dark:border-slate-800/80",
            "animate-in fade-in slide-in-from-top-2 duration-200 ease-out flex flex-col gap-3",
          )}
        >
          {/* 主题切换（卡片选项组） */}
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              外观主题 / Theme
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-200/40 dark:bg-slate-900/60 border border-slate-200/20 dark:border-slate-800/40">
              <button
                onClick={(e) => changeTheme("light", e)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer",
                  resolvedTheme === "light"
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200/30"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                )}
              >
                <Sun
                  size={14}
                  className={resolvedTheme === "light" ? "animate-pulse" : ""}
                />
                <span>浅色</span>
              </button>
              <button
                onClick={(e) => changeTheme("dark", e)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer",
                  resolvedTheme === "dark"
                    ? "bg-[#161B2C] text-blue-400 shadow-sm border border-slate-800/50"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                )}
              >
                <Moon
                  size={14}
                  className={resolvedTheme === "dark" ? "animate-pulse" : ""}
                />
                <span>深色</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200/50 dark:border-slate-800/40" />

          {/* 语言选择 */}
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              语言 / Language
            </span>
            <div className="flex flex-col gap-1">
              {LANGUAGES.map((lang) => {
                const isActive = lang.code === locale;
                const isCN = lang.code === "zh-CN";
                return (
                  <button
                    key={lang.code}
                    disabled={isPending}
                    onClick={() => handleSwitch(lang.code)}
                    className={cn(
                      "w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-3 transition-all duration-300 cursor-pointer border hover:translate-x-0.5",
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/15 dark:border-blue-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-900/50 border-transparent",
                    )}
                  >
                    {/* 小微标 */}
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform duration-300",
                        isActive
                          ? isCN
                            ? "bg-blue-500 text-white"
                            : "bg-indigo-500 text-white"
                          : isCN
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {isCN ? "简" : "繁"}
                    </div>
                    <span className="flex-1">{lang.label}</span>
                    {isActive && (
                      <Check
                        size={13}
                        className="text-blue-500 dark:text-blue-400"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppNavbar;
