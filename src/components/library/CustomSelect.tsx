"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
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

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  selectAllLabel?: string;
  allSelectedLabel?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "请选择",
  className = "",
  disabled = false,
  selectAllLabel = "全选",
  allSelectedLabel = "全部已选",
}) => {
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
    displayText = placeholder;
  } else if (value.length === options.length && options.length > 1) {
    displayText = allSelectedLabel;
  } else if (value.length === 1) {
    displayText = options.find((o) => o.value === value[0])?.label ?? value[0];
  } else {
    displayText = `${value.length} 项已选`;
  }

  const hasSelection = value.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={contentId}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg",
            "border border-slate-200 dark:border-slate-800",
            "bg-white dark:bg-slate-900",
            "px-3 text-sm",
            "text-slate-600 dark:text-slate-300",
            "transition-all duration-200",
            "hover:border-(--tone)/60 hover:bg-(--tone)/10",
            "focus:outline-none",
            open && "border-(--tone)/60",
            hasSelection && !open && "border-(--tone)/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "flex-1 truncate text-left",
              !hasSelection && "text-slate-400 dark:text-slate-500",
              hasSelection && "font-medium text-slate-700 dark:text-slate-200",
            )}
          >
            {displayText}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {hasSelection && (
              <span
                role="button"
                tabIndex={0}
                aria-label="清除筛选"
                onClick={clearAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    clearAll(e as unknown as React.MouseEvent);
                }}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <X size={10} />
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "text-slate-400 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </div>
        </button>
      </PopoverTrigger>

      {/*
        max-height uses Radix's --radix-popover-content-available-height variable,
        which reflects the actual remaining viewport space in the current placement
        direction (above or below the trigger). This adapts automatically.
      */}
      <PopoverContent
        className="p-0 flex flex-col overflow-hidden"
        collisionPadding={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{
          width: "var(--radix-popover-trigger-width)",
          minWidth: "160px",
          maxHeight:
            "calc(var(--radix-popover-content-available-height) - 8px)",
        }}
      >
        <Command
          className="flex-1 min-h-0"
          filter={(itemValue, search) => {
            if (!search) return 1;
            if (itemValue === "__select_all__") {
              const s = search.toLowerCase();
              return stableOptions.some(
                (o) =>
                  o.value.toLowerCase().includes(s) ||
                  o.label.toLowerCase().includes(s),
              )
                ? 1
                : 0;
            }
            const s = search.toLowerCase();
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
            placeholder="搜索…"
            value={searchValue}
            onValueChange={setSearchValue}
          />
          {/* flex-1 min-h-0 fills remaining height; max-h-none removes the fixed cap from command.tsx */}
          <CommandList id={contentId} className="flex-1 min-h-0 max-h-none">
            <CommandEmpty>无匹配结果</CommandEmpty>
            <CommandGroup>
              {targetOptions.length > 0 && (
                <CommandItem
                  key="__select_all__"
                  value="__select_all__"
                  onSelect={toggleSelectAll}
                  className={cn(
                    "flex items-center gap-2 font-medium cursor-pointer border-b border-slate-100 dark:border-slate-800 mb-1 pb-2 rounded-b-none",
                    isAllSelected && "bg-(--tone)/10 text-(--tone)",
                    isIndeterminate && "text-(--tone) font-medium",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      isAllSelected || isIndeterminate
                        ? "border-(--tone)/60 bg-(--tone) text-white dark:text-slate-900"
                        : "border-slate-300 dark:border-slate-600 bg-transparent",
                    )}
                  >
                    {isAllSelected && <Check size={10} strokeWidth={3} />}
                    {isIndeterminate && <Minus size={10} strokeWidth={3} />}
                  </div>
                  <span className="truncate">{selectAllLabel}</span>
                  <span className="ml-auto text-xs text-slate-400 font-normal">
                    {searchValue.trim()
                      ? `${targetOptions.filter((o) => value.includes(o.value)).length}/${targetOptions.length}`
                      : `${value.length}/${options.length}`}
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
                    className={cn(
                      isSelected && "bg-(--tone)/10 text-(--tone) font-medium",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isSelected
                          ? "border-(--tone)/60 bg-(--tone) text-white dark:text-slate-900"
                          : "border-slate-300 dark:border-slate-600 bg-transparent",
                      )}
                    >
                      {isSelected && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {hasSelection && (
            <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-center"
              >
                清除筛选
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CustomSelect;
