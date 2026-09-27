"use client";

import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useRef, useState } from "react";

export interface NavItem {
  id: string;
  label: string;
}

/** 顶栏高度：跳转后章节落在顶栏下方 */
const NAV_HEIGHT = 80;
/** 章节顶端越过视口这一比例处即算读到该节 */
const READING_LINE = 0.3;

/**
 * 当前读到的章节：顶端已越过阅读线的最后一节；
 * 滚到底时，最后几节即使够不到阅读线，露出来的也算。
 * 调用方需保持 items 引用稳定。
 */
export function useActiveSection(items: NavItem[]) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const atBottom =
        vh + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= vh * READING_LINE || (atBottom && top < vh)) {
          current = item.id;
        }
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  return active;
}

function jumpTo(items: NavItem[], id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top =
    id === items[0]?.id
      ? 0
      : el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top, behavior: "smooth" });
}

function SectionList({
  items,
  active,
  onSelect,
  size,
}: {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  size: "sm" | "lg";
}) {
  return (
    <ol>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={current ? "location" : undefined}
              className={cn(
                "relative w-full pl-4 text-left font-serif tracking-wider transition-colors",
                size === "sm" ? "py-2 text-sm" : "py-3 text-base",
                current
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-full bg-(--tone) transition-opacity",
                  current ? "opacity-100" : "opacity-0",
                )}
              />
              {item.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 顶栏里的章节指示：宽屏常驻「歌名 · 当前章节」；窄屏放不下歌名，
 * 卷首时显示「目录」，滚过题名后显示当前章节。
 * 点开后宽屏在下方展开目录，窄屏由 SectionSheet 从底部拉出。
 */
export function SectionNav({
  items,
  active,
  title,
  showTitle,
  open,
  onOpenChange,
}: {
  items: NavItem[];
  active: string;
  title: string;
  /** 卷首的大标题已滚出视口（只影响窄屏） */
  showTitle: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("song");
  const activeLabel = items.find((i) => i.id === active)?.label;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.("[data-section-nav]")) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div data-section-nav className="relative min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("sections.toc")}
        className="group flex min-w-0 max-w-full items-baseline gap-2 px-2 py-1.5"
      >
        <span className="hidden sm:block min-w-0 truncate font-serif text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </span>
        <span
          aria-hidden
          className="hidden sm:block text-slate-300 dark:text-slate-600"
        >
          ·
        </span>
        {/* 章节名与三角标自成一组居中对齐；整组再按基线与歌名对齐 */}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap font-serif text-sm tracking-wider transition-colors",
            open
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100",
          )}
        >
          <span className="hidden sm:inline">{activeLabel}</span>
          <span className="sm:hidden">
            {showTitle && activeLabel ? activeLabel : t("folio.toc")}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-slate-400 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="hidden md:block absolute z-10 left-0 top-full mt-3 w-52 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] px-4 py-2"
          >
            <SectionList
              items={items}
              active={active}
              size="sm"
              onSelect={(id) => {
                onOpenChange(false);
                jumpTo(items, id);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 窄屏的目录：从底部拉出。须放在顶栏之外——
 * 顶栏的 backdrop-filter 会把其中 fixed 元素困在顶栏里。
 */
export function SectionSheet({
  items,
  active,
  open,
  onOpenChange,
}: {
  items: NavItem[];
  active: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("song");

  return (
    <AnimatePresence>
      {open && (
        <div data-section-nav className="md:hidden">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-60 bg-slate-950/30 backdrop-blur-[2px]"
          />
          <motion.nav
            key="sheet"
            aria-label={t("sections.toc")}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-0 bottom-0 z-60 rounded-t-2xl bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <p className="font-serif text-xs tracking-[0.4em] text-(--tone)">
                {t("folio.toc")}
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={t("folio.caption.close")}
                className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-6">
              <SectionList
                items={items}
                active={active}
                size="lg"
                onSelect={(id) => {
                  onOpenChange(false);
                  jumpTo(items, id);
                }}
              />
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

/** 顶栏下沿的阅读进度，用封面取色 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // 评点等内容晚到时页面会变高
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5"
    >
      <div
        ref={barRef}
        className="h-full origin-left bg-(--tone) opacity-70"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
