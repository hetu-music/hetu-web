"use client";

import { Link } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Scroll, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

interface HeroSectionProps {
  songCount: number;
}

// 模板化入口配置区：未来添加新功能入口只需在此处添加配置即可
const FEATURE_ENTRANCES = [
  {
    id: "qjtx",
    href: "/story/qjtx",
    icon: Scroll,
    textBase: "text-[#A33E3E] dark:text-[#DE5D5D]",
    textHover: "group-hover:text-[#7A2828] dark:group-hover:text-[#F38B8B]",
    haloBg: "bg-[#A33E3E]/25 dark:bg-[#DE5D5D]/25",
    glow: "rgba(163,62,62,0.15)",
    offsetClass: "relative -left-[2px]",
  },
  {
    id: "imagery",
    href: "/imagery",
    icon: Sparkles,
    textBase: "text-[#2E756C] dark:text-[#44B0A2]",
    textHover: "group-hover:text-[#1D514A] dark:group-hover:text-[#6FD1C4]",
    haloBg: "bg-[#2E756C]/25 dark:bg-[#44B0A2]/25",
    glow: "rgba(46,117,108,0.15)",
    offsetClass: "relative -left-[0.5px]",
  },
  // 寻曲测验内测中，暂不开放入口；上线时取消注释并在上方引入 Compass 图标
  // {
  //   id: "quiz",
  //   href: "/quiz",
  //   icon: Compass,
  //   textBase: "text-[#9A6B2F] dark:text-[#D4A259]",
  //   textHover: "group-hover:text-[#6E4A1C] dark:group-hover:text-[#EACB94]",
  //   haloBg: "bg-[#9A6B2F]/25 dark:bg-[#D4A259]/25",
  //   glow: "rgba(154,107,47,0.15)",
  //   offsetClass: "relative",
  // },
];

