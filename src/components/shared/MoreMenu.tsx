"use client";

import { cn } from "@/lib/utils/utils";
import { useInstallAction } from "@/components/pwa/useInstallAction";
import {
  Download,
  type LucideIcon,
  MoreHorizontal,
  Moon,
  Sun,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { runThemeTransition } from "@/lib/theme-transition";
import { useLocaleSwitch } from "@/hooks/ui";
import LanguageOptions, {
  MENU_PANEL_CLASS,
  MenuSectionLabel,
} from "@/components/shared/LanguageOptions";

export interface MoreMenuAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

/**
 * 移动端的"更多设置"二级菜单：把页面操作（分享等）、安装应用、语言切换和主题切换
 * 收进一个下拉里，避免窄屏下导航栏按钮过多。桌面端这些都平铺在顶栏上。
 */
export default function MoreMenu({
  actions = [],
}: {
  /** 当前页面的操作，排在菜单最上面 */
  actions?: MoreMenuAction[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const install = useInstallAction();
  const items: MoreMenuAction[] = install.available
    ? [
        ...actions,
        {
          key: "install",
          icon: Download,
          label: "安装为应用",
          onClick: install.start,
        },
      ]
    : actions;
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
          {items.length > 0 && (
            <>
              <div className="flex flex-col gap-1">
                {items.map(({ key, icon: Icon, label, onClick }) => (
                  <button
                    key={key}
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false);
                      onClick();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-900/50"
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-200/50 dark:border-slate-800/40" />
            </>
          )}

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

      {install.prompt}
    </div>
  );
}
