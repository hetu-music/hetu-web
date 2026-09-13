"use client";

import { cn } from "@/lib/utils/utils";
import { Check } from "lucide-react";
import { LANGUAGES, type useLocaleSwitch } from "@/hooks/ui";

/** 导航栏各下拉浮层共用的外观：圆角、玻璃拟态背景、投影与入场动画 */
export const MENU_PANEL_CLASS = cn(
  "absolute right-0 top-12 z-50 w-56 p-4 rounded-[22px] border",
  "bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl",
  "shadow-[0_20px_40px_-5px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.05)]",
  "dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.05)]",
  "border-slate-200/60 dark:border-slate-800/80",
  "animate-in fade-in slide-in-from-top-2 duration-200 ease-out flex flex-col gap-3",
);

/** 下拉浮层里的分组小标题 */
export function MenuSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
      {children}
    </span>
  );
}

interface LanguageOptionsProps {
  /**
   * 父级持有的 useLocaleSwitch() 结果。
   * 由父级传入而非在此自行调用，否则触发按钮与菜单项会各拿到一个
   * 互不相通的 useTransition，isPending 状态对不上。
   */
  switcher: ReturnType<typeof useLocaleSwitch>;
  /** 选中后的回调，供父级下拉菜单收起自身 */
  onSelect?: () => void;
}

/**
 * 语言选项列表（含分组小标题）。
 * 宽屏的 LocaleSwitcher 与移动端的 MoreMenu 共用，保证两处样式与行为完全一致。
 */
export default function LanguageOptions({
  switcher,
  onSelect,
}: LanguageOptionsProps) {
  const { locale, isPending, switchTo } = switcher;

  return (
    <div className="flex flex-col gap-1.5">
      <MenuSectionLabel>语言 / Language</MenuSectionLabel>
      <div className="flex flex-col gap-1">
        {LANGUAGES.map((lang) => {
          const isActive = lang.code === locale;
          const isCN = lang.code === "zh-CN";
          return (
            <button
              key={lang.code}
              role="menuitem"
              disabled={isPending}
              onClick={() => {
                onSelect?.();
                switchTo(lang.code);
              }}
              className={cn(
                "w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center gap-3 transition-all duration-300 cursor-pointer border hover:translate-x-0.5",
                isActive
                  ? "text-blue-600 dark:text-blue-400 bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/15 dark:border-blue-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 dark:hover:bg-slate-900/50 border-transparent",
                isPending && "opacity-40 cursor-wait",
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
                    : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                )}
              >
                {isCN ? "简" : "繁"}
              </div>
              <span className="flex-1">{lang.label}</span>
              {isActive && (
                <Check size={13} className="text-blue-500 dark:text-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
