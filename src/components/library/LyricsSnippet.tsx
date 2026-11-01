"use client";

import type { Snippet } from "@/lib/search/snippet";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import React from "react";

/**
 * 搜歌词命中的那一句（docs/LIBRARY.md 阶段 5）。命中的字用正文色，其余是标签的浅灰：
 * 不换强调色、不加粗、不加底色。一首歌命中多句时后面跟「等 N 处」，句子太长截断时它也露在外面。
 */
export default function LyricsSnippet({
  snippet,
  className,
}: {
  snippet: Snippet;
  className?: string;
}) {
  const t = useTranslations("library.search");
  const { text, ranges, more } = snippet;

  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(
      <span key={start} className="text-slate-700 dark:text-slate-300">
        {text.slice(start, end)}
      </span>,
    );
    pos = end;
  }
  if (pos < text.length) parts.push(text.slice(pos));

  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-1.5 border-l-2 border-slate-200 pl-2 text-[11px] leading-relaxed text-slate-400 dark:border-slate-700 dark:text-slate-500",
        className,
      )}
    >
      <p className="min-w-0 truncate">{parts}</p>
      {more > 0 && (
        <span className="shrink-0">
          {t("moreMatches", { count: more + 1 })}
        </span>
      )}
    </div>
  );
}
