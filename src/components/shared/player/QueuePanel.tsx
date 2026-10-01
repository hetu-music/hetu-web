"use client";

import PlayingBars from "@/components/shared/PlayingBars";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { cn } from "@/lib/utils/utils";
import { usePlayerStore } from "@/store/player-store";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListMusic, X } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-700 md:size-9 dark:text-slate-500 dark:hover:text-slate-200";

const TEXT_BUTTON =
  "text-xs tracking-widest text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200";

/**
 * 播放条右侧的「队列」按钮与队列面板。
 * 宽屏是按钮上方的下拉，窄屏是底部面板；两者都挂到播放条外
 * （播放条带 transform，会把其中的 fixed 元素困在自己里面）。
 */
export default function QueueControl() {
  const t = useTranslations("common.player");
  const count = usePlayerStore((s) => s.queue.length);
  const playerVisible = usePlayerStore((s) => s.playerVisible);
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);

  // 播放条收起时面板跟着关（播放条此时是 inert，面板也点不到了）
  const [prevVisible, setPrevVisible] = useState(playerVisible);
  if (prevVisible !== playerVisible) {
    setPrevVisible(playerVisible);
    if (!playerVisible) setOpen(false);
  }

  const close = () => setOpen(false);

  const trigger = (
    <button
      type="button"
      aria-label={t("queue", { count })}
      title={t("queue", { count })}
      className={cn(
        ICON_BUTTON,
        open && "text-(--tone) hover:text-(--tone) dark:text-(--tone)",
      )}
    >
      <ListMusic size={18} />
    </button>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={trigger} />
        <PopoverContent
          side="top"
          align="end"
          sideOffset={20}
          className="flex max-h-[26rem] w-[22rem] flex-col p-0"
        >
          <QueueList Title={PopoverTitle} onClose={close} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={trigger} />
      <DrawerContent
        className="max-h-[70vh]"
        contentClassName="flex flex-col overflow-hidden px-0 pb-[env(safe-area-inset-bottom)]"
      >
        <QueueList Title={DrawerTitle} onClose={close} />
      </DrawerContent>
    </Drawer>
  );
}

/** 队列：题头一行，下面是一行行曲目；当前曲只改颜色 */
function QueueList({
  Title,
  onClose,
}: {
  /** 浮层自己的标题组件，读屏据此念出面板的名字 */
  Title: React.ElementType<{ className?: string; children?: React.ReactNode }>;
  onClose: () => void;
}) {
  const t = useTranslations("common.player");
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const jumpTo = usePlayerStore((s) => s.jumpTo);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const [confirmClear, setConfirmClear] = useState(false);
  // 「清空」点一下变成「确认清空」，几秒内不确认就复原
  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  // 打开时把当前曲滚到列表中间。不用 scrollIntoView：窄屏面板正从屏幕外滑入，
  // scrollIntoView 会连带滚动整个页面
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const item = currentRef.current;
    if (!list || !item) return;
    list.scrollTop =
      item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
  }, []);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-5 pb-3">
        {/* 面板的名字只是「播放队列」，曲数放在标题外 */}
        <div className="font-serif text-xs tracking-[0.4em] text-(--tone)">
          <Title className="inline text-xs font-normal">
            {t("queueTitle")}
          </Title>
          <span className="ml-2 font-sans tracking-wider text-slate-400 dark:text-slate-500">
            {t("queueCount", { count: queue.length })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              confirmClear ? clearQueue() : setConfirmClear(true)
            }
            className={cn(
              TEXT_BUTTON,
              confirmClear &&
                "text-rose-500 hover:text-rose-500 dark:text-rose-500 dark:hover:text-rose-500",
            )}
          >
            {confirmClear ? t("confirmClear") : t("clear")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="-mr-1 p-1 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="mx-5 h-px shrink-0 bg-slate-200/70 dark:bg-slate-800" />

      <ol
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
      >
        {queue.map((track, i) => {
          const current = i === currentIndex;
          return (
            <li
              key={track.songId}
              ref={current ? currentRef : undefined}
              className="group flex items-center"
            >
              <button
                type="button"
                onClick={() => jumpTo(i)}
                aria-current={current || undefined}
                className="flex min-w-0 flex-1 items-center gap-4 py-2.5 pl-5 text-left"
              >
                <span className="flex w-5 shrink-0 justify-end">
                  {current && isPlaying ? (
                    <PlayingBars />
                  ) : (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        current
                          ? "text-(--tone)"
                          : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate font-serif text-sm transition-colors",
                      current
                        ? "text-(--tone)"
                        : "text-slate-800 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white",
                    )}
                  >
                    {track.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs tracking-wider text-slate-400 dark:text-slate-500">
                    {track.artist || t("unknownArtist")}
                  </span>
                </span>
              </button>
              {/* 宽屏悬停才出现；窄屏没有悬停，常驻但压低颜色 */}
              <button
                type="button"
                onClick={() => removeFromQueue(i)}
                aria-label={t("remove")}
                title={t("remove")}
                className="mr-3 shrink-0 p-2 text-slate-300 transition-[color,opacity] hover:text-rose-500 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 dark:text-slate-600 dark:hover:text-rose-500"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
