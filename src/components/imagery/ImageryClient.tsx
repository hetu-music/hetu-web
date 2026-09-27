"use client";

import About from "@/components/library/About";
import AppNavbar from "@/components/shared/AppNavbar";
import { usePlayerStore } from "@/store/player-store";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import type { ImageryCategory, ImageryItem } from "@/lib/types";
import { useIntersection } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GRAY_PALETTE,
  PALETTE_FULL,
  PALETTE_TEXT,
  sortLevel1Categories,
} from "@/lib/imagery/palette";
import type { SongResult } from "./ImageryDetailPanel";
import ImageryDetailPanel from "./ImageryDetailPanel";

// ─── constants ────────────────────────────────────────────────────────────────

const GAP_X_PX = 40; // gap-x-10 = 2.5rem = 40px
const GAP_Y_PX = 24; // gap-y-6 = 1.5rem = 24px
const MARQUEE_SAMPLE_SIZE = 90;

// ─── types ────────────────────────────────────────────────────────────────────

interface Props {
  items: ImageryItem[];
  categories: ImageryCategory[];
}

interface WordDisplayData {
  item: ImageryItem;
  paletteText: string;
  paletteAccent: string;
  fontSize: number;
  breatheDuration: number;
  breatheDelay: number;
}

// ─── row-grouping helpers ─────────────────────────────────────────────────────

function estimateWordWidthPx(data: WordDisplayData): number {
  // Chinese chars are approximately 1em wide in serif fonts
  return Math.ceil(data.item.name.length * data.fontSize * 16);
}

