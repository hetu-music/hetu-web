import { describe, expect, it } from "vitest";
import {
  BAND_HEIGHT,
  layoutScroll,
  type ScrollWork,
  TIER_SIZE,
  yearAt,
} from "./layout";

// 按日期从新到旧：2016 六首，2015 三首（其中一首没有封面）
const WORKS: ScrollWork[] = [
  ...[1, 2, 3, 4, 5, 6].map((i) => ({
    id: 100 + i,
    year: 2016,
    hasCover: true,
    weight: i === 3 ? 20 : i,
  })),
  { id: 201, year: 2015, hasCover: true, weight: 5 },
  { id: 202, year: 2015, hasCover: false, weight: 50 },
  { id: 203, year: 2015, hasCover: true, weight: 1 },
];

describe("layoutScroll", () => {
  const layout = layoutScroll(WORKS);
  const byId = new Map(layout.placements.map((p) => [p.id, p]));
  const at = (id: number) => {
    const p = byId.get(id);
    if (!p) throw new Error("未排上：" + id);
    return p;
  };

  it("每首作品都排上了，且排出来的卷每次一样", () => {
    expect(layout.placements).toHaveLength(WORKS.length);
    expect(layoutScroll(WORKS)).toEqual(layout);
  });

  it("早的在左、新的在右", () => {
    const left2015 = Math.max(...[201, 202, 203].map((id) => at(id).x));
    const right2016 = Math.min(
      ...[101, 102, 103, 104, 105, 106].map((id) => at(id).x),
    );
    expect(left2015).toBeLessThan(right2016);
    expect(layout.years.map((y) => y.year)).toEqual([2015, 2016]);
  });

  it("作品够多的年份，意象最多的那首挂大幅", () => {
    expect(at(103).tier).toBe(0);
    expect(at(103).size).toBe(TIER_SIZE[0]);
  });

  it("作品太少的年份不挂大幅，素笺一律小幅", () => {
    expect([201, 202, 203].some((id) => at(id).tier === 0)).toBe(false);
    expect(at(202).tier).toBe(2);
  });

  it("都落在卷面高度之内，互不重叠", () => {
    for (const p of layout.placements) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + p.size).toBeLessThanOrEqual(BAND_HEIGHT);
    }
    const ps = layout.placements;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const overlap =
          a.x < b.x + b.size &&
          b.x < a.x + a.size &&
          a.y < b.y + b.size &&
          b.y < a.y + a.size;
        expect(overlap).toBe(false);
      }
    }
  });

  it("引首在最新一年的右边，卷宽算到引首为止", () => {
    const last = layout.years[layout.years.length - 1];
    expect(layout.frontispiece.from).toBeGreaterThan(last.to);
    expect(layout.width).toBe(layout.frontispiece.to);
  });

  it("yearAt 找到横坐标所在的年", () => {
    const [y2015, y2016] = layout.years;
    expect(yearAt(layout, y2015.from + 1)?.year).toBe(2015);
    expect(yearAt(layout, y2016.to)?.year).toBe(2016);
    expect(yearAt(layout, layout.width + 999)?.year).toBe(2016);
  });
});
