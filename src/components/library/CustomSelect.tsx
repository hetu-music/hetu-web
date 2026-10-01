"use client";

import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { cn } from "@/lib/utils/utils";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  /** 字段名，窄屏底部面板的标题，也是搜索框的无障碍名称 */
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const matches = (option: Option, query: string) =>
  option.label.toLowerCase().includes(query) ||
  option.value.toLowerCase().includes(query);

/**
 * 多选筛选：宽屏在下方展开，窄屏从底部拉出。
 * 里面是同一份 Combobox（inline 模式）：搜索、全选、选项、清除。
 */
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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  // 打开时把已选的排到前面，之后顺序冻结，勾选时列表不跳
  const [stableOptions, setStableOptions] = useState<Option[]>([...options]);

  const handleOpenChange = (next: boolean) => {
    if (disabled && next) return;
    if (next) {
      setStableOptions(
        [...options].sort((a, b) => {
          const aSelected = value.includes(a.value);
          const bSelected = value.includes(b.value);
          if (aSelected === bSelected) return 0;
          return aSelected ? -1 : 1;
        }),
      );
    }
    setSearchValue("");
    setOpen(next);
  };

  const labelOf = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (v: string) => map.get(v) ?? v;
  }, [options]);

  const query = searchValue.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      query ? stableOptions.filter((o) => matches(o, query)) : stableOptions,
    [stableOptions, query],
  );

  const targetOptions = query ? filteredOptions : options;
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
      onChange(
        Array.from(new Set([...value, ...targetOptions.map((o) => o.value)])),
      );
    }
  };

  const clearAll = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
  };

  let displayText: string;
  if (value.length === 0) {
    displayText = placeholder ?? "";
  } else if (value.length === options.length && options.length > 1) {
    displayText = t("allSelected");
  } else if (value.length === 1) {
    displayText = labelOf(value[0]);
  } else {
    displayText = t("selectedCount", { count: value.length });
  }

  const hasSelection = value.length > 0;
  const selectedInView = query
    ? targetOptions.filter((o) => value.includes(o.value)).length
    : value.length;

  // 宽屏下拉与窄屏底部面板共用的列表：搜索、全选、选项、清除
  const panel = (
    <Combobox
      inline
      open={open}
      onOpenChange={handleOpenChange}
      multiple
      items={options.map((o) => o.value)}
      filteredItems={filteredOptions.map((o) => o.value)}
      itemToStringLabel={labelOf}
      value={value}
      onValueChange={(next) => onChange(next as string[])}
      inputValue={searchValue}
      onInputValueChange={(next, details) => {
        // 勾选一项不清空搜索，方便在同一批结果里连着选
        if (details.isItemPress) return;
        setSearchValue(next);
      }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200/70 px-4 dark:border-slate-800">
        <Search className="shrink-0 text-slate-400" size={14} />
        <ComboboxInput
          placeholder={t("search")}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300 dark:placeholder:text-slate-500"
        />
      </div>

      {targetOptions.length > 0 && (
        // 全选只是一行小字，右边是已选计数；选没选只看颜色，不画复选框
        <button
          type="button"
          onClick={toggleSelectAll}
          aria-pressed={
            isAllSelected ? true : isIndeterminate ? "mixed" : false
          }
          className={cn(
            "flex shrink-0 items-center px-4 pt-3 pb-1 text-xs tracking-widest transition-colors",
            isAllSelected || isIndeterminate
              ? "text-(--tone)"
              : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
          )}
        >
          <span className="truncate">{t("selectAll")}</span>
          <span className="ml-auto tabular-nums">
            {selectedInView}/{targetOptions.length}
          </span>
        </button>
      )}

      <ComboboxEmpty className="py-8 text-center">{t("noMatch")}</ComboboxEmpty>
      <ComboboxList className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        {(optionValue: string) => {
          const isSelected = value.includes(optionValue);
          return (
            <ComboboxItem
              key={optionValue}
              value={optionValue}
              // 选中的只变颜色，停在上面也不变回灰
              className={cn(
                isSelected &&
                "text-(--tone) data-highlighted:text-(--tone) dark:text-(--tone) dark:data-highlighted:text-(--tone)",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                {labelOf(optionValue)}
              </span>
              <Check
                size={14}
                strokeWidth={2.25}
                aria-hidden
                className={cn("shrink-0", !isSelected && "invisible")}
              />
            </ComboboxItem>
          );
        }}
      </ComboboxList>

      {hasSelection && (
        <button
          type="button"
          onClick={() => {
            onChange([]);
            handleOpenChange(false);
          }}
          className="h-10 shrink-0 border-t border-slate-200/70 text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 dark:border-slate-800 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {t("clearAll")}
        </button>
      )}
    </Combobox>
  );

  const trigger = (
    <button
      type="button"
      disabled={disabled}
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
          // 清除就地生效，不能顺带把面板打开
          <span
            role="button"
            tabIndex={0}
            aria-label={t("clearAll")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={clearAll}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") clearAll(e);
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

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger render={trigger} />
        <DrawerContent
          title={label}
          className="max-h-[75vh]"
          contentClassName="flex flex-col overflow-hidden px-0 pb-[env(safe-area-inset-bottom)]"
          // 不自动聚焦搜索框，免得一打开就弹出键盘
          initialFocus={false}
        >
          {panel}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} />
      {/* 与触发框同宽；高度不超过当前方向实际剩下的视口空间 */}
      <PopoverContent
        sideOffset={6}
        initialFocus={false}
        className="flex w-(--anchor-width) min-w-45 max-h-[min(420px,calc(var(--available-height)-8px))] flex-col overflow-hidden p-0"
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
};

export default CustomSelect;
