"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import { Link } from "@/i18n/navigation";
import type { Song } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import {
  type CoverTone,
  INK_TONE,
  toneFromImage,
} from "@/lib/utils/utils-tone";
import { AnimatePresence, motion } from "framer-motion";
import { Search, XCircle } from "lucide-react";
import Image from "next/image";
import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FeatureTiles from "./FeatureTiles";

export interface HeroLine {
  songId: number;
  text: string;
}

interface HomeLabProps {
  songs: Song[];
  lines: HeroLine[];
  imagery: { name: string; count: number }[];
}

const EASE = [0.23, 1, 0.32, 1] as const;
/** 开场每句停留的时间 */
const LINE_MS = 6500;
/** 滚过多少个视口高度，封面全部落位 */
const MORPH_SPAN = 0.8;

// ── 封面场的布局 ───────────────────────────────────────────────────────────

interface FieldSpot {
  /** 视口里的位置（0–1） */
  x: number;
  y: number;
  /** 景深：0 远 1 近 */
  z: number;
  phase: number;
  period: number;
  amp: number;
  /** 入场的先后，离中心越远越晚 */
  delay: number;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * 在视口里撒点：中间留出一块椭圆给歌词，下沿留给专题；
 * 点与点按大小保持间距，撒不下时慢慢放宽要求
 */
function layoutField(count: number, mobile: boolean, aspect: number) {
  const rand = seeded(mobile ? 23 : 7);
  const spots: FieldSpot[] = [];
  let spacing = mobile ? 0.13 : 0.075;
  for (let tries = 0; spots.length < count && tries < 20000; tries++) {
    if (tries % 400 === 399) spacing *= 0.92;
    const x = 0.03 + rand() * 0.94;
    const y = (mobile ? 0.12 : 0.13) + rand() * (mobile ? 0.68 : 0.6);
    const z = rand();
    const ex = (x - 0.5) / (mobile ? 0.5 : 0.25);
    const ey = (y - 0.43) / (mobile ? 0.12 : 0.17);
    if (ex * ex + ey * ey < 1) continue;
    const r = 0.5 + z;
    const crowded = spots.some((o) => {
      const dx = (o.x - x) * aspect;
      const dy = o.y - y;
      return Math.hypot(dx, dy) < spacing * (r + 0.5 + o.z);
    });
    if (crowded) continue;
    spots.push({
      x,
      y,
      z,
      phase: rand() * Math.PI * 2,
      period: 9000 + rand() * 7000,
      amp: 4 + rand() * 7,
      delay: Math.hypot((x - 0.5) * aspect, y - 0.45) * 900 + rand() * 250,
    });
  }
  // 近的排前面：开场的几首要挂在近处
  return spots.sort((a, b) => b.z - a.z);
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function matchesQuery(song: Song, q: string) {
  const hay = [
    song.title,
    song.album,
    ...(song.artist ?? []),
    ...(song.lyricist ?? []),
    ...(song.composer ?? []),
    ...(song.arranger ?? []),
    ...(song.creditAliases ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

interface Slot {
  cx: number;
  cy: number;
  w: number;
}

export default function HomeLab({ songs, lines, imagery }: HomeLabProps) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<{
    songs: Song[];
    spots: FieldSpot[];
  } | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [tone, setTone] = useState<CoverTone>(INK_TONE);

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** 每首在网格里的先后（按行），起飞时依次错开 */
  const slotRank = useRef(new Map<number, number>());
  const searchRef = useRef<HTMLInputElement>(null);
  const itemEls = useRef(new Map<number, HTMLAnchorElement>());
  const veilEls = useRef(new Map<number, HTMLDivElement>());
  const shadowEls = useRef(new Map<number, HTMLDivElement>());
  const imgEls = useRef(new Map<number, HTMLImageElement>());
  const slotTarget = useRef(new Map<number, Slot>());
  const slotNow = useRef(new Map<number, Slot>());
  const matchNow = useRef(new Map<number, number>());
  const highlightNow = useRef(new Map<number, number>());
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  const progressRef = useRef(0);

  const songById = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? songs.filter((s) => matchesQuery(s, q)) : songs),
    [songs, q],
  );
  const resultIds = useMemo(() => new Set(results.map((s) => s.id)), [results]);
  const fieldIds = useMemo(
    () => new Set(field?.songs.map((s) => s.id) ?? []),
    [field],
  );
  const count = songs.filter((s) => !s.dispute_note).length;
  const line = lines.length > 0 ? lines[lineIdx % lines.length] : null;
  const highlightId = line?.songId ?? null;

  // 封面场只在客户端排：要按视口大小决定撒多少张
  useEffect(() => {
    const mobile = window.innerWidth < 768;
    const n = mobile ? 24 : 46;
    const spots = layoutField(
      n,
      mobile,
      window.innerWidth / document.documentElement.clientHeight,
    );
    const covered = songs.filter((s) => s.hascover === true);
    // 开场那几句的歌先占近处的位置，其余按新旧顺次
    const heroIds = new Set(lines.map((l) => l.songId));
    const ordered = [
      ...covered.filter((s) => heroIds.has(s.id)),
      ...covered.filter((s) => !heroIds.has(s.id)),
    ].slice(0, spots.length);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 视口尺寸只有挂载后才知道
    setField({ songs: ordered, spots });
  }, [songs, lines]);

  // 开场轮播：滚下去以后停住
  useEffect(() => {
    if (lines.length < 2) return;
    const timer = setInterval(() => {
      if (document.hidden || progressRef.current > 0.3) return;
      setLineIdx((i) => (i + 1) % lines.length);
    }, LINE_MS);
    return () => clearInterval(timer);
  }, [lines.length]);

  // 当前那句的封面决定整页的颜色
  useEffect(() => {
    if (highlightId === null) return;
    const img = imgEls.current.get(highlightId);
    if (!img) return;
    const apply = () => {
      const next = toneFromImage(img);
      if (next) setTone(next);
    };
    if (img.complete && img.naturalWidth > 0) apply();
    else img.addEventListener("load", apply, { once: true });
    return () => img.removeEventListener("load", apply);
  }, [highlightId, field]);

  // 量出每首在网格里的位置；布局一变（检索、换行、字体载入）就重量
  const measure = useCallback(() => {
    const root = rootRef.current;
    const grid = gridRef.current;
    if (!root || !grid) return;
    const origin = root.getBoundingClientRect();
    grid.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
      const id = Number(el.dataset.slot);
      const r = el.getBoundingClientRect();
      const slot = {
        cx: r.left - origin.left + r.width / 2,
        cy: r.top - origin.top + r.height / 2,
        w: r.width,
      };
      slotTarget.current.set(id, slot);
      if (!slotNow.current.has(id)) slotNow.current.set(id, { ...slot });
    });
    const ranked = [...slotTarget.current.entries()]
      .filter(([id]) => itemEls.current.has(id))
      .sort(([, a], [, b]) => a.cy - b.cy || a.cx - b.cx);
    slotRank.current = new Map(
      ranked.map(([id], i) => [id, i / Math.max(ranked.length - 1, 1)]),
    );
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, results, field]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // ── 每一帧：开场的散布 ↔ 网格里的位置，按滚动进度插值 ─────────────────
  const live = useRef({ resultIds, highlightId });
  useEffect(() => {
    live.current = { resultIds, highlightId };
  }, [resultIds, highlightId]);

  useEffect(() => {
    if (!field) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mobile = window.innerWidth < 768;
    const start = performance.now();
    let viewH = document.documentElement.clientHeight;
    let viewW = window.innerWidth;
    const onResize = () => {
      // 只在宽度变了才换高度，免得 iOS 地址栏伸缩让封面跳
      if (window.innerWidth !== viewW) {
        viewW = window.innerWidth;
        viewH = document.documentElement.clientHeight;
      }
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const scrollY = window.scrollY;
      const p = clamp01(scrollY / (viewH * MORPH_SPAN));
      progressRef.current = p;
      const base = mobile
        ? viewW * 0.2
        : Math.min(Math.max(viewW * 0.075, 96), 150);
      const ptr = pointer.current;
      ptr.sx += (ptr.x - ptr.sx) * 0.05;
      ptr.sy += (ptr.y - ptr.sy) * 0.05;
      const t = now - start;
      const { resultIds: ids, highlightId: hid } = live.current;

      const heroText = heroTextRef.current;
      if (heroText) {
        heroText.style.opacity = String(clamp01(1 - p * 4));
        heroText.style.transform = `translate3d(0, ${-p * 60}px, 0)`;
      }
      // 飞行途中封面压在所有内容上面；落定以后退到吸顶栏下面
      if (layerRef.current) {
        const zi = p > 0 && p < 1 ? "45" : "10";
        if (layerRef.current.style.zIndex !== zi)
          layerRef.current.style.zIndex = zi;
      }

      field.songs.forEach((song, i) => {
        const el = itemEls.current.get(song.id);
        const spot = field.spots[i];
        if (!el || !spot) return;

        // 检索：不命中的淡出；落位也做平滑，免得网格重排时跳
        const target = slotTarget.current.get(song.id);
        const slot = slotNow.current.get(song.id);
        if (target && slot) {
          slot.cx += (target.cx - slot.cx) * 0.14;
          slot.cy += (target.cy - slot.cy) * 0.14;
          slot.w += (target.w - slot.w) * 0.14;
        }
        const m0 = matchNow.current.get(song.id) ?? 1;
        const m = m0 + ((ids.has(song.id) ? 1 : 0) - m0) * 0.12;
        matchNow.current.set(song.id, m);
        const h0 = highlightNow.current.get(song.id) ?? 0;
        const h = h0 + ((song.id === hid ? 1 : 0) - h0) * 0.06;
        highlightNow.current.set(song.id, h);

        // 按网格里的先后错开起飞，前排先落定
        const k = slotRank.current.get(song.id) ?? 0;
        const e = easeInOut(clamp01((p - k * 0.35) / 0.65));
        const hero = 1 - e;

        const intro = reduce
          ? 1
          : easeOut(clamp01((t - 200 - spot.delay) / 1400));
        const breathe = reduce ? 0 : 1;
        const w = Math.sin((t / spot.period) * Math.PI * 2 + spot.phase);
        const v = Math.cos((t / spot.period) * Math.PI * 1.6 + spot.phase);
        const depth = 0.3 + spot.z * 0.9;
        const par = mobile || reduce ? 0 : (spot.z - 0.35) * 26;

        const hx =
          spot.x * viewW + w * spot.amp * depth * breathe - ptr.sx * par;
        const hy =
          spot.y * viewH +
          v * spot.amp * depth * breathe -
          ptr.sy * par +
          (1 - intro) * 28;
        const heroSize = base * (0.5 + spot.z * 0.75) * (1 + 0.22 * h);

        const cx = slot ? lerp(hx, slot.cx, e) : hx;
        const cy = slot ? lerp(hy + scrollY, slot.cy, e) : hy + scrollY;
        const w0 = slot?.w ?? base;
        const size = slot ? lerp(heroSize, slot.w, e) : heroSize;
        const scale = (size / w0) * lerp(0.9, 1, intro);

        // 宽高只在网格尺寸变了才改，免得每帧触发重排
        const px = `${w0.toFixed(1)}px`;
        if (el.style.width !== px) {
          el.style.width = px;
          el.style.height = px;
        }
        el.style.transform = `translate3d(${cx - w0 / 2}px, ${cy - w0 / 2}px, 0) scale(${scale})`;
        el.style.opacity = String(intro * m);
        const zi = String(Math.round(spot.z * 100) + (h > 0.5 ? 200 : 0));
        if (el.style.zIndex !== zi) el.style.zIndex = zi;
        const pe = m > 0.5 && intro > 0.8 ? "auto" : "none";
        if (el.style.pointerEvents !== pe) el.style.pointerEvents = pe;

        // 远处的封面罩一层底色，像隔着空气；当前那句的封面拨开它
        const veil = veilEls.current.get(song.id);
        if (veil)
          veil.style.opacity = String(
            (1 - spot.z) * 0.55 * hero * (1 - h) +
              (hid !== null ? 0.12 * hero * (1 - h) : 0),
          );
        const shadow = shadowEls.current.get(song.id);
        if (shadow) shadow.style.opacity = String((0.3 + spot.z * 0.7) * hero);
      });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [field]);

  const focusSearch = () => {
    document
      .getElementById("works")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 600);
  };

  const lineSong = line ? songById.get(line.songId) : undefined;

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": tone.light,
          "--tone-dark": tone.dark,
        } as React.CSSProperties
      }
    >
      {/* 取色铺底：跟着当前那句的封面缓缓转色 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[110svh] transition-[background-color] duration-1400 ease-out mask-[radial-gradient(ellipse_70%_55%_at_50%_42%,black,transparent_75%)]"
        style={{ backgroundColor: tone.wash }}
      />

      <TopBar
        exit={{ kind: "logo" }}
        pinned={
          <button
            type="button"
            onClick={focusSearch}
            className={NAV_BUTTON_CLASS}
            aria-label="寻"
            title="寻"
          >
            <Search size={20} />
          </button>
        }
      />

      {/* 封面场：绝对定位在页面坐标里，落位之后随页面一起滚，不用每帧追 */}
      <div
        ref={layerRef}
        className="pointer-events-none absolute left-0 top-0 z-10 h-0 w-full"
      >
        {field?.songs.map((song) => (
          <Link
            key={song.id}
            href={`/song/${song.id}`}
            ref={(el) => {
              if (el) itemEls.current.set(song.id, el);
              else itemEls.current.delete(song.id);
            }}
            aria-label={song.title}
            className="group absolute left-0 top-0 block opacity-0 outline-none will-change-transform"
          >
            <div
              ref={(el) => {
                if (el) shadowEls.current.set(song.id, el);
                else shadowEls.current.delete(song.id);
              }}
              className="absolute inset-0 rounded-md shadow-[0_22px_44px_-22px_rgba(15,23,42,0.55)] dark:shadow-[0_22px_44px_-18px_rgba(0,0,0,0.9)]"
            />
            <div className="relative size-full overflow-hidden rounded-md bg-slate-200 ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
              <Image
                ref={(el) => {
                  if (el) imgEls.current.set(song.id, el);
                  else imgEls.current.delete(song.id);
                }}
                src={getCoverUrl(song)}
                alt=""
                width={320}
                height={320}
                sizes="(min-width: 768px) 200px, 30vw"
                priority
                className="size-full object-cover transition-transform duration-700 ease-page group-hover:scale-[1.04]"
              />
              <div
                ref={(el) => {
                  if (el) veilEls.current.set(song.id, el);
                  else veilEls.current.delete(song.id);
                }}
                className="absolute inset-0 bg-[#FAFAFA] dark:bg-[#0B0F19]"
              />
            </div>
          </Link>
        ))}
      </div>

