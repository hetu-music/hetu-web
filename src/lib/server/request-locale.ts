import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import type { Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

/**
 * 接口返回内容用哪种字形：只认调用方带来的 ?locale=，缺省或不认识的一律简体。
 *
 * 不读 NEXT_LOCALE cookie：cookie 全站共用、跟页面地址不一定对得上——
 * 另一个标签页开着繁体页、或 next-intl 的 router.prefetch 带了 locale，
 * 都会把它改掉，简体页上的接口就返回了繁体。页面的语言以地址为准，
 * 由客户端用 useLocale() 取了传过来，react-query 的 key 里也要带上它。
 */
export function localeFromRequest(request: NextRequest): Locale {
  const value = request.nextUrl.searchParams.get("locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
