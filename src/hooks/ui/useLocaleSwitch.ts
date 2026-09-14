"use client";

import { useCallback, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

// 语言配置项，未来如需添加英语（en）、日语（ja）等，只需在此追加配置即可
export const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
] as const;

/**
 * 语言切换的共享逻辑：当前语系、切换中状态、切换与预加载。
 * 供 LocaleSwitcher（宽屏）与 MoreMenu（移动端二级菜单）共用，保证两处行为一致。
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // 鼠标悬停时预加载非当前语系，保证流畅度
  const prefetchAll = useCallback(() => {
    LANGUAGES.forEach((lang) => {
      if (lang.code !== locale) {
        router.prefetch(pathname, { locale: lang.code });
      }
    });
  }, [router, pathname, locale]);

  const switchTo = useCallback(
    (targetLocale: string) => {
      if (targetLocale === locale || isPending) return;
      startTransition(() => {
        router.replace(pathname, { locale: targetLocale });
      });
    },
    [router, pathname, locale, isPending],
  );

  return { locale, isPending, switchTo, prefetchAll };
}
