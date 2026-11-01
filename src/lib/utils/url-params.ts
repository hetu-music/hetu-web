/**
 * 查询参数的读写小工具，配合 useUrlState 用（见 docs/LIBRARY.md 阶段 3「5.」）。
 * 都带默认值：读不到或不合法时用默认值，写的值等于默认值时从地址栏去掉。
 */

export function readString(
  params: URLSearchParams,
  key: string,
  fallback = "",
): string {
  return params.get(key) ?? fallback;
}

export function writeString(
  draft: URLSearchParams,
  key: string,
  value: string,
  fallback = "",
): void {
  if (value === fallback) draft.delete(key);
  else draft.set(key, value);
}

/** 正整数；不是合法整数时用默认值 */
export function readInt(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key);
  if (raw === null || !/^-?\d+$/.test(raw)) return fallback;
  return Number(raw);
}

export function writeInt(
  draft: URLSearchParams,
  key: string,
  value: number,
  fallback: number,
): void {
  writeString(draft, key, String(value), String(fallback));
}

/** 固定取值之一；不在取值范围内时用默认值 */
export function readLiteral<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const raw = params.get(key);
  return raw !== null && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

/** 布尔值存成 1，false 不写 */
export function readFlag(params: URLSearchParams, key: string): boolean {
  return params.get(key) === "1";
}

export function writeFlag(
  draft: URLSearchParams,
  key: string,
  value: boolean,
): void {
  if (value) draft.set(key, "1");
  else draft.delete(key);
}

/** 字符串数组按重复参数存：?artist=司夏&artist=李萌。空值丢掉，去重 */
export function readArray(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).filter(Boolean))];
}

export function writeArray(
  draft: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  draft.delete(key);
  for (const v of new Set(values)) if (v) draft.append(key, v);
}
