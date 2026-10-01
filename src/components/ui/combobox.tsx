"use client";

import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import * as React from "react";

/**
 * 可搜索的选择：输入框过滤候选，候选只能从列表里选（自由输入的搜索框用 Autocomplete）。
 * 可以单独弹出（ComboboxPopup），也可以 inline 放进别的浮层里（见首页筛选）。
 */
const Combobox = BaseCombobox.Root;
const ComboboxInput = BaseCombobox.Input;

type WithClassName<T extends React.ElementType> = Omit<
  React.ComponentProps<T>,
  "className"
> & { className?: string };

/** 挂在输入框下方的候选：样式同宽屏下拉 */
function ComboboxPopup({
  className,
  sideOffset = 8,
  ...props
}: WithClassName<typeof BaseCombobox.Popup> & { sideOffset?: number }) {
  const host = useOverlayHost();
  return (
    <BaseCombobox.Portal container={host}>
      <BaseCombobox.Positioner
        align="start"
        sideOffset={sideOffset}
        className="z-60 outline-none"
      >
        <BaseCombobox.Popup
          className={cn(
            "w-(--anchor-width) min-w-56 max-h-[min(22rem,var(--available-height))] overflow-y-auto overscroll-contain",
            "rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] py-1.5 outline-none",
            "transition-[opacity,translate] duration-200 ease-page data-starting-style:opacity-0 data-starting-style:-translate-y-1 data-ending-style:opacity-0 data-ending-style:-translate-y-1",
            className,
          )}
          {...props}
        />
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

function ComboboxList({
  className,
  ...props
}: WithClassName<typeof BaseCombobox.List>) {
  return (
    <BaseCombobox.List className={cn("empty:p-0", className)} {...props} />
  );
}

/** 一行文字；键盘或指针停在上面时铺一层极淡的底 */
function ComboboxItem({
  className,
  ...props
}: WithClassName<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 px-4 py-2 text-sm outline-none transition-colors",
        "text-slate-600 dark:text-slate-300 data-highlighted:text-slate-900 dark:data-highlighted:text-slate-100",
        "data-highlighted:bg-slate-900/3 dark:data-highlighted:bg-white/4",
        className,
      )}
      {...props}
    />
  );
}

/** 没有匹配时的一句楷体灰字（DESIGN.md「空状态与提示」） */
function ComboboxEmpty({
  className,
  ...props
}: WithClassName<typeof BaseCombobox.Empty>) {
  return (
    <BaseCombobox.Empty
      className={cn(
        "px-4 py-2 font-kaiti text-sm text-slate-400 empty:hidden dark:text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup
};

