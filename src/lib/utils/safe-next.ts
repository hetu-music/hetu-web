/**
 * 登录、注册后跳回的站内路径（来自 ?next=）。
 *
 * 只认以单个「/」开头的站内路径；「//evil.com」「/\evil.com」会被浏览器当成
 * 外站地址，制表符、换行在解析 URL 时会被删掉（「/\t/evil.com」也就成了
 * 「//evil.com」），所以空白、控制字符与反斜杠一律不收，其余情况回主页。
 */
export function safeNextPath(
  value: string | string[] | null | undefined,
): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !/^\/(?![/\\])/.test(next)) return "/";
  // eslint-disable-next-line no-control-regex
  if (/[\s\\\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}

/**
 * 登录页地址，登录后回到 next（不带语言前缀的站内路径）。
 * 返回值也不带语言前缀：服务端 redirect 时自行加上 /${locale}。
 */
export function loginPathFor(next: string): string {
  const target = safeNextPath(next);
  return target === "/"
    ? "/login"
    : `/login?next=${encodeURIComponent(target)}`;
}
