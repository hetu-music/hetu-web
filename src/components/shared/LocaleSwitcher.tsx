"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/utils";
import { Languages } from "lucide-react";
import { useLocaleSwitch } from "@/hooks/ui";
import LanguageOptions, {
  MENU_PANEL_CLASS,
} from "@/components/shared/LanguageOptions";

export default function LocaleSwitcher({ className }: { className?: string }) {
  const switcher = useLocaleSwitch();
  const { isPending, prefetchAll } = switcher;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={dropdownRef}
      className={cn("relative flex items-center", className)}
      onMouseEnter={prefetchAll}
    >
      {/* 触发按钮：与 ThemeToggle / User / MoreMenu 按钮尺寸及悬浮状态完美统一 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        title="切换语言 / Switch Language"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          "text-slate-600 dark:text-slate-400",
          isOpen
            ? "bg-slate-200/60 dark:bg-slate-800 text-blue-600 dark:text-blue-400"
            : "hover:bg-slate-200/50 dark:hover:bg-slate-800",
          isPending && "opacity-40 cursor-wait animate-pulse",
        )}
      >
        <Languages size={19} />
      </button>

      {/* 下拉菜单浮层：与移动端 MoreMenu 共用同一套外观 */}
      {isOpen && (
        <div role="menu" className={MENU_PANEL_CLASS}>
          <LanguageOptions
            switcher={switcher}
            onSelect={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
