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
import {
  HOVER_INTENT_MS,
  type HeaderVariant,
  type ScreenPanel,
  panelLit,
} from "./TimeScreen";

/** 父组件只转发正在读的年份，不持有这份状态：滚过年份时只重渲细带 */
export interface StripHandle {
  setActive: (key: string) => void;
}

interface FoldedStripProps {
  ref: Ref<StripHandle>;
  variant: HeaderVariant;
  panels: ScreenPanel[];
  matched: ReadonlySet<number> | null;
  /** 卷首的屏风已经滚出去了：细带才平滑抽出；卷首时占高为 0，不留死白 */
  visible: boolean;
  onJump: (year: number | null) => void;
  onTop: () => void;
  /** 悬停细带切片时同步通知检目线右栏（用于方案一更新落款，不触发整页重渲） */
  onHoverKeyChange?: (key: string | null) => void;
}

/**
 * 屏风合起来的样子：吸在顶栏下，每扇只剩一道封面切片，宽度与卷首屏风一扇扇同构。
 * - 用 CSS grid-rows-[0fr → 1fr] 收放：卷首未吸顶时高度为 0，彻底消除与搜索栏之间的空隙；
 * - 方案一（题眉通屏）全宽收拢，与上方通栏屏风像素对齐；
 * - 方案二（素绢引首）严格套用 20/22rem | 1fr 书脊，左栏承接「二十年 + 当前年份」，右栏与折屏齐列。
 */
export function FoldedStrip({
  ref,
  variant,
  panels,
  matched,
  visible,
  onJump,
  onTop,
  onHoverKeyChange,
}: FoldedStripProps) {
  const [active, setActive] = useState(panels[0]?.key ?? "");
  const [hovered, setHovered] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({ setActive }), []);

  const intent = useRef(0);
  useEffect(() => () => window.clearTimeout(intent.current), []);

  const open = hovered ?? active;
  const openPanel = panels.find((p) => p.key === open);
  const isFrontispiece = variant === "frontispiece";

  const updateHovered = (key: string | null) => {
    setHovered(key);
    onHoverKeyChange?.(key);
  };

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-page",
        visible
          ? "grid-rows-[1fr] opacity-100"
          : "pointer-events-none grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <nav
          aria-label="年份"
          inert={!visible}
          className={cn(
            "pb-2 pt-2",
            isFrontispiece
              ? "grid items-center gap-x-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[22rem_minmax(0,1fr)]"
              : "flex items-center",
          )}
          onPointerLeave={() => {
            window.clearTimeout(intent.current);
            updateHovered(null);
          }}
        >
          {/* 方案二：左栏严格同轴 20/22rem，放「二十年」归顶与正在读的年份 */}
          {isFrontispiece && (
            <div className="hidden items-baseline justify-between lg:flex">
              <button
                type="button"
                onClick={onTop}
                title="回到卷首"
                className="font-serif text-sm font-semibold tracking-[0.3em] text-ink transition-colors hover:text-(--tone)"
              >
                二十年
              </button>
              <span className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-(--tone)">
                {openPanel ? (openPanel.year ?? "未详") : ""}
              </span>
            </div>
          )}

          <div
            className={cn(
              "flex h-8 min-w-0 flex-1 sm:h-9",
              isFrontispiece
                ? "gap-0.5 [--w:4.5rem] sm:[--w:14rem] md:[--w:18rem] lg:[--w:16.5rem] xl:gap-0.75 xl:[--w:21.5rem]"
                : "gap-0.75 [--w:4.5rem] sm:[--w:15.5rem] md:[--w:20.5rem] xl:[--w:22.5rem]",
            )}
          >
            {panels.map((p, idx) => {
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
                      () => updateHovered(p.key),
                      HOVER_INTENT_MS,
                    );
                  }}
                  onClick={() => onJump(p.year)}
                  className="group relative min-w-0 overflow-hidden rounded-[2px] bg-slate-200/85 ring-1 ring-inset ring-slate-900/[0.06] outline-none transition-[flex-grow,flex-basis,opacity] duration-500 ease-page focus-visible:ring-2 focus-visible:ring-(--tone) dark:bg-slate-800/90 dark:ring-white/[0.08]"
                  style={{
                    flex: isOpen ? "0 0 var(--w)" : "1 1 0%",
                    opacity: lit ? 1 : 0.2,
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
                  {!isOpen && idx % 2 === 1 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-slate-950/[0.05] dark:bg-black/25"
                    />
                  )}
                  {/* 展开切片左下轻标年份（方案一全宽及移动端时，一眼可见所处年代） */}
                  {isOpen && (
                    <span
                      className={cn(
                        "absolute bottom-1 left-2 font-mono text-[10px] leading-none tabular-nums tracking-wider",
                        isFrontispiece && "lg:hidden",
                        p.art
                          ? "text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.75)]"
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
      </div>
    </div>
  );
}
