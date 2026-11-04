"use client";

import { cn } from "@/lib/utils/utils";
import type { CommentSlot } from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import { useComments } from "./CommentsContext";

/**
 * 宽屏：悬停在句子、段落或乐谱上时，在左侧浮出「批」，点开在左栏就地写批注。
 * 父元素须带 group/slot 并相对定位；className 给出与正文首行等高的高度，让「批」与首行对齐。
 */
export default function AnnotateHandle({
  slot,
  label,
  className,
}: {
  slot: CommentSlot;
  /** 无障碍名称，说明批的是哪一类（这一句、这一段、乐谱） */
  label: string;
  className?: string;
}) {
  const t = useTranslations("song.folio.comments");
  const { annotate } = useComments();
  return (
    <span
      className={cn(
        "absolute -left-12 top-0 hidden lg:flex items-center",
        className,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          annotate(slot);
        }}
        aria-label={label}
        className="font-kaiti text-sm text-(--tone) opacity-0 group-hover/slot:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity"
      >
        {t("add")}
      </button>
    </span>
  );
}
