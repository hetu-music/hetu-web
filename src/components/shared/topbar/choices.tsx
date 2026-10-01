"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { LANGUAGES, useLocaleSwitch, useMounted } from "@/hooks/ui";
import { runThemeTransition } from "@/lib/theme-transition";
import { cn } from "@/lib/utils/utils";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import React, { useCallback, useId, useMemo, useState } from "react";
import { MenuList, MenuPanel, type MenuItem, useDismiss } from "./overlay";

/** 主题三选一：浅色、深色、跟随系统 */
export function useThemeChoice() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const tNav = useTranslations("common.nav");

  const items = useMemo<MenuItem[]>(
    () => [
      { id: "light", label: tNav("themeLight") },
      { id: "dark", label: tNav("themeDark") },
      { id: "system", label: tNav("themeSystem") },
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
  // 图标表示当前的设定：跟随系统时显示屏幕，免得和手动选的浅色深色混淆
  const icon =
    active === undefined ? (
      <span className="block w-5 h-5" />
    ) : active === "system" ? (
      <Monitor size={20} />
    ) : resolved === "dark" ? (
      <Moon size={20} />
    ) : (
      <Sun size={20} />
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
      icon={<Languages size={20} />}
      title={tNav("script")}
      items={items}
      active={active}
      onSelect={select}
      disabled={pending}
      onHover={prefetch}
    />
  );
}
