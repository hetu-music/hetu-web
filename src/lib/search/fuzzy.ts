/**
 * 题名近似：搜索词和题名的某一段最多差一个字（见 docs/LIBRARY.md 阶段 2「5. 题名近似」）。
 *
 * 用 Sellers 的近似子串匹配：题名的起点和终点都不计代价，只算搜索词与题名中某一段
 * 之间的编辑距离。错字、漏字、多字各算一个，相邻两字颠倒也算一个（OSA，Damerau 的常用变体）。
 * 题名都很短，逐个算一遍三百多个题名也远不到一毫秒，不建索引。
 */

/** 搜索词至少这么多字才做近似：三个字错一个就是三分之一，噪音比找回的多 */
export const FUZZY_MIN_LENGTH = 4;
/** 最多差几个字 */
export const FUZZY_MAX_DISTANCE = 1;

/**
 * 搜索词与 text 中最接近的一段之间的编辑距离；超过 limit 时返回 limit + 1。
 * 按 UTF-16 单元比较：归一化后的题名几乎全是 BMP 里的字。
 */
export function substringDistance(
  word: string,
  text: string,
  limit = FUZZY_MAX_DISTANCE,
): number {
  const m = word.length;
  const n = text.length;
  if (m === 0) return 0;
  if (m - limit > n) return limit + 1;

  // rows[i][j]：搜索词前 i 个字与「题名中以第 j 个字结尾的某一段」的最小距离。
  // 第 0 行全为 0：题名从哪里开始都不计代价
  let prev2 = new Int32Array(n + 1);
  let prev = new Int32Array(n + 1);
  let cur = new Int32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = word.charCodeAt(i - 1) === text.charCodeAt(j - 1) ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        word.charCodeAt(i - 1) === text.charCodeAt(j - 2) &&
        word.charCodeAt(i - 2) === text.charCodeAt(j - 1)
      ) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > limit) return limit + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  // 终点也不计代价：取最后一行的最小值
  let best = limit + 1;
  for (let j = 0; j <= n; j++) if (prev[j] < best) best = prev[j];
  return best;
}

/** 题名近似是否成立（不含完全包含的情况，那是第 3 档） */
export function isFuzzyTitleMatch(word: string, title: string): boolean {
  if (word.length < FUZZY_MIN_LENGTH) return false;
  if (title.includes(word)) return false;
  return substringDistance(word, title) <= FUZZY_MAX_DISTANCE;
}
