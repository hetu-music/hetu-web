/**
 * 展室的挂法：按这一年的作品数分疏、中、密三档，每档有几种行版式轮流用。
 * 宽屏 12 栏，每幅给出起始栏、跨几栏、往下错开多少；
 * 窄屏 6 栏按顺序套一组固定的错落，行由浏览器自动换。
 */

export interface Placement {
  /** 宽屏：起始栏（1 起）、跨栏数、下错（rem） */
  c: number;
  s: number;
  o: number;
  /** 窄屏 */
  mc: number;
  ms: number;
  mo: number;
  featured: boolean;
}

export type Density = "sparse" | "medium" | "dense";

type Slot = { c: number; s: number; o: number };

/** 主作所在的那一行：主作占半面墙，旁边两幅小的错开挂 */
const FEATURE_ROWS: Slot[][] = [
  [
    { c: 1, s: 6, o: 0 },
    { c: 8, s: 3, o: 11 },
    { c: 11, s: 2, o: 3 },
  ],
  [
    { c: 2, s: 3, o: 14 },
    { c: 6, s: 6, o: 0 },
  ],
];

const ROWS: Record<Density, Slot[][]> = {
  // 一两幅：挂得大，彼此离得远，四周大片空墙
  sparse: [
    [
      { c: 2, s: 5, o: 0 },
      { c: 9, s: 3, o: 24 },
    ],
  ],
  medium: [
    [
      { c: 1, s: 4, o: 0 },
      { c: 6, s: 3, o: 9 },
      { c: 10, s: 3, o: 3 },
    ],
    [
      { c: 2, s: 3, o: 6 },
      { c: 6, s: 4, o: 0 },
      { c: 11, s: 2, o: 11 },
    ],
    [
      { c: 1, s: 3, o: 3 },
      { c: 5, s: 3, o: 12 },
      { c: 9, s: 4, o: 0 },
    ],
    // 只挂两幅的一行：一幅大的，旁边远远一幅小的
    [
      { c: 3, s: 5, o: 0 },
      { c: 10, s: 2, o: 9 },
    ],
    [
      { c: 1, s: 2, o: 8 },
      { c: 4, s: 3, o: 0 },
      { c: 8, s: 2, o: 12 },
      { c: 10, s: 3, o: 2 },
    ],
    [
      { c: 2, s: 2, o: 0 },
      { c: 5, s: 4, o: 7 },
      { c: 10, s: 2, o: 1 },
    ],
  ],
  // 多产的年份：画小一号、挂得密，但每行仍然高低错开
  dense: [
    [
      { c: 1, s: 3, o: 0 },
      { c: 5, s: 2, o: 7 },
      { c: 8, s: 2, o: 1 },
      { c: 11, s: 2, o: 9 },
    ],
    [
      { c: 2, s: 2, o: 5 },
      { c: 5, s: 3, o: 0 },
      { c: 9, s: 3, o: 8 },
    ],
    [
      { c: 1, s: 2, o: 9 },
      { c: 4, s: 3, o: 2 },
      { c: 8, s: 2, o: 0 },
      { c: 10, s: 3, o: 6 },
    ],
    [
      { c: 3, s: 3, o: 0 },
      { c: 7, s: 2, o: 10 },
      { c: 10, s: 2, o: 3 },
    ],
    [
      { c: 1, s: 4, o: 0 },
      { c: 6, s: 2, o: 9 },
      { c: 9, s: 2, o: 2 },
      { c: 11, s: 2, o: 12 },
    ],
    [
      { c: 2, s: 2, o: 7 },
      { c: 4, s: 2, o: 0 },
      { c: 7, s: 3, o: 5 },
      { c: 11, s: 2, o: 0 },
    ],
  ],
};

/** 窄屏：两两一行，一大一小，左右交替 */
const MOBILE: { c: number; s: number; o: number }[] = [
  { c: 1, s: 4, o: 0 },
  { c: 5, s: 2, o: 4 },
  { c: 2, s: 3, o: 2 },
  { c: 5, s: 2, o: 0 },
  { c: 1, s: 2, o: 3 },
  { c: 3, s: 4, o: 0 },
];
const MOBILE_SPARSE = [
  { c: 1, s: 5, o: 0 },
  { c: 3, s: 4, o: 6 },
];

export function densityOf(count: number): Density {
  if (count <= 5) return "sparse";
  if (count >= 26) return "dense";
  return "medium";
}

/**
 * @param count 作品数
 * @param featuredIndex 主作在列表里的位置（没有主作传 -1）
 * @param seed 换一种起手的版式，免得每间展室都从同一行开始
 * @returns 每行一组下标与位置；主作总在第一行
 */
export function hangRoom(
  count: number,
  featuredIndex: number,
  seed: number,
): { index: number; place: Placement }[][] {
  const density = densityOf(count);
  const order = Array.from({ length: count }, (_, i) => i);
  if (featuredIndex > 0) {
    order.splice(featuredIndex, 1);
    order.unshift(featuredIndex);
  }

  const rows: { index: number; place: Placement }[][] = [];
  let cursor = 0;
  let mobileCursor = 0;
  const mobileSeq = density === "sparse" ? MOBILE_SPARSE : MOBILE;
  const nextMobile = (featured: boolean) => {
    if (featured) {
      // 主作在窄屏占满一行；后面的错落从头开始
      mobileCursor = 0;
      return { c: 1, s: 6, o: 0 };
    }
    const m = mobileSeq[mobileCursor % mobileSeq.length];
    mobileCursor++;
    return m;
  };

  let rowIndex = 0;
  let prevTemplate = -1;
  while (cursor < order.length) {
    const isFeatureRow =
      rowIndex === 0 && featuredIndex >= 0 && density !== "sparse";
    const templates = isFeatureRow ? FEATURE_ROWS : ROWS[density];
    // 版式按行号与种子打散，且不与上一行相同，免得几行一模一样
    let pick =
      (rowIndex * 7 + seed * 5 + ((rowIndex * rowIndex) % 3)) %
      templates.length;
    if (!isFeatureRow && pick === prevTemplate)
      pick = (pick + 1) % templates.length;
    if (!isFeatureRow) prevTemplate = pick;
    const template = templates[pick];
    // 主作在模板里占的那一格：跨栏最大的那格
    const featureSlot = isFeatureRow
      ? template.reduce((best, s, i) => (s.s > template[best].s ? i : best), 0)
      : -1;
    // 主作先放进它那一格，其余按顺序填剩下的格
    const slots = isFeatureRow
      ? [
          featureSlot,
          ...template.map((_, i) => i).filter((i) => i !== featureSlot),
        ]
      : template.map((_, i) => i);
    const row: { index: number; place: Placement }[] = [];
    for (const slotIdx of slots) {
      if (cursor >= order.length) break;
      const slot = template[slotIdx];
      const featured = isFeatureRow && slotIdx === featureSlot;
      row.push({
        index: order[cursor++],
        place: {
          ...slot,
          mc: 1,
          ms: 6,
          mo: 0,
          featured: featured || (density === "sparse" && row.length === 0),
        },
      });
    }
    // 宽屏按栏位从左到右排，读起来顺
    row.sort((a, b) => a.place.c - b.place.c);
    rows.push(row);
    rowIndex++;
  }
  // 窄屏的位置按最终的文档顺序给，浏览器按这个顺序自动换行
  for (const row of rows)
    for (const item of row) {
      const m = nextMobile(item.place.featured && density !== "sparse");
      item.place.mc = m.c;
      item.place.ms = m.s;
      item.place.mo = m.o;
    }
  return rows;
}
