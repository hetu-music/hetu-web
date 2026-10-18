"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// 首页没有「上一页」：用 invisible 而不是变淡，书上本来就没有，占位不动免得中间的页码跳
const TEXT_BUTTON_CLASS =
  "py-1 text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 disabled:invisible dark:text-slate-500 dark:hover:text-slate-200";

/**
 * 列表收尾的那道细线按页数等分，当前页那一段亮强调色：线既收尾，也是页码。
 * 线上可点可拖，拖动时只预览，松手才翻页，免得拖过的每一页都加载一遍。
 * 不用 Base UI Slider：它把滑块中心放在 (值 - 最小) / 跨度 处，对不上等分的段。
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  const t = useTranslations("common.pagination");
  const trackRef = useRef<HTMLDivElement>(null);
  // 悬停或拖动时指着的那一页
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // 即使只有一页也显示，让用户明确当前状态 (1 / 1)
  if (totalPages < 1) return null;

  const goTo = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages);
    if (next === currentPage) return;
    onPageChange(next);
    window.scrollTo({ top: 0 });
  };

  const pageAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return currentPage;
    const rect = track.getBoundingClientRect();
    const index = Math.floor(((clientX - rect.left) / rect.width) * totalPages);
    return Math.min(totalPages, Math.max(1, index + 1));
  };

  const segmentStyle = (page: number): React.CSSProperties => ({
    left: `${((page - 1) / totalPages) * 100}%`,
    width: `${100 / totalPages}%`,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setPreview(pageAt(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging || event.pointerType === "mouse") {
      setPreview(pageAt(event.clientX));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    // 翻页会滚回顶部，鼠标已不在线上，悬停的预览不留
    setPreview(null);
    goTo(pageAt(event.clientX));
  };

  const handlePointerCancel = () => {
    // 窄屏从线上开始竖着滑是在滚页面，浏览器接管后会发 cancel
    setDragging(false);
    setPreview(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = {
      ArrowLeft: currentPage - 1,
      ArrowDown: currentPage - 1,
      ArrowRight: currentPage + 1,
      ArrowUp: currentPage + 1,
      Home: 1,
      End: totalPages,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    goTo(target);
  };

  const previewing = preview !== null && preview !== currentPage;

  return (
    <nav aria-label={t("label")} className={cn("w-full", className)}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={t("track")}
        aria-valuemin={1}
        aria-valuemax={totalPages}
        aria-valuenow={currentPage}
        aria-valuetext={t("page", { current: currentPage, total: totalPages })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => !dragging && setPreview(null)}
        onKeyDown={handleKeyDown}
        // 线本身只有 1px，上下各留出一截给手指；只拦横向，竖着滑照常滚页面
        className="relative h-8 cursor-pointer touch-pan-y select-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone)/40"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px bg-slate-200 dark:bg-slate-800"
        />
        {previewing && (
          <span
            aria-hidden
            className="absolute top-1/2 h-px bg-slate-400 dark:bg-slate-500"
            style={segmentStyle(preview)}
          />
        )}
        <span
          aria-hidden
          className="absolute top-1/2 h-0.5 -translate-y-1/4 rounded-full bg-(--tone) transition-[left] duration-500 ease-page"
          style={segmentStyle(currentPage)}
        />
        {preview !== null && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-1/2 mb-1.5 -translate-x-1/2 font-serif text-xs tabular-nums",
              previewing
                ? "text-slate-500 dark:text-slate-400"
                : "text-(--tone)",
            )}
            style={{ left: `${((preview - 0.5) / totalPages) * 100}%` }}
          >
            {preview}
          </span>
        )}
      </div>

      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-baseline">
        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(TEXT_BUTTON_CLASS, "justify-self-start")}
        >
          {t("prev")}
        </button>
        <p className="font-serif text-sm tabular-nums text-slate-400 dark:text-slate-500">
          <span
            className={cn(
              "transition-colors",
              previewing
                ? "text-(--tone)"
                : "text-slate-700 dark:text-slate-300",
            )}
          >
            {previewing ? preview : currentPage}
          </span>
          <span className="mx-1.5">/</span>
          {totalPages}
        </p>
        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(TEXT_BUTTON_CLASS, "justify-self-end")}
        >
          {t("next")}
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
