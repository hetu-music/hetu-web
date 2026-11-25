"use client";

import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import Image from "next/image";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { HOVER_INTENT_MS, type ScreenPanel, panelLit } from "./TimeScreen";

/** 父组件只转发正在读的年份，不持有这份状态：滚过年份时只重渲细带 */
export interface StripHandle {
  setActive: (key: string) => void;
}

interface FoldedStripProps {
  ref: Ref<StripHandle>;
  panels: ScreenPanel[];
  matched: ReadonlySet<number> | null;
  /** 卷首的屏风已经滚出去了：细带才出现，否则这里只是一段留白 */
  visible: boolean;
  onJump: (year: number | null) => void;
  onTop: () => void;
}

/**
 * 屏风合起来的样子：吸在顶栏下，每扇只剩一道封面切片，宽度与卷首的屏一扇扇对齐。
 * 仍然只开一扇——开的是正在读的那一年；指向别的切片时临时开那一扇，点下去翻到那一年。
 * 取代原来右侧的年份标尺。
 */
export function FoldedStrip({
  ref,
  panels,
  matched,
  visible,
  onJump,
  onTop,
}: FoldedStripProps) {
  const [active, setActive] = useState(panels[0]?.key ?? "");
  const [hovered, setHovered] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ setActive }), []);

  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const open = hovered ?? active;
  const openPanel = panels.find((p) => p.key === open);

  return (
    <nav
      aria-label="年份"
      inert={!visible}
      className={cn(
        // --w 与卷首屏风展开那一扇同宽：每一扇正好向上收成自己那一道
        "flex h-10 transition-[opacity,clip-path] duration-500 ease-page [--w:4rem] sm:[--w:16.25rem] md:[--w:22.5rem] xl:[--w:25rem]",
        visible
          ? "opacity-100 [clip-path:inset(0)]"
          : "pointer-events-none opacity-0 [clip-path:inset(100%_0_0_0)]",
      )}
      onPointerLeave={() => {
        window.clearTimeout(intent.current);
        setHovered(null);
      }}
    >
      {/* 序屏合起来只剩题头，兼当说明牌：显示开着的是哪一年 */}
      <div className="mr-4 hidden w-36 shrink-0 items-center justify-between md:mr-6 md:w-44 sm:flex">
        <button
          type="button"
          onClick={onTop}
          title="回到卷首"
          className="font-serif text-sm font-semibold tracking-[0.3em] text-ink transition-colors hover:text-(--tone)"
        >
          二十年
        </button>
        <span className="font-mono text-[11px] tabular-nums tracking-wider text-(--tone)">
          {openPanel ? (openPanel.year ?? "未详") : ""}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 gap-0.75">
        {panels.map((p) => {
          const isOpen = p.key === open;
          const lit = panelLit(p, matched);
          return (
            <button
              key={p.key}
              type="button"
              aria-label={p.year === null ? "年份未详" : `${p.year} 年`}
              aria-current={p.key === active ? "true" : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                window.clearTimeout(intent.current);
                intent.current = window.setTimeout(
                  () => setHovered(p.key),
                  HOVER_INTENT_MS,
                );
              }}
              onClick={() => onJump(p.year)}
              className="group relative min-w-0 overflow-hidden rounded-[2px] bg-slate-200 outline-none transition-[flex-grow,flex-basis,opacity] duration-500 ease-page focus-visible:ring-2 focus-visible:ring-(--tone) dark:bg-slate-800"
              style={{
                flex: isOpen ? "0 0 var(--w)" : "1 1 0%",
                opacity: lit ? 1 : 0.22,
              }}
            >
              {p.song && p.art && (
                <Image
                  src={getCoverUrl(p.song)}
                  alt=""
                  width={400}
                  height={400}
                  sizes="400px"
                  draggable={false}
                  className={cn(
                    "absolute top-1/2 left-1/2 h-(--w) w-(--w) max-w-none -translate-x-1/2 -translate-y-1/2 object-cover transition-[filter] duration-500",
                    isOpen
                      ? "grayscale-0"
                      : "brightness-[0.92] grayscale-[35%] group-hover:grayscale-0",
                  )}
                />
              )}
              {/* 窄屏没有题头那一格，年份写在开着的切片上 */}
              {isOpen && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1.5 font-mono text-[10px] tabular-nums tracking-wider sm:hidden",
                    p.art
                      ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]"
                      : "text-ink-meta",
                  )}
                >
                  {p.year ?? "未详"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
