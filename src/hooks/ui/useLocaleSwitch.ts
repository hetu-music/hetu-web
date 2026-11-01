"use client";

import { useCallback, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter as useNextRouter } from "next/navigation";
import { flushUrlState } from "@/hooks/utils/useUrlState";
import { getPathname, useRouter, usePathname } from "@/i18n/navigation";

// 语言配置项，未来如需添加英语（en）、日语（ja）等，只需在此追加配置即可。
// 名称各用自己的字形写，不随当前语系翻译：找自己能读的那一项最快
export const LANGUAGES = [
  { code: "zh-CN", label: "简体" },
  { code: "zh-TW", label: "繁體" },
] as const;

/**
 * 语言切换的共享逻辑：当前语系、切换中状态、切换与预加载。
 * 顶栏宽屏的文字下拉与窄屏的「更多」共用，保证两处行为一致。
 */
export function useLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // 鼠标悬停时预加载非当前语系，保证流畅度。
  // 不用 next-intl 的 router.prefetch：带 locale 时它会顺手把 NEXT_LOCALE
  // cookie 改成目标语系，人还没切，cookie 已经变了
  const prefetchAll = useCallback(() => {
    LANGUAGES.forEach((lang) => {
      if (lang.code !== locale) {
        nextRouter.prefetch(getPathname({ href: pathname, locale: lang.code }));
      }
    });
  }, [nextRouter, pathname, locale]);

  const switchTo = useCallback(
    (targetLocale: string) => {
      if (targetLocale === locale || isPending) return;
      // usePathname 不含查询参数和锚点，直接用它切换会丢掉曲库的搜索词、筛选和页码。
      // 点击时才从地址栏读：这些参数由 useUrlState 浅更新，不经过路由，渲染时拿到的可能已经过时；
      // 还在节流里没写出去的也先写进去
      flushUrlState();
      const { search, hash } = window.location;
      startTransition(() => {
        router.replace(`${pathname}${search}${hash}`, { locale: targetLocale });
      });
    },
    [router, pathname, locale, isPending],
  );

  return { locale, isPending, switchTo, prefetchAll };
}
