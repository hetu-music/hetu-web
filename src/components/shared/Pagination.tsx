"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const t = useTranslations("common.pagination");
  const [isOpen, setIsOpen] = useState(false);

  const handlePageChange = (page: number) => {
    onPageChange(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  // 即使只有一页也显示，让用户明确当前状态 (1 / 1)
  if (totalPages < 1) return null;

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* 跳转到第一页 */}
      <button
        onClick={() => handlePageChange(1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label={t("first")}
      >
        <ChevronsLeft size={20} />
      </button>

      {/* 上一页 */}
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label={t("prev")}
      >
        <ChevronLeft size={20} />
      </button>

      {/* 当前页 / 总页数 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          className={`flex items-center justify-center min-w-[80px] px-4 py-2 rounded-lg border transition-all duration-200 text-sm font-medium focus:outline-none ${
            isOpen
              ? "border-(--tone)/60 bg-(--tone)/10 text-(--tone) shadow-sm"
              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title={t("choose")}
        >
          <span className={isOpen ? "" : "text-(--tone)"}>{currentPage}</span>
          <span className="mx-1 text-slate-400">/</span>
          <span>{totalPages}</span>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={8}
          className="flex w-max min-w-[120px] flex-col items-center p-2"
        >
          <div className="mb-2 w-full px-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t("jumpTo")}
          </div>
          <div className="no-scrollbar w-full overflow-y-auto max-h-48 grid grid-cols-4 gap-1 pb-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 下一页 */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label={t("next")}
      >
        <ChevronRight size={20} />
      </button>

      {/* 跳转到最后一页 */}
      <button
        onClick={() => handlePageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label={t("last")}
      >
        <ChevronsRight size={20} />
      </button>
    </div>
  );
};

export default Pagination;
