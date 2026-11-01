"use client";

/**
 * 地址栏查询参数的读写（见 docs/LIBRARY.md 阶段 3「5.」）。全站共用：曲库页、个人中心、后台。
 *
 * 读：useSyncExternalStore。服务端快照是空串，水合时按默认状态渲染，和服务端的 HTML 一致；
 * 水合完成后 React 自动换成真实的地址栏再渲染一次。不调用 useSearchParams：
 * 静态预渲染遇到它会整块退回客户端渲染（R1）。
 *
 * 写：先在内存里改、立刻通知订阅者（输入框不卡），再节流写进 history。
 * 同一次 update 里改几个参数只写一次地址栏（X6）；连续改写合成一次，
 * 避开 Safari 对 history.replaceState 调用次数的限制。Next 已把原生 history API
 * 接进它的路由，所以直接用 replaceState / pushState。
 *
 * 软导航时 Next 先渲染新页面，提交时（useInsertionEffect）才改地址栏，而且绕开了我们的订阅：
 * 新页面第一次渲染读到的还是上一页的地址栏。所以快照里带上路径，和路由的路径（usePathname）
 * 对不上就当作还没读到（synced 为 false，参数按空的算）；Next 改完地址栏后再读一遍。
 *
 * 每次请求都在服务端渲染的页面（个人中心、后台）知道这次请求的查询参数，传进 initialSearch：
 * 还没读到地址栏时按它渲染，打开就是对的标签页、页码，不先闪一下默认状态。
 * ISR、静态生成的页面所有参数共用一份 HTML，不知道参数，不传（读 searchParams 会让整页变成动态渲染）。
 */
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

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

/** 当前的查询串：还没写出去的改动优先 */
function currentSearch(): string {
  return pending ?? window.location.search;
}

/** 快照是「路径 + 换行 + 查询串」，路径用来判断地址栏是不是这一页的 */
const SEP = "\n";

function getSnapshot(): string {
  return `${window.location.pathname}${SEP}${currentSearch()}`;
}

/** 服务端和水合时：没有路径，按默认状态（空查询串） */
function getServerSnapshot(): string {
  return "";
}

function decodePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
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
  if (search === currentSearch()) return;
  pending = search;
  pendingPath = window.location.pathname;
  if (mode === "push") pendingMode = "push";
  emit();
  schedule();
}

export interface UrlStateOptions {
  /**
   * 服务端渲染时这次请求的查询串（用 url-params 的 toSearchString 从页面的 searchParams 转）。
   * 服务端、水合时，以及软导航时还没读到地址栏，都按它渲染；读到地址栏以后不再用。
   * 只有每次请求都渲染的页面才传，ISR、静态页面不传。
   */
  initialSearch?: string;
}

export interface UrlUpdateOptions {
  /** 记进浏览历史（返回键能回到改之前），默认 replace */
  history?: HistoryMode;
}

/**
 * 返回当前的查询参数（只读）、改写函数，以及地址栏是否已经读到（synced）。
 * 改写函数收到一份副本，改完一次性写回。参数对象只在查询串变化时换新，可以放进 useMemo 的依赖里。
 * synced 为 false：服务端、水合时，或软导航时 Next 还没改地址栏；这时参数是空的，传了 initialSearch 时按它算。
 */
export function useUrlState(
  options: UrlStateOptions = {},
): readonly [
  URLSearchParams,
  (
    mutate: (draft: URLSearchParams) => void,
    options?: UrlUpdateOptions,
  ) => void,
  boolean,
] {
  // 不在 Next 的路由里（单元测试）时是 null，那就不比路径
  const routerPath = usePathname();
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const sep = snapshot.indexOf(SEP);
  const synced =
    sep !== -1 &&
    (routerPath === null ||
      decodePath(snapshot.slice(0, sep)) === decodePath(routerPath));
  const search = synced
    ? snapshot.slice(sep + SEP.length)
    : (options.initialSearch ?? "");

  // 软导航：Next 在这次提交里改了地址栏，但没有通知我们，提交之后自己再读一遍
  useEffect(() => {
    if (sep !== -1 && !synced) emit();
  });

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const update = useCallback(
    (
      mutate: (draft: URLSearchParams) => void,
      options: UrlUpdateOptions = {},
    ) => {
      const draft = new URLSearchParams(currentSearch());
      mutate(draft);
      const next = draft.toString();
      write(next ? `?${next}` : "", options.history ?? "replace");
    },
    [],
  );
  return [params, update, synced] as const;
}

/** 只供测试：清掉模块里的待写状态 */
export function resetUrlStateForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  pendingMode = "replace";
  lastWrite = 0;
}
