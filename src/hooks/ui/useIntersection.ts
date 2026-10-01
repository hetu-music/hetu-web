import { useCallback, useRef, useState } from "react";

/**
 * 观察元素与视口的相交情况。返回回调 ref，挂到要观察的元素上；
 * 元素换了或卸载时自动断开旧的观察。
 */
export function useIntersection<T extends Element>(
  options?: IntersectionObserverInit,
) {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  // 调用方常常每次渲染都传新的 options 对象，只按内容判断是否变了
  const root = options?.root;
  const rootMargin = options?.rootMargin;
  const thresholdKey = JSON.stringify(options?.threshold);

  const ref = useCallback(
    (element: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!element) {
        setEntry(null);
        return;
      }
      observer.current = new IntersectionObserver(([next]) => setEntry(next), {
        root,
        rootMargin,
        threshold: JSON.parse(thresholdKey ?? "null") ?? undefined,
      });
      observer.current.observe(element);
    },
    [root, rootMargin, thresholdKey],
  );

  return { ref, entry };
}
