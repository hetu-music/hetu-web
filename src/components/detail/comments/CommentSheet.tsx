"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useComments } from "./CommentsContext";
import SlotPanel from "./SlotPanel";

/**
 * 窄屏的批注面板：从底部拉出，顶部引用所批的原文，
 * 下面是这一处的全部批注与输入框。
 */
export default function CommentSheet() {
  const t = useTranslations("song.folio.comments");
  const { sheetSlot, setSheetSlot, anchorCtx } = useComments();

  // 收起时 sheetSlot 立刻变成 null，面板还在往下滑；留着上一处，滑出去之前内容不消失
  const [slot, setSlot] = useState(sheetSlot);
  if (sheetSlot && sheetSlot !== slot) setSlot(sheetSlot);

  const quote = !slot
    ? null
    : slot.section === "lyrics"
      ? anchorCtx.lines[slot.line]?.text
      : slot.section === "notes"
        ? anchorCtx.paragraphs[slot.paragraph]?.map((l) => l.text).join(" ")
        : null;

  return (
    <Drawer
      open={sheetSlot !== null}
      onOpenChange={(open) => {
        if (!open) setSheetSlot(null);
      }}
    >
      <DrawerContent
        className="max-h-[78vh]"
        contentClassName="flex flex-col overflow-hidden px-0 pb-[env(safe-area-inset-bottom)]"
      >
        {slot && (
          <>
            <div className="flex shrink-0 items-start gap-4 px-6 pt-4 pb-4 border-b border-slate-200/70 dark:border-slate-800/70">
              <div className="min-w-0 flex-1">
                <DrawerTitle className="font-serif text-xs font-normal tracking-[0.4em] text-(--tone)">
                  {t(`slot.${slot.section}`)}
                </DrawerTitle>
                {quote && (
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 line-clamp-2">
                    {quote}
                  </p>
                )}
              </div>
              <DrawerClose
                aria-label={t("close")}
                className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </DrawerClose>
            </div>
            <div className="overflow-y-auto overscroll-contain px-6 py-5">
              <SlotPanel slot={slot} />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
