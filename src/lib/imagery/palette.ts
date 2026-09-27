/**
 * 意象一级分类配色。意象页与歌曲详情页共用，保证同一类别在全站是同一种颜色。
 * 颜色按一级分类在 IMAGERY_L1_ORDER 中的位置分配，不在表内的分类排在其后。
 */

export interface PaletteEntry {
  text: string;
  ring: string;
  dot: string;
  activeBg: string;
  accent: string;
}

export const PALETTE_TEXT = [
  "text-teal-700 dark:text-teal-400",
  "text-amber-700 dark:text-amber-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-rose-600 dark:text-rose-400",
  "text-emerald-700 dark:text-emerald-500",
  "text-violet-600 dark:text-violet-400",
  "text-orange-700 dark:text-orange-400",
  "text-cyan-700 dark:text-cyan-400",
] as const;

export const PALETTE_FULL: PaletteEntry[] = [
  {
    text: PALETTE_TEXT[0],
    ring: "ring-teal-500/50",
    dot: "bg-teal-500",
    activeBg: "bg-teal-50 dark:bg-teal-900/20",
    accent: "#0d9488",
  },
  {
    text: PALETTE_TEXT[1],
    ring: "ring-amber-500/50",
    dot: "bg-amber-500",
    activeBg: "bg-amber-50 dark:bg-amber-900/20",
    accent: "#d97706",
  },
  {
    text: PALETTE_TEXT[2],
    ring: "ring-indigo-500/50",
    dot: "bg-indigo-500",
    activeBg: "bg-indigo-50 dark:bg-indigo-900/20",
    accent: "#4f46e5",
  },
  {
    text: PALETTE_TEXT[3],
    ring: "ring-rose-500/50",
    dot: "bg-rose-500",
    activeBg: "bg-rose-50 dark:bg-rose-900/20",
    accent: "#e11d48",
  },
  {
    text: PALETTE_TEXT[4],
    ring: "ring-emerald-500/50",
    dot: "bg-emerald-600",
    activeBg: "bg-emerald-50 dark:bg-emerald-900/20",
    accent: "#059669",
  },
  {
    text: PALETTE_TEXT[5],
    ring: "ring-violet-500/50",
    dot: "bg-violet-500",
    activeBg: "bg-violet-50 dark:bg-violet-900/20",
    accent: "#7c3aed",
  },
  {
    text: PALETTE_TEXT[6],
    ring: "ring-orange-500/50",
    dot: "bg-orange-500",
    activeBg: "bg-orange-50 dark:bg-orange-900/20",
    accent: "#ea580c",
  },
  {
    text: PALETTE_TEXT[7],
    ring: "ring-cyan-500/50",
    dot: "bg-cyan-500",
    activeBg: "bg-cyan-50 dark:bg-cyan-900/20",
    accent: "#0891b2",
  },
];

export const GRAY_PALETTE: PaletteEntry = {
  text: "text-slate-500 dark:text-slate-400",
  ring: "ring-slate-400/40",
  dot: "bg-slate-400",
  activeBg: "bg-slate-100 dark:bg-slate-800/40",
  accent: "#94a3b8",
};

const IMAGERY_L1_ORDER = [
  "自然事物",
  "人文社会",
  "身体人物",
  "文学艺术",
  "抽象概念",
];

/** 一级分类按固定顺序排列，决定各自的配色下标 */
export function sortLevel1Categories<
  T extends { name: string; level: number | null },
>(categories: T[]): T[] {
  return categories
    .filter((c) => c.level === 1)
    .sort((a, b) => {
      const idxA = IMAGERY_L1_ORDER.indexOf(a.name);
      const idxB = IMAGERY_L1_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "zh");
    });
}
