"use client";

/**
 * 地址栏查询参数的读写（见 docs/LIBRARY.md 阶段 3「5.」），取代 nuqs。
 *
 * 读：useSyncExternalStore。服务端快照是空串，水合时按默认状态渲染，和服务端的 HTML 一致；
 * 水合完成后 React 自动换成真实的地址栏再渲染一次。不调用 useSearchParams：
 * 静态预渲染遇到它会整块退回客户端渲染（R1）。
 *
 * 写：先在内存里改、立刻通知订阅者（输入框不卡），再节流写进 history。
 * 同一次 update 里改几个参数只写一次地址栏（X6）；连续改写合成一次，
 * 避开 Safari 对 history.replaceState 调用次数的限制。Next 已把原生 history API
 * 接进它的路由，所以直接用 replaceState / pushState。
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** 两次写入地址栏之间至少隔这么久 */
export const URL_WRITE_INTERVAL_MS = 50;

type HistoryMode = "replace" | "push";

/** 还没写进 history 的查询串（带「?」或为空串）；null 表示没有待写的 */
let pending: string | null = null;
/** 待写的改动是在哪个路径上发生的：跳到别的页面后不能再写回来 */
let pendingPath = "";
let pendingMode: HistoryMode = "replace";
let timer: ReturnType<typeof setTimeout> | null = null;
let lastWrite = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onPopState() {
  // 返回、前进：以地址栏为准，丢掉还没写出去的改动
  pending = null;
  if (timer) clearTimeout(timer);
  timer = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("popstate", onPopState);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("popstate", onPopState);
    }
  };
}

function getSnapshot(): string {
  return pending ?? window.location.search;
}

function getServerSnapshot(): string {
  return "";
}

/** 立刻把待写的改动写进 history。跳转页面前调用，返回时地址栏才是最新的 */
export function flushUrlState(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending === null) return;
  const search = pending;
  const mode = pendingMode;
  pending = null;
  pendingMode = "replace";
  if (window.location.pathname !== pendingPath) return;
  const url = `${window.location.pathname}${search}${window.location.hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  lastWrite = Date.now();
}

function schedule() {
  if (timer) return;
  const wait = Math.max(0, lastWrite + URL_WRITE_INTERVAL_MS - Date.now());
  timer = setTimeout(flushUrlState, wait);
}

function write(search: string, mode: HistoryMode) {
  if (search === getSnapshot()) return;
  pending = search;
  pendingPath = window.location.pathname;
  if (mode === "push") pendingMode = "push";
  emit();
  schedule();
}

export interface UrlUpdateOptions {
  /** 记进浏览历史（返回键能回到改之前），默认 replace */
  history?: HistoryMode;
}

/**
 * 返回当前的查询参数（只读）和改写函数。改写函数收到一份副本，改完一次性写回。
 * 参数对象只在查询串变化时换新，可以放进 useMemo 的依赖里。
 */
export function useUrlState(): readonly [
  URLSearchParams,
  (
    mutate: (draft: URLSearchParams) => void,
    options?: UrlUpdateOptions,
  ) => void,
] {
  const search = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const update = useCallback(
    (
      mutate: (draft: URLSearchParams) => void,
      options: UrlUpdateOptions = {},
    ) => {
      const draft = new URLSearchParams(getSnapshot());
      mutate(draft);
      const next = draft.toString();
      write(next ? `?${next}` : "", options.history ?? "replace");
    },
    [],
  );
  return [params, update] as const;
}

/** 只供测试：清掉模块里的待写状态 */
export function resetUrlStateForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  pendingMode = "replace";
  lastWrite = 0;
}
