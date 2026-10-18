"use client";

import { addToast, type ToastType } from "@/components/ui/toast";

export interface ToastMessage {
  type: ToastType;
  text: string;
}

/**
 * 后台的操作结果提示。原先每个板块各写一份 state + setTimeout，时长也不一；
 * 现在统一交给 ui/toast（Base UI Toast），任何 hook 里都能直接调用。
 */
export function notify(message: ToastMessage) {
  addToast(message.type, message.text);
}

export const notifyError = (error: unknown, fallback = "操作失败") =>
  addToast("error", error instanceof Error ? error.message : fallback);

/** 给沿用 (type, text) 签名的旧 hook 用；模块级常量，放进 effect 依赖也不会反复触发 */
export const showToast = (type: ToastType, text: string) =>
  addToast(type, text);
