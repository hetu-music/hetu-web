"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "music_library_scrollY";

/**
 * 从详情页返回曲库时恢复滚动位置：点进歌曲前记下位置，回来后列表先透明，
 * 数据就绪、滚回原位再显示（X5，阶段 4 重新检查）。
 */
export function useScrollRestore() {
  // 初始值必须与服务端一致，不能在初始化时读 sessionStorage，否则 hydration 不匹配，
  // 而 React 不会修补不匹配的属性，隐藏就不生效。改为挂载后、绘制前再读。
  const [isRestoringScroll, setIsRestoringScroll] = useState(false);

  useLayoutEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRestoringScroll(true);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        setIsRestoringScroll(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  /** 列表数据就绪后调用：有记下的位置就滚回去，再显示列表 */
  const notifyDataReady = useCallback(() => {
    const savedScroll = sessionStorage.getItem(STORAGE_KEY);
    if (!savedScroll) {
      setIsRestoringScroll(false);
      return;
    }

    window.scrollTo(0, parseInt(savedScroll, 10));
    sessionStorage.removeItem(STORAGE_KEY);
    requestAnimationFrame(() => setIsRestoringScroll(false));
  }, []);

  /** 点进歌曲之前调用 */
  const saveScroll = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, window.scrollY.toString());
  }, []);

  /** 点标志回到初始状态时调用：不再恢复 */
  const clearSavedScroll = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return { isRestoringScroll, notifyDataReady, saveScroll, clearSavedScroll };
}
