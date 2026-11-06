import { SITE_URL } from "@/lib/constants";
import { defaultLocale, type Locale, locales } from "@/i18n/config";

/** 不认识的语言按默认的简体 */
function toLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

/**
 * 页面在某个语言下的正式网址（canonical、sitemap、JSON-LD 都用它）。
 * path 不带语言前缀，以 / 开头；首页传空串
 */
export function localeUrl(locale: string, path = ""): string {
  return `${SITE_URL}/${toLocale(locale)}${path}`;
}

/** generateMetadata 的 alternates：本语言的 canonical，加上各语言版本的对照 */
export function localeAlternates(locale: string, path = "") {
  return {
    canonical: localeUrl(locale, path),
    languages: Object.fromEntries(
      locales.map((l) => [l, localeUrl(l, path)]),
    ) as Record<Locale, string>,
  };
}
