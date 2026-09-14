"use client";

import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { runThemeTransition } from "@/lib/theme-transition";

interface ThemeToggleProps {
  /**
   * 自定义按钮样式类名
   * @default "p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
   */
  className?: string;
}

/**
 * 主题切换按钮组件
 *
 * 支持明暗主题切换，带有优雅的视图过渡动画效果
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    runThemeTransition(e.clientX, e.clientY, () => {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    });
  };

  const defaultClassName =
    "p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400";

  return (
    <button
      onClick={toggleTheme}
      className={className || defaultClassName}
      title={
        mounted
          ? resolvedTheme === "dark"
            ? "暗色主题"
            : "亮色主题"
          : "主题切换"
      }
      aria-label="切换主题"
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Moon size={20} className="animate-in fade-in duration-200" />
        ) : (
          <Sun size={20} className="animate-in fade-in duration-200" />
        )
      ) : (
        <div className="w-5 h-5" />
      )}
    </button>
  );
}
