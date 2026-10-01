"use client";

import { useEffect, useRef, useState } from "react";

export interface NavItem {
  id: string;
  label: string;
}

/** 顶栏高度（同 globals.css 的 --nav-h）：跳转后章节落在顶栏下方 */
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

export function jumpTo(items: NavItem[], id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top =
    id === items[0]?.id
      ? 0
      : el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top, behavior: "smooth" });
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