      {/* ── 开场 ── */}
      <section className="relative z-20 flex h-svh flex-col pointer-events-none">
        <div
          ref={heroTextRef}
          className="flex flex-1 flex-col items-center justify-center px-6 pt-(--nav-h) text-center will-change-transform"
        >
          <p className="text-[11px] md:text-xs tracking-[0.35em] text-(--tone) transition-colors duration-1000 animate-in fade-in duration-1000 fill-mode-both">
            河图作品勘鉴 · 收录 {count} 首
          </p>
          <div className="mt-6 md:mt-8 min-h-[5.5rem] md:min-h-[8rem]">
            <AnimatePresence mode="wait">
              {line && (
                <motion.div key={`${line.songId}-${lineIdx}`}>
                  <Link
                    href={`/song/${line.songId}`}
                    className="pointer-events-auto block outline-none"
                  >
                    <p
                      aria-label={line.text}
                      className="font-kaiti leading-[1.35] md:leading-[1.25] text-slate-900 dark:text-slate-50 text-balance"
                      style={{
                        // 最长的一段不折行：按字数把字号压到放得下
                        fontSize: `min(3.75rem, calc((100vw - 3rem) / ${Math.max(
                          ...line.text.split(/s+/).map((ph) => ph.length),
                          8,
                        )}))`,
                      }}
                    >
                      {line.text.split(/\s+/).map((phrase, pi, all) => (
                        <span
                          key={pi}
                          className="inline-block whitespace-nowrap"
                        >
                          {Array.from(phrase).map((ch, ci) => {
                            const index = all.slice(0, pi).join("").length + ci;
                            return (
                              <span
                                key={ci}
                                aria-hidden
                                className="inline-block overflow-hidden pb-[0.12em] align-bottom"
                              >
                                <motion.span
                                  className="inline-block"
                                  initial={{ y: "105%" }}
                                  animate={{ y: "0%" }}
                                  exit={{ opacity: 0, y: "-30%" }}
                                  transition={{
                                    duration: 0.9,
                                    ease: EASE,
                                    delay: index * 0.055,
                                  }}
                                >
                                  {ch}
                                </motion.span>
                              </span>
                            );
                          })}
                          {pi < all.length - 1 && (
                            <span className="inline-block w-[0.6em]" />
                          )}
                        </span>
                      ))}
                    </p>
                    {lineSong && (
                      <motion.p
                        className="mt-5 md:mt-7 text-xs md:text-sm tracking-[0.3em] text-slate-500 dark:text-slate-400"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
                      >
                        <span className="font-serif">《{lineSong.title}》</span>
                        {lineSong.year && (
                          <span className="ml-3 font-mono tracking-wider text-slate-400 dark:text-slate-500">
                            {lineSong.year}
                          </span>
                        )}
                      </motion.p>
                    )}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          className="pointer-events-auto mx-auto w-full max-w-7xl px-4 pb-5 sm:px-6 md:pb-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 1.4 }}
        >
          <FeatureTiles imagery={imagery} />
        </motion.div>
      </section>

      {/* ── 全部作品 ── */}
      <section id="works" className="relative scroll-mt-(--nav-h)">
        <div className="sticky top-(--nav-h) z-40 bg-[#FAFAFA]/95 backdrop-blur-sm dark:bg-[#0B0F19]/95">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 border-b border-slate-200/70 px-4 sm:px-6 dark:border-slate-800">
            <h2 className="shrink-0 font-serif text-base md:text-lg font-semibold tracking-wide text-slate-900 dark:text-slate-50">
              全部作品
            </h2>
            <span className="shrink-0 text-xs tabular-nums tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {q ? `得 ${results.length} 首` : `${count} 首`}
            </span>
            <label className="group relative ml-auto flex h-full min-w-0 max-w-64 flex-1 items-center gap-2">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="寻一首歌、一个名字"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="清除"
                  className="shrink-0 p-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                >
                  <XCircle size={14} />
                </button>
              )}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-(--tone) opacity-0 transition-opacity group-focus-within:opacity-100"
              />
            </label>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-6 md:pt-10">
          {results.length === 0 ? (
            <p className="py-20 text-center font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              没有找到这首歌
            </p>
          ) : (
            <ul
              ref={gridRef}
              className="grid grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 md:gap-x-6 md:gap-y-10 lg:grid-cols-6"
            >
              {results.map((song) => (
                <WorkItem
                  key={song.id}
                  song={song}
                  inField={fieldIds.has(song.id)}
                />
              ))}
            </ul>
          )}
          <SiteMark className="mt-24 text-center" />
        </div>
      </section>
    </div>
  );
}

