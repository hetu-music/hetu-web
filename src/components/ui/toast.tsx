"use client";

import { Toast as BaseToast } from "@base-ui/react/toast";
import { useOverlayHost } from "@/components/ui/overlay-host";
import { cn } from "@/lib/utils/utils";

/**
 * 全站共用一个提示管理器：在组件外（hook 的回调、请求失败的 catch）也能直接 add。
 * 计时、悬停暂停、读屏播报、F6 跳进提示区、滑动收起都由 Base UI 处理。
 */
export const toastManager = BaseToast.createToastManager();

export type ToastType = "success" | "error";

/** 发一条提示；出错留得久一点，来得及看清 */
export function addToast(type: ToastType, text: string) {
  toastManager.add({
    title: text,
    type,
    timeout: type === "error" ? 5000 : 3000,
    priority: type === "error" ? "high" : "low",
  });
}

/**
 * 提示条：底部居中，页面底色加细框，出错只把字换成 rose，不铺彩色底。
 * 最多叠三条，新的在下面。层级 70，压在弹窗上面（DESIGN.md 第九节）。
 */
export function ToastViewport() {
  const host = useOverlayHost();
  return (
    <BaseToast.Provider toastManager={toastManager}>
      <BaseToast.Portal container={host}>
        <BaseToast.Viewport className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 z-70 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 outline-none">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => (
    <BaseToast.Root
      key={toast.id}
      toast={toast}
      swipeDirection="down"
      className={cn(
        "rounded-full border border-slate-200/70 bg-[#FAFAFA]/95 px-5 py-2 text-sm shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-[#0B0F19]/95",
        "transform-[translateY(var(--toast-swipe-movement-y))] transition-[opacity,transform] duration-300 ease-page",
        "data-starting-style:transform-[translateY(0.5rem)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-limited:hidden",
        toast.type === "error"
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-700 dark:text-slate-200",
      )}
    >
      <BaseToast.Content>
        <BaseToast.Title className="font-sans text-sm font-normal" />
      </BaseToast.Content>
    </BaseToast.Root>
  ));
}
