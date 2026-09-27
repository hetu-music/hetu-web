"use client";

import { cn } from "@/lib/utils/utils";
import {
  type CommentSlot,
  type CommentThread,
  countThreads,
} from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComments } from "./CommentsContext";
import SlotPanel from "./SlotPanel";

/** 相邻两则旁批之间的最小间距 */
const NOTE_GAP = 14;
/** 旁批正文的行高（15px × 1.85），用来与所批那一行的首行对齐 */
const NOTE_LINE_HEIGHT = 27.75;

/**
 * 宽屏左栏的旁批：每一处批注的顶端对齐它所批的那一行（带 data-comment-slot 的元素）。
 * 上下挤在一起时后面的依次往下推，推到容器外时撑高容器。
 * 每处只露一则，点开后在原处展开全部批注与输入框；同一时间只展开一处。
 * 所批的文字被折叠遮住时（祖先带 data-comment-clip），旁批也先不显示。
 */
export default function CommentGutter({
  slots,
  containerRef,
  focusKeys = null,
  className,
}: {
  /** 本章节内所有可批注的位置 */
  slots: CommentSlot[];
  containerRef: React.RefObject<HTMLElement | null>;
  /** 聚焦意象时仍保持清晰的位置；其余旁批随正文一起变淡 */
  focusKeys?: Set<string> | null;
  className?: string;
}) {
  const { threads, openSlot } = useComments();
  const visible = useMemo(
    () =>
      slots.filter(
        (s) => (threads.get(s.key)?.length ?? 0) > 0 || s.key === openSlot,
      ),
    [slots, threads, openSlot],
  );

  const noteRefs = useRef(new Map<string, HTMLDivElement>());
  const [tops, setTops] = useState<Record<string, number>>({});
  // 已经在原位显示过一帧的旁批：之后被推挤时才用过渡，
  // 新出现的旁批直接落在所批的那一行，不从顶上滑下来
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const placed = Object.keys(tops);
    if (placed.every((k) => settled.has(k)) && settled.size === placed.length)
      return;
    const frame = requestAnimationFrame(() => setSettled(new Set(placed)));
    return () => cancelAnimationFrame(frame);
  }, [tops, settled]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const layout = () => {
      // 左栏在窄屏隐藏，此时不必排
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        container.style.minHeight = "";
        return;
      }
      const base = container.getBoundingClientRect().top;
      const items = visible
        .map((slot) => {
          const anchor = container.querySelector<HTMLElement>(
            `[data-comment-slot="${slot.key}"]`,
          );
          const note = noteRefs.current.get(slot.key);
          if (!anchor || !note) return null;
          const clip = anchor.closest("[data-comment-clip]");
          if (
            clip &&
            anchor.getBoundingClientRect().top >=
              clip.getBoundingClientRect().bottom - 4
          ) {
            return null;
          }
          const lineHeight = parseFloat(getComputedStyle(anchor).lineHeight);
          const offset = Number.isFinite(lineHeight)
            ? Math.max(0, (lineHeight - NOTE_LINE_HEIGHT) / 2)
            : 0;
          return {
            key: slot.key,
            anchorTop: anchor.getBoundingClientRect().top - base + offset,
            height: note.offsetHeight,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.anchorTop - b.anchorTop);

      const next: Record<string, number> = {};
      let bottom = -Infinity;
      for (const item of items) {
        const top = Math.max(item.anchorTop, bottom + NOTE_GAP);
        next[item.key] = Math.round(top);
        bottom = top + item.height;
      }
      container.style.minHeight = bottom > 0 ? `${Math.ceil(bottom)}px` : "";
      setTops((prev) => {
        const same =
          Object.keys(prev).length === Object.keys(next).length &&
          Object.entries(next).every(([k, v]) => prev[k] === v);
        return same ? prev : next;
      });
    };

    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(container);
    noteRefs.current.forEach((el) => observer.observe(el));
    window.addEventListener("resize", layout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", layout);
      container.style.minHeight = "";
    };
  }, [visible, containerRef]);

  if (visible.length === 0) return null;

  return (
    <div
      className={cn("hidden lg:block absolute left-0 top-0 w-68", className)}
    >
      {visible.map((slot) => (
        <div
          key={slot.key}
          ref={(el) => {
            if (el) noteRefs.current.set(slot.key, el);
            else noteRefs.current.delete(slot.key);
          }}
          className={cn(
            "absolute inset-x-0 duration-300",
            settled.has(slot.key)
              ? "transition-[top,opacity]"
              : "transition-opacity",
            slot.key === openSlot && "z-10",
            tops[slot.key] === undefined && "opacity-0 pointer-events-none",
            focusKeys &&
              !focusKeys.has(slot.key) &&
              slot.key !== openSlot &&
              "opacity-20",
          )}
          style={{ top: tops[slot.key] ?? 0 }}
        >
          <SideNote slot={slot} list={threads.get(slot.key) ?? []} />
        </div>
      ))}
    </div>
  );
}

function SideNote({
  slot,
  list,
}: {
  slot: CommentSlot;
  list: CommentThread[];
}) {
  const t = useTranslations("song.folio.comments");
  const { openSlot, setOpenSlot } = useComments();

  if (slot.key === openSlot) {
    return (
      // 「收起」放在旁批右侧的页边空白里，与第一则批注的首行平齐，
      // 不占批注的宽度，展开后批注的位置与换行都不变
      <div className="relative -mx-4 -my-3 px-4 py-3 rounded-lg bg-[#FAFAFA]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm">
        <SlotPanel
          slot={slot}
          autoFocus={list.length === 0}
          onCancel={list.length === 0 ? () => setOpenSlot(null) : undefined}
        />
        {list.length > 0 && (
          <span className="absolute left-full top-3 ml-2 font-kaiti text-[15px] leading-[1.85] whitespace-nowrap">
            <button
              type="button"
              onClick={() => setOpenSlot(null)}
              className="font-sans text-xs tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {t("fold")}
            </button>
          </span>
        )}
      </div>
    );
  }

  const lead = list.find((th) => !th.comment.deleted) ?? list[0];
  if (!lead) return null;
  const total = countThreads(list);
  const shown = lead.comment.deleted ? 0 : 1;

  return (
    <button
      type="button"
      onClick={() => setOpenSlot(slot.key)}
      className="group block w-full text-left"
    >
      <p
        className={cn(
          "font-kaiti text-[15px] leading-[1.85] line-clamp-3 transition-colors",
          lead.comment.deleted
            ? "text-slate-400 dark:text-slate-600"
            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200",
        )}
      >
        {lead.comment.deleted ? t("deleted") : lead.comment.body}
      </p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {!lead.comment.deleted && (
          <>
            {lead.comment.author || t("anonymous")}
            {lead.comment.private && (
              <span className="ml-2 px-1 rounded-sm ring-1 ring-current text-[10px] leading-4">
                {t("private")}
              </span>
            )}
          </>
        )}
        {total > shown && (
          <span className="ml-2 group-hover:text-(--tone) transition-colors">
            {t("more", { count: total - shown })}
          </span>
        )}
      </p>
    </button>
  );
}
