"use client";

import { useEffect, useRef, useState } from "react";
import { NAV_HEIGHT } from "@/components/shared/nav-button";
import { PlaceNav } from "@/components/shared/topbar/parts";
import { useIntersection } from "@/hooks/ui/useIntersection";

export interface NavItem {
  id: string;
  label: string;
}

/** 卷首大标题的 id，顶栏据此判断它是否已滚出视口 */
export const SONG_TITLE_ID = "song-title";

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

/**
 * 顶栏里的目录与当前章节。滚动带来的状态（当前章节、标题是否滚出视口）都收在这里，
 * 换章节时只重渲染这一小块，不牵动整页（4 倍降速的手机上整页重渲染一次要 20 ms 上下）。
 */
export function SectionPlaceNav({
  title,
  items,
  tocLabel,
}: {
  title: string;
  /** 需保持引用稳定，见 useActiveSection */
  items: NavItem[];
  tocLabel: string;
}) {
  const activeSection = useActiveSection(items);
  const { ref: observeTitle, entry: titleEntry } = useIntersection<HTMLElement>(
    { rootMargin: `-${NAV_HEIGHT}px 0px 0px 0px` },
  );
  useEffect(() => {
    observeTitle(document.getElementById(SONG_TITLE_ID));
    return () => observeTitle(null);
  }, [observeTitle]);
  const titleOutOfView = titleEntry ? !titleEntry.isIntersecting : false;

  // 窄屏放不下歌名：卷首时显示「目录」，滚过题名后显示当前章节
  const activeLabel = items.find((i) => i.id === activeSection)?.label;
  return (
    <PlaceNav
      title={title}
      label={titleOutOfView && activeLabel ? activeLabel : tocLabel}
      items={items}
      active={activeSection}
      onSelect={(id) => jumpTo(items, id)}
      menuTitle={tocLabel}
    />
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

  // 2px 的进度条与顶栏 1px 的底边中线对齐：底边在盒子外 1px，进度条再往下多出半像素
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-[1.5px] h-0.5"
    >
      <div
        ref={barRef}
        className="h-full origin-left bg-(--tone) opacity-70"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
