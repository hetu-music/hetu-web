"use client";

import { cn } from "@/lib/utils/utils";
import { type CommentSlot, countThreads } from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import { useComments } from "./CommentsContext";

/** 窄屏：有批注的句子或段落，末尾挂一个主题色的小数字，点开底部面板 */
export default function SlotMarker({
  slot,
  className,
}: {
  slot: CommentSlot;
  className?: string;
}) {
  const t = useTranslations("song.folio.comments");
  const { threads, setSheetSlot } = useComments();
  const count = countThreads(threads.get(slot.key));
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setSheetSlot(slot);
      }}
      aria-label={t("markerLabel", { count })}
      className={cn(
        "lg:hidden relative -top-[0.6em] ml-1 px-0.5 font-sans text-[11px] leading-none tabular-nums text-(--tone)",
        className,
      )}
    >
      {count}
    </button>
  );
}
