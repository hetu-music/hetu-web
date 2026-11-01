"use client";

/**
 * 列表什么时候显示（见 docs/LIBRARY.md 阶段 4「1.」和 src/lib/library/reveal.ts）。
 * 两种情况都要先藏着，由这一个 hook 管：
 *
 * 1. 等筛完。整页加载：内联脚本已经把列表藏起来了（<html> 上的 PENDING_ATTR），水合时按默认状态渲染，
 *    水合完成、读到地址栏并按它筛完（ready）后去掉这个属性。软导航：没有内联脚本，
 *    第一次渲染就读到地址栏，筛不出来时由这里藏。只管第一次：显示过之后，用户再搜索、筛选时
 *    第二档还没到，列表照旧显示上一次的结果，不再藏。最晚 REVEAL_TIMEOUT_MS 后无论如何都显示：
 *    整页加载从打开页面算起（和内联脚本一致），软导航从挂载算起。
 *
 * 2. 从详情页返回时恢复滚动位置（X5）。点进歌曲前记下位置；回来后等筛完（滚回去的位置要按
 *    筛完的列表算），滚回原位，下一帧再显示，不让人看到先在顶上、再跳下去。
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useMounted } from "@/hooks/ui/useMounted";
import { PENDING_ATTR, REVEAL_TIMEOUT_MS } from "@/lib/library/reveal";

const SCROLL_KEY = "music_library_scrollY";

const hasSavedScroll = () => sessionStorage.getItem(SCROLL_KEY) !== null;

export function useListReveal(ready: boolean) {
  const isClient = useMounted();
  // 水合时 useMounted 是 false，软导航第一次渲染就是 true
  const [viaHydration] = useState(!isClient);
  const [settled, setSettled] = useState(false);
  const [expired, setExpired] = useState(false);
  // 初始值必须和服务端一致，不能在初始化时读 sessionStorage；挂载后、绘制前再读
  const [restoring, setRestoring] = useState(false);

  // 由上一次渲染的结果推出来的状态，直接在渲染时改（React 文档的写法），不用多渲染一轮
  if (isClient && ready && !settled) setSettled(true);
  const waiting = isClient && !settled && !expired;

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasSavedScroll()) setRestoring(true);
  }, []);

  // 返回键回到还挂着的曲库页、从浏览器的往返缓存恢复：有记下的位置也要滚回去
  useEffect(() => {
    const check = () => {
      if (hasSavedScroll()) setRestoring(true);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check();
    };
    window.addEventListener("popstate", check);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("popstate", check);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!isClient || settled) return;
    const wait = viaHydration
      ? Math.max(0, REVEAL_TIMEOUT_MS - performance.now())
      : REVEAL_TIMEOUT_MS;
    const timer = setTimeout(() => setExpired(true), wait);
    return () => clearTimeout(timer);
  }, [isClient, settled, viaHydration]);

  useEffect(() => {
    if (isClient && !waiting) {
      document.documentElement.removeAttribute(PENDING_ATTR);
    }
  }, [isClient, waiting]);

  // 筛完了才滚回去，滚完立刻显示：scrollTo 是同步的，下一次绘制时列表已经在原位。
  // 不用等帧：返回、前进时 Next 不滚动（restore-reducer 不带滚动意图）；正向导航时它滚到顶，
  // 但那在 layout effect 里（layout-router 的 InnerScrollHandler），总在这个 passive effect 之前
  useEffect(() => {
    if (!restoring || waiting) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
    if (saved) window.scrollTo(0, parseInt(saved, 10));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestoring(false);
  }, [restoring, waiting]);

  /** 点进歌曲之前调用 */
  const saveScroll = useCallback(() => {
    sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  }, []);

  /** 点标志回到初始状态时调用：不再恢复 */
  const clearSavedScroll = useCallback(() => {
    sessionStorage.removeItem(SCROLL_KEY);
    setRestoring(false);
  }, []);

  return {
    /** 列表此刻要不要藏着 */
    hidden: waiting || restoring,
    /**
     * 正在滚回原位：卡片先不播进场动画，显示时才播。等筛完时不停：那段时间默认列表的动画
     * 照常播完，显示的是筛完后新挂上的卡片，自己会播（docs/LIBRARY.md 阶段 4 验收）
     */
    restoring,
    saveScroll,
    clearSavedScroll,
  };
}
