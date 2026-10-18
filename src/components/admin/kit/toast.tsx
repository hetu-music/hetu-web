"use client";

import { create } from "zustand";
import { cn } from "@/lib/utils/utils";

export interface ToastMessage {
  type: "success" | "error";
  text: string;
}

const DURATION_MS = { success: 3000, error: 5000 } as const;

interface ToastState {
  message: (ToastMessage & { id: number }) | null;
}

const useToastStore = create<ToastState>(() => ({ message: null }));

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * 后台的操作结果提示。原先每个板块各写一份 state + setTimeout，时长也不一；
 * 这里收成一个全局的提示条，任何 hook 里都能直接调用，由 AdminShell 统一渲染。
 * 出错留得久一点，来得及看清。
 */
export function notify(message: ToastMessage) {
  const id = ++seq;
  useToastStore.setState({ message: { ...message, id } });
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (useToastStore.getState().message?.id === id) {
      useToastStore.setState({ message: null });
    }
  }, DURATION_MS[message.type]);
}

export const notifySuccess = (text: string) =>
  notify({ type: "success", text });

export const notifyError = (error: unknown, fallback = "操作失败") =>
  notify({
    type: "error",
    text: error instanceof Error ? error.message : fallback,
  });

/** 底部居中的提示条：页面底色加细框，出错只把字换成 rose，不铺彩色底 */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;

  return (
    <div
      key={message.id}
      role={message.type === "error" ? "alert" : "status"}
      className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 z-70 max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div
        className={cn(
          "rounded-full border border-slate-200/70 bg-[#FAFAFA]/95 px-5 py-2 text-sm shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-[#0B0F19]/95",
          message.type === "error"
            ? "text-rose-600 dark:text-rose-400"
            : "text-slate-700 dark:text-slate-200",
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

/** 给沿用 (type, text) 签名的旧 hook 用；模块级常量，放进 effect 依赖也不会反复触发 */
export const showToast = (type: ToastMessage["type"], text: string) =>
  notify({ type, text });
