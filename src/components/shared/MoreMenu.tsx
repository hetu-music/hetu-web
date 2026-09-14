"use client";

import { cn } from "@/lib/utils/utils";
import { MoreHorizontal, Sun, Moon } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { runThemeTransition } from "@/lib/theme-transition";
import { useLocaleSwitch } from "@/hooks/ui";
import LanguageOptions, {
  MENU_PANEL_CLASS,
  MenuSectionLabel,
} from "@/components/shared/LanguageOptions";

/**
 * 移动端的"更多设置"二级菜单：把语言切换和主题切换收进一个下拉里，
 * 避免窄屏下导航栏按钮过多。桌面端仍然平铺 LocaleSwitcher / ThemeToggle。
 */
export default function MoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const switcher = useLocaleSwitch();
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
      onMouseEnter={switcher.prefetchAll}
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
        <div role="menu" className={MENU_PANEL_CLASS}>
          {/* 主题切换（卡片选项组） */}
          <div className="flex flex-col gap-1.5">
            <MenuSectionLabel>外观主题 / Theme</MenuSectionLabel>
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
          <LanguageOptions
            switcher={switcher}
            onSelect={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
