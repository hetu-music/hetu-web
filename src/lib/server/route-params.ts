/**
 * 路径里的数字 id。只认规范写法（不带前导零、不带别的字符）：
 * 「012」「12abc」用 parseInt 也会读成 12，但在 CDN 上是另一个缓存地址，
 * 既能用来绕过 CDN 缓存直接打到源站，数据变了清缓存时也清不到它。
 */
export function parseRouteId(raw: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
