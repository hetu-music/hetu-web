/**
 * 夜展长卷的构图：把作品排在一条横向的卷面上。纯函数，同样的输入永远排出同样的卷。
 *
 * 卷面坐标：x 从左往右、y 从上往下，单位是「卷面单位」，与屏幕像素无关（由镜头缩放）。
 * 最早的作品在最左，最新的在最右；读卷从右往左，与传统手卷一致。
 */

export interface ScrollWork {
  id: number;
  year: number | null;
  /** 有自己的封面；没有的画成一方素笺 */
  hasCover: boolean;
  /** 画幅大小的依据（意象数），越大越可能挂成大幅 */
  weight: number;
}

/** 0 大幅、1 中幅、2 小幅 */
export type Tier = 0 | 1 | 2;

export interface Placement {
  id: number;
  /** 左上角 */
  x: number;
  y: number;
  size: number;
  tier: Tier;
}

export interface YearSpan {
  year: number | null;
  /** 这一年的画群在卷上的左右边界 */
  from: number;
  to: number;
}

export interface ScrollLayout {
  placements: Placement[];
  years: YearSpan[];
  /** 引首：卷的最右端（开卷处）留给题名的一段 */
  frontispiece: { from: number; to: number };
  width: number;
  height: number;
}

/** 卷面高度：画群上下浮动的范围 */
export const BAND_HEIGHT = 1000;
export const TIER_SIZE: Record<Tier, number> = { 0: 340, 1: 230, 2: 150 };

const COLUMN_GAP: [number, number] = [56, 120];
const ROW_GAP: [number, number] = [40, 88];
/** 年与年之间多留一段空卷，题字就写在这里与画群后面 */
const YEAR_GAP = 360;
/** 最新一年与引首之间的空卷，以及引首本身的宽度 */
const FRONT_GAP = 560;
const FRONT_WIDTH = 1500;
/** 一年里作品至少这么多才挂一幅大的 */
const LARGE_MIN_WORKS = 5;
/** 中幅占一年作品的比例 */
const MEDIUM_SHARE = 0.25;

/** 可复现的伪随机数（mulberry32） */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: () => number, [lo, hi]: [number, number]) =>
  lo + rand() * (hi - lo);

/** 一年之内定画幅：意象最多的一幅挂大，其后一部分挂中，其余小幅；素笺一律小幅 */
function assignTiers(works: ScrollWork[]): Map<number, Tier> {
  const tiers = new Map<number, Tier>();
  const ranked = works
    .filter((w) => w.hasCover)
    .sort((a, b) => b.weight - a.weight || a.id - b.id);
  const mediumCount = Math.round(works.length * MEDIUM_SHARE);
  ranked.forEach((w, i) => {
    if (i === 0 && works.length >= LARGE_MIN_WORKS) tiers.set(w.id, 0);
    else if (i <= mediumCount) tiers.set(w.id, 1);
    else tiers.set(w.id, 2);
  });
  for (const w of works) if (!tiers.has(w.id)) tiers.set(w.id, 2);
  return tiers;
}

/**
 * @param works 按日期从新到旧排好的作品（与曲库一致）
 */
export function layoutScroll(works: ScrollWork[]): ScrollLayout {
  // 从左往右排：最早的一年在最左，年内也是早的在左
  const chronological = [...works].reverse();
  const groups: Array<{ year: number | null; works: ScrollWork[] }> = [];
  for (const work of chronological) {
    const last = groups[groups.length - 1];
    if (last && last.year === work.year) last.works.push(work);
    else groups.push({ year: work.year, works: [work] });
  }

  const placements: Placement[] = [];
  const years: YearSpan[] = [];
  let x = 0;

  groups.forEach((group, gi) => {
    if (gi > 0) x += YEAR_GAP;
    const from = x;
    const tiers = assignTiers(group.works);
    const rand = seeded((group.year ?? 0) * 7919 + group.works.length);

    // 一列一列往右排：竖着能放下就叠，放不下另起一列
    let column: Array<{ work: ScrollWork; size: number; tier: Tier }> = [];
    const flush = () => {
      if (column.length === 0) return;
      const width = Math.max(...column.map((c) => c.size));
      const gaps = column.slice(1).map(() => between(rand, ROW_GAP));
      const height =
        column.reduce((sum, c) => sum + c.size, 0) +
        gaps.reduce((s, g) => s + g, 0);
      // 整列在卷面高度里上下浮动，列与列高低错落
      let y = (BAND_HEIGHT - height) * (0.15 + rand() * 0.7);
      column.forEach((c, i) => {
        if (i > 0) y += gaps[i - 1];
        // 窄于列宽的画在列里左右错开一点
        const slack = width - c.size;
        placements.push({
          id: c.work.id,
          x: x + slack * rand(),
          y,
          size: c.size,
          tier: c.tier,
        });
        y += c.size;
      });
      x += width + between(rand, COLUMN_GAP);
      column = [];
    };

    for (const work of group.works) {
      const tier = tiers.get(work.id) ?? 2;
      const size = TIER_SIZE[tier];
      const used =
        column.reduce((sum, c) => sum + c.size, 0) +
        Math.max(0, column.length) * ROW_GAP[1];
      // 大幅独占一列；其余叠到放不下为止
      if (column.length > 0 && (tier === 0 || used + size > BAND_HEIGHT)) {
        flush();
      }
      column.push({ work, size, tier });
      if (tier === 0) flush();
    }
    flush();

    // flush 之后 x 多加了一段列间距，年的右边界取最后一幅的右缘
    const inYear = placements.slice(placements.length - group.works.length);
    const to = Math.max(...inYear.map((p) => p.x + p.size));
    years.push({ year: group.year, from, to });
    x = to;
  });

  const frontispiece = { from: x + FRONT_GAP, to: x + FRONT_GAP + FRONT_WIDTH };
  return {
    placements,
    years,
    frontispiece,
    width: frontispiece.to,
    height: BAND_HEIGHT,
  };
}

/** 卷面上某个横坐标落在哪一年（落在年与年之间的空卷时，取右边那一年） */
export function yearAt(layout: ScrollLayout, x: number): YearSpan | null {
  for (const span of layout.years) {
    if (x <= span.to) return span;
  }
  return layout.years[layout.years.length - 1] ?? null;
}

/** 年份题字的字号（卷面单位）：写在每年画群正中、卷面高度的一半处 */
export const INSCRIPTION_SIZE = 420;

/**
 * 卷面上某点是否落在某年的题字上（点空白处才算，点在画上由画自己接）。
 * 题字宽按每个数字约 0.6 个字号估算，不超出这一年画群的范围。
 */
export function yearInscriptionAt(
  layout: ScrollLayout,
  x: number,
  y: number,
): YearSpan | null {
  if (Math.abs(y - BAND_HEIGHT / 2) > INSCRIPTION_SIZE * 0.55) return null;
  for (const span of layout.years) {
    const center = (span.from + span.to) / 2;
    const digits = span.year ? String(span.year).length : 2;
    const half = Math.min(
      (span.to - span.from) / 2,
      (digits * 0.6 * INSCRIPTION_SIZE) / 2,
    );
    if (Math.abs(x - center) <= half) return span;
  }
  return null;
}
