"use client";

/**
 * 列表什么时候显示（见 docs/LIBRARY.md 阶段 4「1.」和 src/lib/library/reveal.ts）。
 *
 * 整页加载：内联脚本已经把列表藏起来了（<html> 上的 PENDING_ATTR）。水合时按默认状态渲染，
 * 水合完成、读到地址栏后，按地址栏筛完（ready）就去掉这个属性。
 * 软导航：没有内联脚本，第一次渲染就读到地址栏，筛不出来时由这里返回 true，列表加 invisible。
 *
 * 只管第一次：显示过之后，用户再搜索、筛选时第二档还没到，列表照旧显示上一次的结果，不再藏。
 * 最晚 REVEAL_TIMEOUT_MS 后无论如何都显示：整页加载从打开页面算起（和内联脚本一致），软导航从挂载算起。
 */
import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/ui/useMounted";
import { PENDING_ATTR, REVEAL_TIMEOUT_MS } from "@/lib/library/reveal";

/** 返回列表此刻是否要藏着 */
export function useListReveal(ready: boolean): boolean {
  const isClient = useMounted();
  // 水合时 useMounted 是 false，软导航第一次渲染就是 true
  const [viaHydration] = useState(!isClient);
  const [settled, setSettled] = useState(false);
  const [expired, setExpired] = useState(false);
  // 由上一次渲染的结果推出来的状态，直接在渲染时改（React 文档的写法），不用多渲染一轮
  if (isClient && ready && !settled) setSettled(true);
  const waiting = isClient && !settled && !expired;

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

  return waiting;
}