function groupIntoRows(
  words: WordDisplayData[],
  containerWidth: number,
): WordDisplayData[][] {
  if (containerWidth <= 0 || words.length === 0) return [words];
  const rows: WordDisplayData[][] = [];
  let row: WordDisplayData[] = [];
  let rowW = 0;
  for (const word of words) {
    const w = estimateWordWidthPx(word);
    const needed = row.length === 0 ? w : w + GAP_X_PX;
    if (row.length > 0 && rowW + needed > containerWidth) {
      rows.push(row);
      row = [word];
      rowW = w;
    } else {
      row.push(word);
      rowW += needed;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function estimateRowHeightPx(row: WordDisplayData[]): number {
  if (!row?.length) return 80;
  const maxFontSize = Math.max(...row.map((w) => w.fontSize));
  return Math.ceil(maxFontSize * 16) + GAP_Y_PX;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcFontSize(count: number, maxCount: number): number {
  if (maxCount <= 1) return 1.0;
  const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
  return 0.85 + ratio * 1.5;
}

function triggerHaptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(ms);
  }
}

function seededShuffle<T>(list: T[], seed: number): T[] {
  const result = [...list];
  let currentSeed = seed || 1;

  for (let i = result.length - 1; i > 0; i -= 1) {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    const nextIndex = currentSeed % (i + 1);
    [result[i], result[nextIndex]] = [result[nextIndex], result[i]];
  }

  return result;
}

// ─── WordItem ─────────────────────────────────────────────────────────────────

const WordItem = memo(function WordItem({
  data,
  rowWordIdx,
  selectedItemId,
}: {
  data: WordDisplayData;
  rowWordIdx: number;
  selectedItemId: number | null;
}) {
  const t = useTranslations("common.imagery");
  // Stagger words within the same row for a cascade effect on each new batch
  const unfurlDelay = `${rowWordIdx * 80}ms`;
  const isSelected = selectedItemId === data.item.id;
  const hasSelection = selectedItemId !== null;

  const glow = isSelected
    ? `0 0 10px ${data.paletteAccent}cc, 0 0 26px ${data.paletteAccent}66, 0 0 55px ${data.paletteAccent}22`
    : undefined;

  return (
    <div
      className="relative"
      style={{
        opacity: hasSelection ? (isSelected ? 1 : 0.06) : 1,
        transform: isSelected ? "scale(1.1)" : "scale(1)",
        zIndex: isSelected ? 30 : undefined,
        transition:
          "opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div
        className="relative group/word leading-none word-unfurl-anim"
        style={{ "--unfurl-delay": unfurlDelay } as React.CSSProperties}
      >
        <button
          data-item-id={data.item.id}
          aria-label={t("ariaLabel", {
            name: data.item.name,
            count: data.item.count,
          })}
          className={`font-calligraphy leading-none transition-opacity duration-200 word-breathe-anim ${isSelected ? "word-breathe-force-run" : ""} ${data.paletteText} ${isSelected ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
          style={
            {
              fontSize: `${data.fontSize}rem`,
              "--word-breathe-duration": `${data.breatheDuration}s`,
              "--word-breathe-delay": `${data.breatheDelay}s`,
              textShadow: glow,
              transition: "text-shadow 0.4s ease, opacity 0.4s ease",
            } as React.CSSProperties
          }
        >
          {data.item.name}
        </button>
      </div>
    </div>
  );
});

// ─── CategoryButton ───────────────────────────────────────────────────────────

const CategoryButton = memo(function CategoryButton({
  isActive,
  onClick,
  label,
  accentColor,
}: {
  isActive: boolean;
  onClick: () => void;
  label: React.ReactNode;
  accentColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative py-1.5 text-[14px] transition-all duration-700 font-serif whitespace-nowrap ${
        isActive
          ? "text-slate-900 dark:text-white tracking-[0.25em]"
          : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 tracking-[0.2em] hover:tracking-[0.25em]"
      }`}
    >
      {label}
      <span
        className={`absolute bottom-0 left-0 h-[1.5px] transition-all duration-1000 ease-out origin-left ${
          isActive
            ? "w-[calc(100%-0.25em)] scale-x-100 opacity-80"
            : "w-[calc(100%-0.25em)] scale-x-0 opacity-0"
        }`}
        style={{
          backgroundColor: accentColor,
          boxShadow: isActive ? `0 1px 10px ${accentColor}22` : "none",
        }}
      />
    </button>
  );
});

// ─── main component ───────────────────────────────────────────────────────────

export default function ImageryClient({ items, categories }: Props) {
  const router = useRouter();
  const t = useTranslations("common.imagery");
  const tSite = useTranslations("common.site");
  const { setPlayerVisible } = usePlayerStore();

  // 意象词云页面：隐藏播放条但不暂停音乐，离开时恢复显示
  useEffect(() => {
    setPlayerVisible(false);
    return () => {
      setPlayerVisible(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── category hierarchy ───────────────────────────────────────────────────
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const level1Categories = useMemo(
    () => sortLevel1Categories(categories),
    [categories],
  );

  const l1ColorIndex = useMemo(() => {
    const m = new Map<number, number>();
    level1Categories.forEach((cat, i) =>
      m.set(cat.id, i % PALETTE_FULL.length),
    );
    return m;
  }, [level1Categories]);

  const itemToL1 = useMemo(() => {
    const m = new Map<number, ImageryCategory | null>();
    for (const item of items) {
      let found: ImageryCategory | null = null;
      for (const catId of item.categoryIds) {
        const l3 = catMap.get(catId);
        if (!l3?.parent_id) continue;
        const l2 = catMap.get(l3.parent_id);
        if (!l2?.parent_id) continue;
        const l1 = catMap.get(l2.parent_id);
        if (l1) {
          found = l1;
          break;
        }
      }
      m.set(item.id, found);
    }
    return m;
  }, [items, catMap]);

  const itemToL2 = useMemo(() => {
    const m = new Map<number, ImageryCategory | null>();
    for (const item of items) {
      let found: ImageryCategory | null = null;
      for (const catId of item.categoryIds) {
        const l3 = catMap.get(catId);
        if (!l3?.parent_id) continue;
        const l2 = catMap.get(l3.parent_id);
        if (l2) {
          found = l2;
          break;
        }
      }
      m.set(item.id, found);
    }
    return m;
  }, [items, catMap]);

  // ── state ────────────────────────────────────────────────────────────────
  const [activeL1Id, setActiveL1Id] = useState<number | null>(null);
  // Deferred: filter button highlights immediately; cloud re-renders in background
  const deferredActiveL1Id = useDeferredValue(activeL1Id);
  const [activeL2Id, setActiveL2Id] = useState<number | null>(null);
  const deferredActiveL2Id = useDeferredValue(activeL2Id);

  // L2 sub-categories visible when a L1 is selected
  const level2Categories = useMemo(
    () =>
      activeL1Id === null
        ? []
        : categories
            .filter((c) => c.level === 2 && c.parent_id === activeL1Id)
            .sort((a, b) => a.name.localeCompare(b.name, "zh")),
    [categories, activeL1Id],
  );
  const [selectedItem, setSelectedItem] = useState<ImageryItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");
  const [hoveredData, setHoveredData] = useState<{
    itemId: number;
    count: number;
    accent: string;
    x: number;
    y: number;
  } | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const isDesktop = useIsDesktop();
  const navRef = useRef<HTMLElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [marqueeSeed, setMarqueeSeed] = useState(0);
  const { ref: headerRef, entry: headerEntry } = useIntersection({
    threshold: 0.05,
  });
  const headerVisible = headerEntry?.isIntersecting ?? true;

  // Hide global scrollbar only on this page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("no-scrollbar");
    body.classList.add("no-scrollbar");
    return () => {
      html.classList.remove("no-scrollbar");
      body.classList.remove("no-scrollbar");
    };
  }, []);

  // Trigger entrance animation after first paint
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
      setMarqueeSeed(Math.floor(Math.random() * 2147483647));
    });
  }, []);

  // Track nav height → CSS variable --nav-h for the panel to consume
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--nav-h",
        `${nav.getBoundingClientRect().height}px`,
      );
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // ── precomputed display data ──────────────────────────────────────────────
  const maxCount = useMemo(
    () => Math.max(...items.map((i) => i.count), 1),
    [items],
  );

  const wordDisplayList = useMemo(() => {
    let list: ImageryItem[];
    if (deferredActiveL2Id !== null) {
      list = items.filter(
        (item) => itemToL2.get(item.id)?.id === deferredActiveL2Id,
      );
    } else if (deferredActiveL1Id !== null) {
      list = items.filter(
        (item) => itemToL1.get(item.id)?.id === deferredActiveL1Id,
      );
    } else {
      list = items;
    }
    return [...list]
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => {
        const l1 = itemToL1.get(item.id) ?? null;
        const colorIdx = l1 ? (l1ColorIndex.get(l1.id) ?? 0) : -1;
        const paletteText =
          colorIdx >= 0 ? PALETTE_TEXT[colorIdx] : GRAY_PALETTE.text;
        const paletteAccent =
          colorIdx >= 0 ? PALETTE_FULL[colorIdx].accent : GRAY_PALETTE.accent;
        return {
          item,
          paletteText,
          paletteAccent,
          fontSize: calcFontSize(item.count, maxCount),
          breatheDuration: 5.5 + (idx % 7) * 0.6,
          breatheDelay: (idx % 13) * 0.35,
        };
      });
  }, [
    items,
    deferredActiveL1Id,
    deferredActiveL2Id,
    itemToL1,
    itemToL2,
    l1ColorIndex,
    maxCount,
  ]);

  const marqueeRows = useMemo(() => {
    const sampled = seededShuffle(items, marqueeSeed).slice(
      0,
      MARQUEE_SAMPLE_SIZE,
    );
    return [sampled.slice(0, 30), sampled.slice(30, 60), sampled.slice(60, 90)];
  }, [items, marqueeSeed]);

  // ── selected item helpers ─────────────────────────────────────────────────
  const selectedCategoryPath = useMemo(() => {
    if (!selectedItem) return [];
    const catId = selectedItem.categoryIds[0];
    if (!catId) return [];
    const l3 = catMap.get(catId);
    if (!l3) return [];
    const l2 = l3.parent_id ? catMap.get(l3.parent_id) : null;
    const l1 = l2?.parent_id ? catMap.get(l2.parent_id) : null;
    return [l1?.name, l2?.name, l3.name].filter(Boolean) as string[];
  }, [selectedItem, catMap]);

  const songsQuery = useQuery({
    queryKey: ["imagery", "songs", selectedItem?.id],
    queryFn: async (): Promise<SongResult[]> => {
      if (!selectedItem) {
        return [];
      }

      const response = await fetch(`/api/imagery/${selectedItem.id}/songs`);
      if (!response.ok) {
        throw new Error(t("loadError"));
      }

      const data: { songs?: SongResult[] } = await response.json();
      return data.songs ?? [];
    },
    enabled: panelOpen && !!selectedItem,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const songs = useMemo(() => songsQuery.data ?? [], [songsQuery.data]);
  const songsLoading = songsQuery.isPending;

  const lyricistCounts = useMemo(() => {
    const counts = new Map<string, number>();
    songs.forEach((song) => {
      const lyricists = song.lyricist ?? [];
      if (lyricists.length === 0) {
        counts.set("未知", (counts.get("未知") ?? 0) + 1);
      } else {
        lyricists.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
      }
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  const selectedPalette = useMemo(() => {
    if (!selectedItem) return GRAY_PALETTE;
    const l1 = itemToL1.get(selectedItem.id);
    const colorIdx = l1 ? (l1ColorIndex.get(l1.id) ?? 0) : -1;
    return colorIdx >= 0 ? PALETTE_FULL[colorIdx] : GRAY_PALETTE;
  }, [selectedItem, itemToL1, l1ColorIndex]);

  // ── effects ──────────────────────────────────────────────────────────────

  // Measure cloud container width for row grouping
  useEffect(() => {
    const el = cloudRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Measure scroll margin (distance from doc top to cloud container top)
  useLayoutEffect(() => {
    const update = () => {
      if (cloudRef.current) {
        setScrollMargin(
          cloudRef.current.getBoundingClientRect().top + window.scrollY,
        );
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [wordDisplayList.length]);

  // ── virtualizer ──────────────────────────────────────────────────────────

  const wordRows = useMemo(
    () => groupIntoRows(wordDisplayList, containerWidth),
    [wordDisplayList, containerWidth],
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: wordRows.length,
    estimateSize: useCallback(
      (i: number) => estimateRowHeightPx(wordRows[i] ?? []),
      [wordRows],
    ),
    overscan: 8,
    scrollMargin,
  });

  // ── handlers ─────────────────────────────────────────────────────────────

  // O(1) lookup: item id → WordDisplayData, rebuilt when filtered list changes
  const itemLookup = useMemo(() => {
    const map = new Map<number, WordDisplayData>();
    wordDisplayList.forEach((d) => map.set(d.item.id, d));
    return map;
  }, [wordDisplayList]);

  const handleCloudClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "button[data-item-id]",
      );
      if (!btn) return;
      const itemId = Number(btn.dataset.itemId);
      const d = itemLookup.get(itemId);
      if (!d) return;
      triggerHaptic();
      const rect = btn.getBoundingClientRect();
      const clickX = rect.left + rect.width / 2;
      const cloudRect = cloudRef.current?.getBoundingClientRect();
      const cloudRight = cloudRect ? cloudRect.right : window.innerWidth;
      setPanelSide(clickX > (cloudRight * 3) / 4 ? "left" : "right");
      setSelectedItem(d.item);
      setPanelOpen(true);
      // 面板打开后 Drawer/Sheet 会给背景加 aria-hidden，需要先让按钮失焦
      // 避免 "aria-hidden on focused element" 的无障碍警告
      (document.activeElement as HTMLElement)?.blur();
      // Dismiss tooltip immediately when panel opens
      hoveredBtnRef.current = null;
      setHoveredData(null);
    },
    [itemLookup],
  );

  // Keep a ref in sync with panelOpen so mouse handlers avoid stale closures
  const panelOpenRef = useRef(panelOpen);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  const hoveredBtnRef = useRef<number | null>(null);

  const handleCloudMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (panelOpenRef.current) return;
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "button[data-item-id]",
      );
      if (!btn) return;
      const itemId = Number(btn.dataset.itemId);
      if (hoveredBtnRef.current === itemId) return;
      // eslint-disable-next-line react-hooks/immutability
      hoveredBtnRef.current = itemId;
      const d = itemLookup.get(itemId);
      if (!d) return;
      const rect = btn.getBoundingClientRect();
      setHoveredData({
        itemId,
        count: d.item.count,
        accent: d.paletteAccent,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [itemLookup],
  );

  const handleCloudMouseLeave = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    hoveredBtnRef.current = null;
    setHoveredData(null);
  }, []);

  const handleClose = useCallback(() => setPanelOpen(false), []);

  const handleTitleReset = useCallback(() => {
    router.push("/");
  }, [router]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <AppNavbar
        ref={navRef}
        title={
          <>
            {tSite("name").substring(0, 2)}
            <span className="mx-2 h-5 w-[2px] translate-y-[1.5px] rounded-full bg-blue-600" />
            {tSite("name").substring(2)}
          </>
        }
        onTitleClick={handleTitleReset}
        onAboutClick={() => setShowAbout(true)}
      />

      {/* ── hero ── */}
      <header
        ref={headerRef}
        className="relative overflow-hidden pt-32 pb-12 px-6 text-center"
      >
        <div className="relative z-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 select-none flex-col justify-center gap-5 overflow-hidden opacity-[0.045] dark:opacity-[0.055]"
          >
            {(
              [
                {
                  d: "42s",
                  m: "10s",
                  dir: "imagery-marquee-ltr",
                  size: "text-2xl md:text-4xl",
                },
                {
                  d: "60s",
                  m: "15s",
                  dir: "imagery-marquee-rtl",
                  size: "text-xl md:text-3xl",
                },
                {
                  d: "78s",
                  m: "20s",
                  dir: "imagery-marquee-ltr",
                  size: "text-lg md:text-2xl",
                },
              ] as const
            ).map(({ d, m, dir, size }, ri) => {
              const rowWords = marqueeRows[ri % marqueeRows.length] || [];
              const duration = isDesktop ? d : m;
              return (
                <div
                  key={ri}
                  className="flex whitespace-nowrap font-calligraphy will-change-transform"
                  style={{
                    animationName: dir,
                    animationDuration: duration,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: headerVisible ? "running" : "paused",
                  }}
                >
                  {[...rowWords, ...rowWords].map((w, i) => (
                    <span
                      key={i}
                      className={`${size} mx-5 text-slate-900 dark:text-white`}
                    >
                      {w.name}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <h1 className="font-serif text-5xl md:text-7xl text-slate-800 dark:text-slate-100 mb-4 flex justify-center items-center gap-4 sm:gap-10 drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            {t("title")
              .split("")
              .map((char, i) => (
                <span
                  key={i}
                  className={`hero-title-char inline-block ${mounted ? "" : "opacity-0"}`}
                  style={{ animationDelay: `${i * 300}ms` }}
                >
                  {char}
                </span>
              ))}
          </h1>
          <p
            className={`font-serif text-base md:text-xl text-slate-500 dark:text-slate-400 tracking-[0.4em] pl-[0.4em] mb-3 ${mounted ? "hero-unroll" : "opacity-0"}`}
            style={{ animationDelay: "1650ms" }}
          >
            {t("subtitle", { count: wordDisplayList.length })}
          </p>
        </div>
      </header>

      {/* ── category filter ── */}
      <div className="sticky top-(--nav-h,48px) z-20 bg-[#FAFAFA]/40 dark:bg-[#0B0F19]/40 backdrop-blur-2xl border-b border-slate-200/10 dark:border-slate-800/20 transition-all duration-1000">
        <div className="max-w-5xl mx-auto px-6 py-2.5">
          {/* L1 filter row */}
          <div className="flex items-center gap-8 overflow-x-auto no-scrollbar py-1 mask-linear-fade-edges">
            {/* Start spacer for mask */}
            <div className="min-w-[8px]" />

            <CategoryButton
              label={t("all")}
              isActive={activeL1Id === null}
              onClick={() => {
                setActiveL1Id(null);
                setActiveL2Id(null);
              }}
              accentColor={GRAY_PALETTE.accent}
            />

            {level1Categories.map((cat, i) => {
              const palette = PALETTE_FULL[i % PALETTE_FULL.length];
              const isActive = activeL1Id === cat.id;
              return (
                <div key={cat.id} className="flex items-center gap-8">
                  <div className="w-[0.5px] h-3 bg-slate-200/50 dark:bg-slate-800/30 rotate-12" />
                  <CategoryButton
                    label={cat.name}
                    isActive={isActive}
                    onClick={() => {
                      setActiveL1Id(isActive ? null : cat.id);
                      setActiveL2Id(null);
                    }}
                    accentColor={palette.accent}
                  />
                </div>
              );
            })}

            {/* End spacer for mask */}
            <div className="min-w-[8px]" />
          </div>

          {/* L2 sub-filter row — calligraphic list */}
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] ${level2Categories.length > 0 ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"}`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-y-4 gap-x-6 sm:gap-6 sm:flex-wrap pt-3 border-t border-slate-200/20 dark:border-slate-800/10">
                {/* On desktop, we keep the spacer; on mobile grid, we skip it or use it as a grid item if needed.
                    Actually, let's keep it and adjust the grid flow. */}
                <div className="hidden sm:block min-w-[8px]" />

                {level2Categories.map((cat) => {
                  const isActive = activeL2Id === cat.id;
                  const l1Idx =
                    activeL1Id !== null
                      ? (l1ColorIndex.get(activeL1Id) ?? 0)
                      : 0;
                  const palette = PALETTE_FULL[l1Idx % PALETTE_FULL.length];

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveL2Id(isActive ? null : cat.id)}
                      className={`group relative text-[12px] transition-all duration-700 font-serif tracking-widest whitespace-nowrap py-1 ${
                        isActive
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 hover:tracking-[0.15em]"
                      }`}
                    >
                      <span
                        className={`inline-block transition-all duration-700 font-system ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"} mr-1.5`}
                        style={{ color: palette.accent }}
                      >
                        「
                      </span>
                      {cat.name}
                      <span
                        className={`inline-block transition-all duration-700 font-system ${isActive ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"} ml-1.5`}
                        style={{ color: palette.accent }}
                      >
                        」
                      </span>
                      {/* Subtle hover indicator for L2 */}
                      <span
                        className={`absolute -bottom-1 left-0 w-full h-[0.5px] bg-slate-300 dark:bg-slate-700 scale-x-0 transition-transform duration-500 group-hover:scale-x-100`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── word cloud ── */}
      <main
        className={`max-w-5xl mx-auto px-8 py-16 min-h-[40vh] ${mounted ? "" : "opacity-0"}`}
        style={
          mounted
            ? {
                animation: "main-fade-in 1s ease-out both",
                animationDelay: "200ms",
              }
            : undefined
        }
      >
        {wordDisplayList.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-slate-600 text-sm py-24 tracking-[0.3em]">
            {t("noData")}
          </div>
        ) : (
          <>
            {/* Virtual word cloud: position:relative container whose height equals all rows */}
            <div
              ref={cloudRef}
              onClick={handleCloudClick}
              onMouseOver={handleCloudMouseOver}
              onMouseLeave={handleCloudMouseLeave}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = wordRows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                    }}
                    className="flex justify-center items-center gap-x-10 pb-6"
                  >
                    {row.map((data, wordIdx) => (
                      <WordItem
                        key={data.item.id}
                        data={data}
                        rowWordIdx={wordIdx}
                        selectedItemId={
                          panelOpen ? (selectedItem?.id ?? null) : null
                        }
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Tooltip — count only, desktop only, tinted with the word's accent color */}
            {hoveredData && isDesktop && (
              <div
                key={hoveredData.itemId}
                className="fixed z-50 pointer-events-none"
                style={{
                  left: hoveredData.x,
                  top: hoveredData.y - 8,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div
                  className="px-2.5 py-1 rounded-full text-xs tracking-wider font-serif font-light whitespace-nowrap shadow-sm backdrop-blur-sm tooltip-appear"
                  style={{
                    backgroundColor: `${hoveredData.accent}22`,
                    color: hoveredData.accent,
                    border: `1px solid ${hoveredData.accent}44`,
                  }}
                >
                  {t("times", { count: hoveredData.count })}
                </div>
              </div>
            )}

            {/* Total count */}
            <div className="mt-12 flex justify-center">
              <p className="text-xs text-slate-300 dark:text-slate-700 tracking-[0.2em] select-none font-serif">
                {t("totalCount", { count: wordDisplayList.length })}
              </p>
            </div>
          </>
        )}
      </main>

      {/* ── footer ── */}
      <footer className="max-w-5xl mx-auto px-8 pb-12">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">
            &copy; {new Date().getFullYear()} {tSite("name")}
          </p>
        </div>
      </footer>

      {/* ── Detail panel (desktop slide-in / mobile drawer) ── */}
      <ImageryDetailPanel
        open={panelOpen}
        panelSide={panelSide}
        selectedItem={selectedItem}
        selectedPalette={selectedPalette}
        selectedCategoryPath={selectedCategoryPath}
        songs={songs}
        songsLoading={songsLoading}
        lyricistCounts={lyricistCounts}
        onClose={handleClose}
      />

      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </div>
  );
}
