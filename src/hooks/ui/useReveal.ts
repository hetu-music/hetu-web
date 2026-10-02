"use client";

import { type RefObject, useEffect } from "react";

/** 同一批进入视口的元素，依次相隔多久亮起；一批里排得再多也不超过上限 */
const STAGGER_MS = 70;
const STAGGER_MAX_MS = 560;

/**
 * 滚到视口里才「亮灯」：给容器内带 data-reveal 的元素加上 data-shown，样式由调用方用
 * data-shown: 变体写。同一批进入的按行、再按列排序，从左到右依次亮起。
 * 只亮一次；deps 变化（换视图、换列表）时重新登记。
 */
export function useReveal(
  containerRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targets = container.querySelectorAll<HTMLElement>(
      "[data-reveal]:not([data-shown])",
    );
    if (targets.length === 0) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      targets.forEach((el) => (el.dataset.shown = ""));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            el: e.target as HTMLElement,
            rect: e.boundingClientRect,
          }))
          // 同一行的上沿相差不大，按 8px 一档归行
          .sort(
            (a, b) =>
              Math.round(a.rect.top / 8) - Math.round(b.rect.top / 8) ||
              a.rect.left - b.rect.left,
          );
        entering.forEach(({ el }, i) => {
          el.style.transitionDelay = `${Math.min(i * STAGGER_MS, STAGGER_MAX_MS)}ms`;
          el.dataset.shown = "";
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