export default function HeroSection({ songCount }: HeroSectionProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const t = useTranslations("library.hero");

  const isHoverDevice = useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      );
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    () => false,
  );

  const currentText = hoveredId
    ? t(`featureEntrances.${hoveredId}.desc`)
    : t("defaultDesc");

  return (
    <div
      className="w-full flex flex-col md:flex-row justify-between gap-5 md:gap-12 pt-1 md:pt-4"
      style={{ alignItems: "stretch" }}
    >
      {/* 左侧：标题与子标题 */}
      <div className="flex flex-col justify-between flex-1 gap-12 md:gap-0">
        <h2 className="text-5xl md:text-6xl text-slate-900 dark:text-slate-50 italic tracking-tight leading-[0.8] -mt-1 lg:-mt-1.5">
          {t("title")}{" "}
          <AnimatePresence mode="wait">
            <motion.span
              key={songCount}
              className="text-[1.3em] font-semibold inline-block"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
              }}
              exit={{
                opacity: 0,
                y: -10,
                transition: { duration: 0.18, ease: "easeIn" },
              }}
            >
              {songCount}
            </motion.span>
          </AnimatePresence>
        </h2>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-auto -mb-1 lg:-mb-1.5 min-h-[24px]">
          <span className="text-blue-600 dark:text-blue-500 font-mono text-lg leading-none relative top-[-0.5px] md:top-[-2px] select-none">
            &gt;
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={hoveredId || "default"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                filter: "blur(12px)",
                scale: 1.06,
                y: -3,
              }}
              transition={{
                duration: 0.35,
                ease: [0.25, 1, 0.5, 1],
              }}
              className="font-light text-base md:text-[18px] leading-relaxed mb-0 flex flex-wrap items-center select-none font-kaiti text-slate-600 dark:text-slate-400"
            >
              {currentText.split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{
                    opacity: 0,
                    filter: "blur(10px)",
                  }}
                  animate={{
                    opacity: [0, 0.7, 1],
                    filter: ["blur(10px)", "blur(4px)", "blur(0px)"],
                  }}
                  transition={{
                    duration: 1.8,
                    ease: [0.22, 0.6, 0.36, 1],
                    delay: i * 0.08,
                    times: [0, 0.35, 1],
                  }}
                  className="inline-block mr-[0.15em] origin-center"
                >
                  {char}
                </motion.span>
              ))}

              {isHoverDevice ? (
                <motion.span
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.8,
                    delay: currentText.length * 0.08,
                    ease: "easeOut",
                  }}
                  className="inline-block"
                >
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="select-none inline-block ml-1 font-normal text-slate-400 dark:text-slate-500"
                  >
                    ……
                  </motion.span>
                </motion.span>
              ) : (
                <motion.span
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.8,
                    delay: currentText.length * 0.08,
                    ease: "easeOut",
                  }}
                  className="ml-1 text-slate-400 dark:text-slate-500 inline-block"
                >
                  ……
                </motion.span>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* 右侧：功能入口区 (Feature Entrances) */}
      <div className="flex w-full md:w-auto h-full justify-start md:justify-end items-end md:items-start pt-1 md:pt-0">
        {/* -- 桌面端入口 (Desktop) - 极简水墨印章 -- */}
        <div className="hidden md:flex flex-row gap-5 justify-end mt-4 md:mt-0">
          {FEATURE_ENTRANCES.map((feature, index) => {
            return (
              <Link
                key={feature.id}
                href={feature.href}
                onMouseEnter={() => setHoveredId(feature.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative flex flex-col items-center outline-none text-[16px]"
                style={{ gap: "0.6em" }}
              >
                {/* 菱形小玉印与水墨涟漪指示器 */}
                <div className="relative flex items-center justify-center h-5 w-5">
                  {/* concentric ripples - 采用无边框高斯模糊光晕，消除硬边缘圆形 */}
                  <div
                    className={`absolute h-3 w-3 rounded-full opacity-0 blur-[3px] ${feature.haloBg} classical-ripple-anim`}
                    style={{ animationDelay: "0s" }}
                  />
                  <div
                    className={`absolute h-3 w-3 rounded-full opacity-0 blur-[3px] ${feature.haloBg} classical-ripple-anim`}
                    style={{ animationDelay: "2s" }}
                  />
                  {/* 核心玉印 */}
                  <div
                    className={`h-2 w-2 rotate-45 border border-current bg-transparent transition-all duration-1000 ease-out group-hover:rotate-135 ${feature.textBase} ${feature.textHover} group-hover:bg-current group-hover:scale-110`}
                  />
                </div>

                {/* 竖排标题 - 确保文字和光点绝对中心对齐 */}
                <div
                  className={`[writing-mode:vertical-rl] font-calligraphy font-medium text-[17px] tracking-[0.55em] mb-[-0.55em] ${feature.offsetClass} ${feature.textBase} ${feature.textHover} transition-[color,filter,text-shadow] duration-1000 group-hover:drop-shadow-[0_0_12px_${feature.glow}] select-none`}
                >
                  {t(`featureEntrances.${feature.id}.label`)
                    .split("")
                    .map((char, i) => (
                      <motion.span
                        key={i}
                        initial={{
                          opacity: 0,
                          scale: 0.8,
                          filter: "blur(8px)",
                        }}
                        animate={
                          !hoveredId || hoveredId === feature.id
                            ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                            : { opacity: 0, scale: 0.6, filter: "blur(12px)" }
                        }
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitFontSmoothing: "antialiased",
                          transform: "translateZ(0)",
                          willChange: "transform, opacity",
                        }}
                        transition={{
                          delay:
                            !hoveredId || hoveredId === feature.id
                              ? 0.45 + index * 0.15 + i * 0.15
                              : i * 0.05,
                          duration:
                            !hoveredId || hoveredId === feature.id ? 2.0 : 0.8,
                          ease: [0.215, 0.61, 0.355, 1],
                        }}
                        className="inline-block"
                      >
                        {char}
                      </motion.span>
                    ))}
                </div>
              </Link>
            );
          })}
        </div>

        {/* -- 移动端入口 (Mobile) - 极简横向排列 -- */}
        <div className="flex md:hidden flex-row gap-8 w-full mt-1 flex-wrap justify-center">
          {/* 主副标题与入口间的分界线 - 古典编排风格的高级分界线 */}
          <div className="flex items-center w-full mt-2 mb-1 opacity-80">
            <div className="flex-1 h-px bg-linear-to-r from-transparent to-slate-300 dark:to-slate-700" />
            <div className="mx-4 flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-600">
              <div className="h-[2px] w-[2px] rounded-full bg-current" />
              <div className="h-[4px] w-[4px] rounded-xs bg-current rotate-45" />
              <div className="h-[2px] w-[2px] rounded-full bg-current" />
            </div>
            <div className="flex-1 h-px bg-linear-to-l from-transparent to-slate-300 dark:to-slate-700" />
          </div>

          {FEATURE_ENTRANCES.map((feature, index) => {
            return (
              <Link
                key={feature.id}
                href={feature.href}
                onMouseEnter={() => setHoveredId(feature.id)}
                onMouseLeave={() => setHoveredId(null)}
                onTouchStart={() => setHoveredId(feature.id)}
                className="group flex items-center justify-between outline-none py-1.5 -translate-x-8"
              >
                <div className="flex items-center gap-4">
                  {/* 菱形小印章指示点 - 加上与桌面端统一的无边界高斯模糊光晕 */}
                  <div className="relative flex items-center justify-center h-3 w-3">
                    {/* concentric ripples */}
                    <div
                      className={`absolute h-2.5 w-2.5 rounded-full opacity-0 blur-[2px] ${feature.haloBg} classical-ripple-anim`}
                      style={{ animationDelay: "0s" }}
                    />
                    <div
                      className={`absolute h-2.5 w-2.5 rounded-full opacity-0 blur-[2px] ${feature.haloBg} classical-ripple-anim`}
                      style={{ animationDelay: "2s" }}
                    />
                    {/* 核心印章 */}
                    <div
                      className={`h-1.5 w-1.5 border border-current transition-all duration-500 ${
                        hoveredId === feature.id
                          ? `rotate-135 bg-current ${feature.textHover.replace(/group-hover:/g, "")}`
                          : `rotate-45 bg-transparent ${feature.textBase} group-active:rotate-135 group-active:bg-current`
                      }`}
                    />
                  </div>
                  {/* 标题 */}
                  <div
                    className={`flex items-center text-[16px] font-calligraphy font-medium tracking-[0.5em] leading-none transition-all duration-500 ${
                      hoveredId === feature.id
                        ? `${feature.textHover.replace(/group-hover:/g, "")}`
                        : `${feature.textBase} ${feature.textHover}`
                    }`}
                  >
                    {t(`featureEntrances.${feature.id}.label`)
                      .split("")
                      .map((char, i) => (
                        <motion.span
                          key={i}
                          initial={{
                            opacity: 0,
                            scale: 0.8,
                            filter: "blur(8px)",
                          }}
                          animate={
                            !hoveredId || hoveredId === feature.id
                              ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                              : { opacity: 0, scale: 0.6, filter: "blur(12px)" }
                          }
                          style={{
                            backfaceVisibility: "hidden",
                            WebkitFontSmoothing: "antialiased",
                            transform: "translateZ(0)",
                            willChange: "transform, opacity",
                          }}
                          transition={{
                            delay:
                              !hoveredId || hoveredId === feature.id
                                ? 0.35 + index * 0.15 + i * 0.15
                                : i * 0.05,
                            duration:
                              !hoveredId || hoveredId === feature.id
                                ? 2.0
                                : 0.8,
                            ease: [0.215, 0.61, 0.355, 1],
                          }}
                          className="inline-block"
                        >
                          {char}
                        </motion.span>
                      ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
