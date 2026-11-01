"use client";

import { useCallback, useEffect, useState } from "react";

/** 最多等这么久：封面迟迟不到（网太慢、加载失败）也不能一直用系统字体 */
const MAX_WAIT_MS = 4000;

/**
 * 曲库页的思源宋体、黑体等首屏封面到了再加载（docs/LIBRARY.md T1）。
 *
 * deferred 为 true 时，根容器加上 cjk-deferred，先用系统字体；
 * 首屏那张优先加载的封面加载完（或失败）时调用 release，换上思源。
 * 没有封面可等时（列表视图、没有结果），页面加载完就换。
 * 一旦换上就不再改回，翻页、筛选都不影响。
 */
export function useDeferredCjkFonts(waitForCover: boolean) {
  const [deferred, setDeferred] = useState(true);
  const release = useCallback(() => setDeferred(false), []);

  useEffect(() => {
    if (!deferred) return;
    const timer = setTimeout(release, MAX_WAIT_MS);
    if (waitForCover) return () => clearTimeout(timer);

    let frame = 0;
    const onLoad = () => {
      frame = requestAnimationFrame(release);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("load", onLoad);
    };
  }, [deferred, waitForCover, release]);

  return { deferred, release };
}
