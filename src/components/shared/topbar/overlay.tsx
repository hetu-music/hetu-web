"use client";

import { OverlayHostContext } from "@/components/ui/overlay-host";
import { useMounted } from "@/hooks/ui";
import { cn } from "@/lib/utils/utils";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useContext, useEffect } from "react";
import { createPortal } from "react-dom";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * 浮层在点到范围之外或按 Esc 时收起。范围用 data-dismiss-scope 标记，
 * 挂到别处的底部面板也带上同一个标记，点面板里面就不会误收。
 */
export function useDismiss(open: boolean, onClose: () => void, scope: string) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest?.(`[data-dismiss-scope="${scope}"]`)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, scope]);
}

/**
 * 底部面板挂载的位置。顶栏的 backdrop-filter 会把其中的 fixed 元素困住，
 * 所以面板要挂到顶栏外；又不能直接挂到 body 上，否则拿不到页面根容器上的
 * 封面取色 --tone。TopBar 在自己旁边放一个挂载点，经由这里传下去。
 */
export const SheetHostContext = OverlayHostContext;

/** 宽屏下拉：页面底色、细描边、柔和投影；窄屏一律改用底部面板 */
export function MenuPanel({
  open,
  align = "left",
  className,
  children,
}: {
  open: boolean;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: EASE }}
          className={cn(
            "hidden md:block absolute z-10 top-full mt-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] px-4 py-2",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 窄屏的底部面板：题头一行小字，右侧收起 */
export function BottomSheet({
  open,
  onClose,
  title,
  scope,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 与触发按钮所在范围相同的 data-dismiss-scope */
  scope: string;
  children: React.ReactNode;
}) {
  const host = useContext(SheetHostContext);
  const mounted = useMounted();
  const tNav = useTranslations("common.nav");
  if (!mounted) return null;

  const sheet = (
    <AnimatePresence>
      {open && (
        <div data-dismiss-scope={scope} className="md:hidden">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-60 bg-slate-950/30 backdrop-blur-[2px]"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-60 rounded-t-2xl bg-[#FAFAFA] dark:bg-[#0B0F19] shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.35)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <p className="font-serif text-xs tracking-[0.4em] text-(--tone)">
                {title}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label={tNav("close")}
                className="p-1 -mr-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(sheet, host ?? document.body);
}

export interface MenuItem {
  id: string;
  label: string;
}

/** 竖排的选项列表（目录、板块、主题、文字）：当前项只变色，左侧一道强调色短线 */
export function MenuList({
  items,
  active,
  onSelect,
  size,
}: {
  items: readonly MenuItem[];
  active: string | undefined;
  onSelect: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  size: "sm" | "lg";
}) {
  return (
    <ol>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={(e) => onSelect(item.id, e)}
              aria-current={current ? "true" : undefined}
              className={cn(
                "relative w-full pl-4 text-left font-serif tracking-wider whitespace-nowrap transition-colors",
                size === "sm" ? "py-2 text-sm" : "py-3 text-base",
                current
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-full bg-(--tone) transition-opacity",
                  current ? "opacity-100" : "opacity-0",
                )}
              />
              {item.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 一行里用「·」隔开的文字选项，底部面板里的主题与文字用 */
export function InlineOptions({
  items,
  active,
  onSelect,
  disabled,
}: {
  items: readonly MenuItem[];
  active: string | undefined;
  onSelect: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {items.map((item, i) => {
        const current = item.id === active;
        return (
          <React.Fragment key={item.id}>
            {i > 0 && (
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
            )}
            <button
              type="button"
              onClick={(e) => onSelect(item.id, e)}
              aria-pressed={current}
              disabled={disabled}
              className={cn(
                "py-2 text-sm tracking-widest transition-colors disabled:opacity-40 disabled:cursor-wait",
                current
                  ? "text-(--tone)"
                  : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200",
              )}
            >
              {item.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