function WorkItem({ song, inField }: { song: Song; inField: boolean }) {
  const meta = [song.year, song.type?.[0]].filter(Boolean).join(" · ");
  return (
    <li className="min-w-0">
      {/* 封面场里的那几首，图由上面那层飞过来盖住这里 */}
      <div data-slot={song.id} className="relative aspect-square">
        {!inField && (
          <Link
            href={`/song/${song.id}`}
            className="group block size-full overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10"
          >
            {song.hascover ? (
              <Image
                src={getCoverUrl(song)}
                alt={song.title}
                width={320}
                height={320}
                sizes="(min-width: 768px) 200px, 30vw"
                className="size-full object-cover grayscale-[25%] transition-[filter,scale] duration-700 ease-page group-hover:grayscale-0 group-hover:scale-[1.04]"
              />
            ) : (
              <span className="flex size-full justify-center p-3">
                <span className="font-serif text-sm tracking-[0.25em] text-slate-500 [writing-mode:vertical-rl] dark:text-slate-400">
                  {song.title}
                </span>
              </span>
            )}
          </Link>
        )}
      </div>
      <Link
        href={`/song/${song.id}`}
        className={cn(
          "mt-2.5 block truncate font-serif text-[13px] md:text-sm text-slate-800 transition-colors hover:text-(--tone) dark:text-slate-200",
        )}
      >
        {song.title}
      </Link>
      {meta && (
        <p className="mt-0.5 truncate text-[11px] tracking-wider text-slate-400 dark:text-slate-500">
          {meta}
        </p>
      )}
    </li>
  );
}
