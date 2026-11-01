"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 输入控件的草稿：界面上立刻变，停下 wait 毫秒后才提交（比如写进地址栏）。
 *
 * 外面的值变了（返回键、点了「重置」、水合后换成真实的地址栏）就以外面的为准，
 * 并取消还没提交的草稿。防抖放在输入这一端，而不是结果那一端：结果直接跟着
 * 外面的值走，带参数打开链接时第一次渲染就是筛好的结果，不用等防抖。
 */
export function useDebouncedDraft<T>(
  value: T,
  commit: (next: T) => void,
  wait: number,
  equals: (a: T, b: T) => boolean = Object.is,
) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外面的值变了：渲染时就换上，不等 effect，免得闪一下旧草稿
  if (!equals(value, synced)) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    // 外面的值变了，还没提交的草稿作废
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** immediate：不等防抖立刻提交，比如清空搜索框、滑轨回到两端 */
  const update = useCallback(
    (next: T, immediate = false) => {
      setDraft(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (immediate) {
        commit(next);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        commit(next);
      }, wait);
    },
    [commit, wait],
  );

  return [draft, update] as const;
}
