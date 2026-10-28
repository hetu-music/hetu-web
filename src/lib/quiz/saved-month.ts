/**
 * 保存时间 → 年月，用于「某年某月寻得」。按北京时间算：
 * 服务端与浏览器的时区不同时，月初月末也不会算出两个月份、导致水合不一致
 */
export function savedMonth(iso: string): { year: number; month: number } {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
