"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { LANGUAGES, useLocaleSwitch, useMounted } from "@/hooks/ui";
import { runThemeTransition } from "@/lib/theme-transition";
import { cn } from "@/lib/utils/utils";
import { Globe, Moon, Sun, SunMoon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import React, { useCallback, useId, useMemo, useState } from "react";
import { MenuList, MenuPanel, type MenuItem, useDismiss } from "./overlay";

/** 顶栏 20px 图标的实际线宽（lucide 默认 2/24） */
const ICON_STROKE = (2 * 20) / 24;

/** 主题三选一：跟随系统、浅色、深色 */
export function useThemeChoice() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const tNav = useTranslations("common.nav");

  const items = useMemo<MenuItem[]>(
    () => [
      { id: "system", label: tNav("themeSystem") },
      { id: "light", label: tNav("themeLight") },
      { id: "dark", label: tNav("themeDark") },
    ],
    [tNav],
  );

  const select = useCallback(
    (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
      if (id === theme) return;
      runThemeTransition(e.clientX, e.clientY, () => setTheme(id));
    },
    [theme, setTheme],
  );

  // 主题存在 localStorage 里，服务端不知道，挂载前一律不标当前项
  return {
    items,
    active: mounted ? theme : undefined,
    resolved: mounted ? resolvedTheme : undefined,
    select,
  };
}

/** 简繁切换 */
export function useScriptChoice() {
  const switcher = useLocaleSwitch();
  const items: readonly MenuItem[] = useMemo(
    () => LANGUAGES.map((l) => ({ id: l.code, label: l.label })),
    [],
  );
  return {
    items,
    active: switcher.locale,
    select: (id: string) => switcher.switchTo(id),
    pending: switcher.isPending,
    prefetch: switcher.prefetchAll,
  };
}

/** 宽屏顶栏里带下拉的图标按钮 */
function IconMenu({
  icon,
  title,
  items,
  active,
  onSelect,
  disabled,
  onHover,
}: {
  icon: React.ReactNode;
  title: string;
  items: readonly MenuItem[];
  active: string | undefined;
  onSelect: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  onHover?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const scope = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, scope);

  return (
    <div
      data-dismiss-scope={scope}
      className="relative flex items-center"
      onMouseEnter={onHover}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          NAV_BUTTON_CLASS,
          open && "text-(--tone) dark:text-(--tone)",
          "disabled:opacity-40 disabled:cursor-wait",
        )}
      >
        {icon}
      </button>
      <MenuPanel open={open} align="right" className="w-36">
        <MenuList
          items={items}
          active={active}
          size="sm"
          onSelect={(id, e) => {
            close();
            onSelect(id, e);
          }}
        />
      </MenuPanel>
    </div>
  );
}

export function ThemeMenu() {
  const tNav = useTranslations("common.nav");
  const { items, active, resolved, select } = useThemeChoice();
  // 图标表示当前的设定：跟随系统时显示半日半月，免得和手动选的浅色深色混淆。
  // 半日半月与太阳的主体只是一小块，光芒是细线，按 20px 画会比旁边的图标小一号；
  // 放大图形、线宽仍按 20px 图标的 1.67px，再用负外边距把占位收回 20px，按钮不变大
  const icon =
    active === undefined ? (
      <span className="block w-5 h-5" />
    ) : active === "system" ? (
      <SunMoon
        size={24}
        absoluteStrokeWidth
        strokeWidth={ICON_STROKE}
        className="-m-0.5"
      />
    ) : resolved === "dark" ? (
      <Moon size={20} />
    ) : (
      <Sun
        size={22}
        absoluteStrokeWidth
        strokeWidth={ICON_STROKE}
        className="-m-px"
      />
    );
  return (
    <IconMenu
      icon={icon}
      title={tNav("theme")}
      items={items}
      active={active}
      onSelect={select}
    />
  );
}

export function ScriptMenu() {
  const tNav = useTranslations("common.nav");
  const { items, active, select, pending, prefetch } = useScriptChoice();
  return (
    <IconMenu
      icon={<Globe size={20} />}
      title={tNav("script")}
      items={items}
      active={active}
      onSelect={select}
      disabled={pending}
      onHover={prefetch}
    />
  );
}
