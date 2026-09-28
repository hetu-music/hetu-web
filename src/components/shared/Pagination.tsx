"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const handlePageChange = (page: number) => {
    onPageChange(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (event: Event) => {
      // 如果用户正在滚动弹出菜单内部的内容，不要关闭它
      if (popupRef.current && popupRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // 使用 capture 阶段捕获所有的 scroll 事件，因为普通的 scroll 事件不会冒泡
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("touchmove", handleScroll, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("touchmove", handleScroll);
    };
  }, [isOpen]);

  // 即使只有一页也显示，让用户明确当前状态 (1 / 1)
  if (totalPages < 1) return null;

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* 跳转到第一页 */}
      <button
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="First page"
      >
        <ChevronsLeft size={20} />
      </button>

      {/* 上一页 */}
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Previous page"
      >
        <ChevronLeft size={20} />
      </button>

      {/* 当前页 / 总页数 */}
      <div className="relative" ref={popupRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-center min-w-[80px] px-4 py-2 rounded-lg border transition-all duration-200 text-sm font-medium focus:outline-none ${
            isOpen
              ? "border-(--tone)/60 bg-(--tone)/10 text-(--tone) shadow-sm"
              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="选择页数"
        >
          <span className={isOpen ? "" : "text-(--tone)"}>{currentPage}</span>
          <span className="mx-1 text-slate-400">/</span>
          <span>{totalPages}</span>
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 flex flex-col items-center w-max min-w-[120px]">
            <div className="w-full text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1 text-center">
              跳转到...
            </div>
            <div
              className="w-full overflow-y-auto max-h-48 grid grid-cols-4 gap-1 pb-1 scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => {
                      if (page !== currentPage) {
                        handlePageChange(page);
                      }
                      setIsOpen(false);
                    }}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
                      page === currentPage
                        ? "bg-(--tone) text-white dark:text-slate-900 font-bold shadow-md"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            {/* 隐藏原生滚动条的样式通过内联或全局类控制，这里使用通用的防穿透 */}
            <style jsx>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
            `}</style>
          </div>
        )}
      </div>

      {/* 下一页 */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Next page"
      >
        <ChevronRight size={20} />
      </button>

      {/* 跳转到最后一页 */}
      <button
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Last page"
      >
        <ChevronsRight size={20} />
      </button>
    </div>
  );
};

export default Pagination;
