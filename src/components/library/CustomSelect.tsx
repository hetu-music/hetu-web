"use client";

import React, { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils/utils";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  /** 字段名，窄屏底部面板的标题 */
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder,
  className = "",
  disabled = false,
}) => {
  const t = useTranslations("library.filter");
  const isDesktop = useIsDesktop();
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  // Snapshot of sorted options taken at open time — doesn't re-sort while dropdown is open
  const [stableOptions, setStableOptions] = useState<Option[]>([...options]);

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    if (next) {
      setSearchValue("");
      // Sort selected to the top, then freeze order until the next open
      setStableOptions(
        [...options].sort((a, b) => {
          const aSelected = value.includes(a.value);
          const bSelected = value.includes(b.value);
          if (aSelected === bSelected) return 0;
          return aSelected ? -1 : 1;
        }),
      );
    } else {
      setSearchValue("");
    }
    setOpen(next);
  };

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
  };

  const filteredOptions = useMemo(() => {
    const s = searchValue.trim().toLowerCase();
    if (!s) return stableOptions;
    return stableOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s),
    );
  }, [stableOptions, searchValue]);

  const targetOptions = searchValue.trim() ? filteredOptions : options;
  const isAllSelected =
    targetOptions.length > 0 &&
    targetOptions.every((opt) => value.includes(opt.value));
  const isIndeterminate =
    !isAllSelected && targetOptions.some((opt) => value.includes(opt.value));

  const toggleSelectAll = () => {
    if (targetOptions.length === 0) return;
    if (isAllSelected) {
      const targetSet = new Set(targetOptions.map((o) => o.value));
      onChange(value.filter((v) => !targetSet.has(v)));
    } else {
      const newValues = new Set([
        ...value,
        ...targetOptions.map((o) => o.value),
      ]);
      onChange(Array.from(newValues));
    }
  };

  let displayText: string;
  if (value.length === 0) {
    displayText = placeholder ?? "";
  } else if (value.length === options.length && options.length > 1) {
    displayText = t("allSelected");
  } else if (value.length === 1) {
    displayText = options.find((o) => o.value === value[0])?.label ?? value[0];
  } else {
    displayText = t("selectedCount", { count: value.length });
  }

  const hasSelection = value.length > 0;
  const selectedInView = searchValue.trim()
    ? targetOptions.filter((o) => value.includes(o.value)).length
    : value.length;
  const selectedItemClass =
    "text-(--tone) data-[selected=true]:text-(--tone) dark:text-(--tone) dark:data-[selected=true]:text-(--tone)";

  // 宽屏下拉与窄屏底部面板共用的列表：搜索、全选、选项、清除
  const panel = (
    <Command
      className="min-h-0 flex-1"
      filter={(itemValue, search) => {
        if (!search) return 1;
        const s = search.toLowerCase();
        if (itemValue === "__select_all__") {
          return stableOptions.some(
            (o) =>
              o.value.toLowerCase().includes(s) ||
              o.label.toLowerCase().includes(s),
          )
            ? 1
            : 0;
        }
        const option = stableOptions.find((o) => o.value === itemValue);
        if (option) {
          return option.value.toLowerCase().includes(s) ||
            option.label.toLowerCase().includes(s)
            ? 1
            : 0;
        }
        return itemValue.toLowerCase().includes(s) ? 1 : 0;
      }}
    >
      <CommandInput
        placeholder={t("search")}
        value={searchValue}
        onValueChange={setSearchValue}
      />
      {/* flex-1 min-h-0 撑满剩余高度；max-h-none 去掉 command.tsx 的固定上限 */}
      <CommandList id={contentId} className="min-h-0 max-h-none flex-1">
        <CommandEmpty>{t("noMatch")}</CommandEmpty>
        <CommandGroup>
          {targetOptions.length > 0 && (
            // 全选只是一行小字，右边是已选计数；选没选只看颜色，不画复选框。
            // cmdk 默认高亮第一项，这一行不铺底，免得一打开就有一道灰条
            <CommandItem
              key="__select_all__"
              value="__select_all__"
              onSelect={toggleSelectAll}
              className={cn(
                "text-xs tracking-widest text-slate-400 data-[selected=true]:bg-transparent dark:text-slate-500 dark:data-[selected=true]:bg-transparent",
                (isAllSelected || isIndeterminate) && selectedItemClass,
              )}
            >
              <span className="truncate">{t("selectAll")}</span>
              <span className="ml-auto tabular-nums">
                {selectedInView}/{targetOptions.length}
              </span>
            </CommandItem>
          )}
          {stableOptions.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => toggleOption(option.value)}
                className={cn(isSelected && selectedItemClass)}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <Check
                  size={14}
                  strokeWidth={2.25}
                  aria-hidden
                  className={cn("shrink-0", !isSelected && "invisible")}
                />
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      {hasSelection && (
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setOpen(false);
          }}
          className="h-10 shrink-0 border-t border-slate-200/70 text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 dark:border-slate-800 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {t("clearAll")}
        </button>
      )}
    </Command>
  );

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls={contentId}
      disabled={disabled}
      onClick={isDesktop ? undefined : () => handleOpenChange(!open)}
      // 与站内输入框一致：只有一道底线，展开或悬停时换成强调色
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2",
        "border-0 border-b border-slate-300 bg-transparent px-0 dark:border-slate-700",
        "text-sm text-slate-600 dark:text-slate-300",
        "transition-colors duration-200 hover:border-(--tone) focus:outline-none focus-visible:border-(--tone)",
        open && "border-(--tone)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "flex-1 truncate text-left",
          hasSelection
            ? "text-slate-800 dark:text-slate-100"
            : "text-slate-400 dark:text-slate-500",
        )}
      >
        {displayText}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {hasSelection && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t("clearAll")}
            onClick={clearAll}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                clearAll(e as unknown as React.MouseEvent);
            }}
            className="flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "text-slate-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </span>
    </button>
  );

  // 窄屏：底部面板（DESIGN.md 浮层一节）。筛选栏吸顶且带 backdrop-filter，
  // 会把里面的 fixed 元素困住，所以挂到 body 上
  if (!isDesktop) {
    return (
      <>
        {trigger}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {open && (
                <div className="md:hidden">
                  <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleOpenChange(false)}
                    className="fixed inset-0 z-60 bg-slate-950/30 backdrop-blur-[2px]"
                  />
                  <motion.div
                    key="sheet"
                    role="dialog"
                    aria-label={label}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="fixed inset-x-0 bottom-0 z-60 flex max-h-[75vh] flex-col rounded-t-2xl bg-[#FAFAFA] pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] dark:bg-[#0B0F19]"
                  >
                    <div className="flex shrink-0 items-center justify-between px-4 pt-5 pb-2">
                      <p className="font-serif text-xs tracking-[0.4em] text-(--tone)">
                        {label}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenChange(false)}
                        aria-label={t("close")}
                        className="-mr-1 p-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {panel}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/*
        max-height 取 Radix 的 --radix-popover-content-available-height，
        即当前方向（上或下）实际剩下的视口空间
      */}
      <PopoverContent
        className="flex flex-col overflow-hidden p-0"
        collisionPadding={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{
          width: "var(--radix-popover-trigger-width)",
          minWidth: "180px",
          maxHeight:
            "min(420px, calc(var(--radix-popover-content-available-height) - 8px))",
        }}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
};

export default CustomSelect;
