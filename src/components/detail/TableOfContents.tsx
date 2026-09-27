"use client";

import { useTranslations } from "next-intl";
import React, { useEffect, useRef, useState } from "react";

export interface NavItem {
  id: string;
  label: string;
}

interface TableOfContentsProps {
  /** 章节列表；调用方需保持引用稳定，否则观察器会反复重建 */
  items: NavItem[];
}

const TableOfContents: React.FC<TableOfContentsProps> = ({
  items: navItems,
}) => {
  const t = useTranslations("song");
  const firstId = navItems[0]?.id ?? "";
  const [activeId, setActiveId] = useState<string>(firstId);
  const [displayedActiveId, setDisplayedActiveId] = useState<string>(firstId);
  const displayedActiveIdRef = useRef<string>(firstId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showActiveLabel, setShowActiveLabel] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 检测触摸设备
  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    };
    checkTouch();

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    mediaQuery.addEventListener("change", checkTouch);
    return () => mediaQuery.removeEventListener("change", checkTouch);
  }, []);

  // 防抖：只有滚动停止后才更新显示的 activeId 和显示标签
  useEffect(() => {
    // 清除之前的定时器
    if (activeDebounceRef.current) {
      clearTimeout(activeDebounceRef.current);
    }

    // 滚动期间不更新显示
    if (isScrolling) {
      return;
    }

    // 滚动停止后，延迟更新显示的 activeId
    activeDebounceRef.current = setTimeout(() => {
      // 只有当 activeId 变化时才显示标签
      if (activeId !== displayedActiveIdRef.current) {
        displayedActiveIdRef.current = activeId;
        setDisplayedActiveId(activeId);

        // 显示标签
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        setShowActiveLabel(true);
        hideTimerRef.current = setTimeout(() => {
          setShowActiveLabel(false);
          setHoveredId(null);
        }, 750);
      }
    }, 50);

    return () => {
      if (activeDebounceRef.current) {
        clearTimeout(activeDebounceRef.current);
      }
    };
  }, [activeId, isScrolling]);

  // 监听滚动状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScrollStart = () => {
      setIsScrolling(true);
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
      scrollDebounceRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 80);
    };

    window.addEventListener("scroll", handleScrollStart, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollStart);
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, []);

  // IntersectionObserver 监听当前可见的 section
  useEffect(() => {
    if (typeof window === "undefined") return;

    const options = {
      root: null,
      // 检测区域：顶部 15% 到 30%，让区域占据约 65% 屏幕时才触发切换
      rootMargin: "-15% 0px -70% 0px",
      threshold: 0,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    }, options);

    const timer = setTimeout(() => {
      navItems.forEach((item) => {
        const element = document.getElementById(item.id);
        if (element && observerRef.current) {
          observerRef.current.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [navItems]);

  // 处理快速滚动到顶部的边界情况
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (window.scrollY < 150 && navItems.length > 0) {
        setActiveId(navItems[0].id);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });

      // 点击后立即更新显示
      displayedActiveIdRef.current = id;
      setDisplayedActiveId(id);
      setActiveId(id);

      if (isTouch) {
        setHoveredId(id);
        setTimeout(() => setHoveredId(null), 750);
      }
    }
  };

  const handleMouseEnter = (id: string) => {
    if (!isTouch) {
      setHoveredId(id);
    }
  };

  const handleMouseLeave = () => {
    if (!isTouch) {
      setHoveredId(null);
    }
  };

  return (
    <>
      {/* 平板及以上：右侧垂直导航 */}
      <nav
        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-end gap-3"
        aria-label={t("sections.toc")}
      >
        {navItems.map((item) => {
          const isActive = displayedActiveId === item.id;
          const isHovered = hoveredId === item.id;
          const showLabel = isHovered || (isActive && showActiveLabel);

          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              className="group flex items-center gap-3 outline-none touch-manipulation"
              aria-label={t("sections.jumpTo", { label: item.label })}
              aria-current={isActive ? "location" : undefined}
            >
              {/* 标签 */}
              <span
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium
                  backdrop-blur-md border transition-all duration-300 ease-out
                  ${showLabel ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"}
                  ${
                    isActive
                      ? "bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 border-transparent shadow-lg"
                      : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50"
                  }
                `}
              >
                {item.label}
              </span>

              {/* 指示点 */}
              <span
                className={`
                  relative flex items-center justify-center
                  w-3 h-3 rounded-full transition-all duration-300 ease-out
                  ${
                    isActive
                      ? "bg-slate-900 dark:bg-white scale-100"
                      : "bg-slate-300 dark:bg-slate-600 scale-75 group-hover:scale-100 group-hover:bg-slate-400 dark:group-hover:bg-slate-500"
                  }
                `}
              />
            </button>
          );
        })}

        {/* 连接线 */}
        <div
          className="absolute right-[5px] top-0 bottom-0 w-[2px] bg-linear-to-b from-transparent via-slate-200 dark:via-slate-700 to-transparent -z-10"
          aria-hidden="true"
        />
      </nav>

      {/* 手机端：底部水平导航 */}
      <nav
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 md:hidden"
        aria-label={t("sections.toc")}
      >
        <div className="flex items-center gap-8 px-2 py-2">
          {/* 水平连接线 */}
          <div
            className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[1.5px] bg-linear-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent -z-10"
            aria-hidden="true"
          />

          {navItems.map((item) => {
            const isActive = displayedActiveId === item.id;
            const isHovered = hoveredId === item.id;
            const showLabel = isHovered || (isActive && showActiveLabel);

            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                onMouseEnter={() => handleMouseEnter(item.id)}
                onMouseLeave={handleMouseLeave}
                className="group relative flex flex-col items-center outline-none touch-manipulation"
                aria-label={t("sections.jumpTo", { label: item.label })}
                aria-current={isActive ? "location" : undefined}
              >
                {/* 标签 - 向上弹出 */}
                <span
                  className={`
                    absolute -top-8 left-1/2 -translate-x-1/2
                    px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap
                    backdrop-blur-md border transition-all duration-300 ease-out
                    ${showLabel ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}
                    ${
                      isActive
                        ? "bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 border-transparent shadow-md"
                        : "bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50"
                    }
                  `}
                >
                  {item.label}
                  {/* 小三角 */}
                  <span
                    className={`
                      absolute -bottom-1 left-1/2 -translate-x-1/2
                      border-[3px] border-transparent
                      ${isActive ? "border-t-slate-900/90 dark:border-t-white/90" : "border-t-white/90 dark:border-t-slate-800/90"}
                    `}
                  />
                </span>

                {/* 指示点 */}
                <span
                  className={`
                    relative flex items-center justify-center
                    w-2.5 h-2.5 rounded-full transition-all duration-300 ease-out
                    ${
                      isActive
                        ? "bg-slate-900 dark:bg-white scale-110"
                        : "bg-slate-300 dark:bg-slate-600 scale-100 group-hover:scale-105 group-hover:bg-slate-400 dark:group-hover:bg-slate-500"
                    }
                  `}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default TableOfContents;
