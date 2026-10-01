"use client";

import { useGSAP } from "@gsap/react";
import { motion, type Variants } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { Link } from "@/i18n/navigation";
import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/player-store";
import {
  CUSTOM_NODE_REGISTRY,
  DefaultNodeLayout,
  animateDefault,
  defaultTheme,
} from "./custom-nodes";
import { type ImmersiveTheme, type TimelineEvent } from "./types";

gsap.registerPlugin(ScrollTrigger);

// ─── Constants ────────────────────────────────────────────────────────────────

const motionEase = [0.22, 1, 0.36, 1] as const;
const animationSlowdown = 3;

/** 雪花 SVG mask path，提取为常量，避免在每个 event 的 JSX 中重复序列化 */
const SNOWFLAKE_MASK_PATH =
  "M50 0 L55 35 L80 20 L65 45 L100 50 L65 55 L80 80 L55 65 L50 100 L45 65 L20 80 L35 55 L0 50 L35 45 L20 20 L45 35 Z";

/** 模块级 maskUrl 缓存，避免每次渲染重复 encodeURIComponent */
const maskUrlCache = new Map<string, string>();

/** 根据 SVG path 字符串构建 CSS mask-image 值（带缓存） */
function buildMaskUrl(path: string): string {
  const cached = maskUrlCache.get(path);
  if (cached) return cached;
  const encoded = encodeURIComponent(
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="black"/></svg>`,
  );
  const url = `url('data:image/svg+xml,${encoded}')`;
  maskUrlCache.set(path, url);
  return url;
}

const SNOWFLAKE_MASK_URL = buildMaskUrl(SNOWFLAKE_MASK_PATH);

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const heroTitleVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.22 * animationSlowdown,
      delayChildren: 0.35 * animationSlowdown,
    },
  },
} satisfies Variants;

// Hero 入场变体含 filter:blur
const heroCharVariants = {
  hidden: { opacity: 0, scale: 0.85, filter: "blur(16px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 1.6 * animationSlowdown, ease: motionEase },
  },
} satisfies Variants;

const heroSubtitleVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18 * animationSlowdown,
      delayChildren: 1 * animationSlowdown,
    },
  },
} satisfies Variants;

const heroSubtitleLineVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(5px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.2 * animationSlowdown, ease: motionEase },
  },
} satisfies Variants;

const scrollHintVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1 * animationSlowdown,
      delay: 1.45 * animationSlowdown,
      ease: motionEase,
    },
  },
} satisfies Variants;

// ─── Small Components ─────────────────────────────────────────────────────────

const verticalTextClass =
  "[writing-mode:vertical-rl] [text-orientation:mixed] shrink-0 leading-none";

function EventLines({
  content,
  important,
  mobile = false,
  align = "left",
}: {
  content?: string[];
  important?: boolean;
  mobile?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={
        mobile
          ? "text-left flex flex-col gap-3 max-w-[16rem] sm:max-w-sm"
          : `${align === "right" ? "text-right" : "text-left"} flex flex-col gap-4 max-w-sm xl:max-w-md`
      }
    >
      {content?.map((line, index) => (
        <p
          key={index}
          className={`${
            mobile
              ? "text-sm tracking-widest"
              : "text-[15px] lg:text-base tracking-widest lg:tracking-[0.2em]"
          } font-light leading-loose ${
            important
              ? "text-zinc-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] font-normal"
              : "text-zinc-400"
          }`}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function EventDate({
  year,
  month,
  monthFirst = false,
  mobile = false,
}: {
  year?: string;
  month?: string;
  monthFirst?: boolean;
  mobile?: boolean;
}) {
  const monthNode = month ? (
    <div
      className={`${verticalTextClass} ${
        mobile ? "text-sm" : "text-lg lg:text-xl"
      } text-red-800/80 font-serif tracking-[0.3em]`}
    >
      {month}
    </div>
  ) : null;

  const yearNode = (
    <div
      className={`${verticalTextClass} ${
        mobile ? "text-xl" : "text-2xl lg:text-3xl"
      } font-serif tracking-[0.3em] font-light text-zinc-300`}
    >
      {year}
    </div>
  );

  return (
    <div
      className={`flex flex-row items-end ${
        mobile ? "gap-2" : "gap-3 lg:gap-4"
      } transition-colors`}
    >
      {monthFirst ? (
        <>
          {monthNode}
          {yearNode}
        </>
      ) : (
        <>
          {yearNode}
          {monthNode}
        </>
      )}
    </div>
  );
}

// ─── Immersive Reading Panel ──────────────────────────────────────────────────

/**
 * 沉浸式阅读覆盖层（固定全屏）。
 *
 * 根据 CUSTOM_NODE_REGISTRY 分发：
 * - 注册表中存在该 ID → 使用自定义 Theme + Layout
 * - 注册表中不存在 → 使用 DefaultNode 的 Theme + Layout
 */
function ImmersiveReadingPanel({ event }: { event: TimelineEvent }) {
  if (!event.detail) return null;

  // 查找自定义节点
  const custom = CUSTOM_NODE_REGISTRY[event.id];

  // 合并主题：自定义 > data.ts > 系统默认
  const resolvedTheme: Required<ImmersiveTheme> = {
    ...defaultTheme,
    ...(event.detail.theme ?? {}),
    ...(custom?.theme ?? {}),
  };

  const { bg, maskPath, layout, specialEffect } = resolvedTheme;

  const maskUrl = maskPath ? buildMaskUrl(maskPath) : SNOWFLAKE_MASK_URL;

  // 选择布局组件
  const ContentComponent = custom?.Component ?? DefaultNodeLayout;

  return (
    <div
      id={`detail-${event.id}`}
      data-layout={layout}
      data-effect={specialEffect}
      className="fixed inset-0 w-screen h-screen m-0 p-0 z-100 pointer-events-none flex-col items-center justify-center hidden"
      style={{ isolation: "isolate" } as React.CSSProperties}
    >
      {/* 展开背景（雪花/自定义形状 mask 扩展） */}
      <div
        className={`scrolly-bg-${event.id} absolute inset-0 w-full h-full z-0 overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,1)]`}
        style={
          {
            background: bg,
            WebkitMaskImage: maskUrl,
            maskImage: maskUrl,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "var(--radius, 0px)",
            maskSize: "var(--radius, 0px)",
            WebkitMaskPosition:
              "calc(var(--x, 50vw) - var(--radius, 0px) / 2) calc(var(--y, 55vh) - var(--radius, 0px) / 2)",
            maskPosition:
              "calc(var(--x, 50vw) - var(--radius, 0px) / 2) calc(var(--y, 55vh) - var(--radius, 0px) / 2)",
          } as React.CSSProperties
        }
      />

      {/* 内容层：自定义节点或默认布局 */}
      <ContentComponent event={event} resolvedTheme={resolvedTheme} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QjtxClient({ events }: { events: TimelineEvent[] }) {
  const container = useRef<HTMLDivElement>(null);
  const { pause, setPlayerVisible } = usePlayerStore();

  // 进入页面时暂停播放并隐藏播放条，离开时恢复显示
  useEffect(() => {
    pause();
    setPlayerVisible(false);
    return () => {
      setPlayerVisible(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      // 移动端使用原生惯性滚动，不需要Lenis接管触摸事件（避免额外JS开销）
      syncTouch: false,
    });

    // 暂时禁止滚动，等待开场动画（指示线）播放完成
    lenis.stop();
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    const unlockTimeout = setTimeout(
      () => {
        lenis.start();
        html.style.overflow = "";
        body.style.overflow = "";
        body.style.touchAction = "";
      },
      (1.45 + 0.4) * animationSlowdown * 1000,
    ); // 提前一点解锁（在动画完成前）

    const updateScrollTrigger = () => ScrollTrigger.update();
    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    const handleRefresh = () => lenis.resize();

    html.classList.add("qjtx-story-page");
    body.classList.add("qjtx-story-page");
    lenis.on("scroll", updateScrollTrigger);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.addEventListener("refresh", handleRefresh);
    ScrollTrigger.refresh();

    return () => {
      clearTimeout(unlockTimeout);
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.touchAction = "";
      html.classList.remove("qjtx-story-page");
      body.classList.remove("qjtx-story-page");
      ScrollTrigger.removeEventListener("refresh", handleRefresh);
      gsap.ticker.remove(raf);
      lenis.off("scroll", updateScrollTrigger);
      lenis.destroy();
    };
  }, []);

  useGSAP(
    () => {
      // 一次性检测，在 scrub 动画中保持稳定
      const isMobile = window.innerWidth < 768;

      const wrappers = gsap.utils.toArray<HTMLElement>(
        ".timeline-event-wrapper",
        container.current,
      );
      const dots = gsap.utils.toArray<HTMLElement>(
        ".event-dot",
        container.current,
      );

      // ─ 缓存 DOM 引用 ────────────────────────────────────────────────────────
      const containerEl = container.current?.querySelector<HTMLElement>(
        ".timeline-container",
      );
      const progressLine =
        container.current?.querySelector<HTMLElement>(".timeline-progress");

      const setDotState = (dot: HTMLElement, active: boolean) => {
        const nextState = active ? "active" : "inactive";
        if (dot.dataset.state === nextState) return;
        dot.dataset.state = nextState;
        gsap.to(dot, {
          duration: 0.35,
          borderColor: active ? "#b91c1c" : "#71717a",
          backgroundColor: active ? "#7f1d1d" : "#000000",
          boxShadow: active
            ? "0 0 15px rgba(185,28,28,0.8)"
            : "0 0 0 rgba(0,0,0,0)",
          overwrite: true,
        });
      };

      dots.forEach((dot) => setDotState(dot, false));

      // ─ 预缓存每个 dot 对应的 wrapper 引用 ──────────────────────────────────
      // 位置计算使用 getBoundingClientRect()——它返回精确的当前视口坐标，
      // 在 ScrollTrigger pin 期间 container 静止但 wrappers 相对视口位置
      // 发生变化时依然正确（offsetTop 在这种情况下会失准）。
      const dotWrappers = dots.map((dot) =>
        dot.closest<HTMLElement>(".timeline-event-wrapper"),
      );

      const updateLinesAndDots = () => {
        if (!containerEl || !progressLine) return;

        const rect = containerEl.getBoundingClientRect();
        const triggerY = window.innerHeight * 0.55;

        let lineTargetHeight = triggerY - rect.top;
        lineTargetHeight = Math.max(0, Math.min(lineTargetHeight, rect.height));
        progressLine.style.height = `${lineTargetHeight}px`;

        dots.forEach((dot, i) => {
          const wrapper = dotWrappers[i];
          if (!wrapper) return;
          const wrapperRect = wrapper.getBoundingClientRect();
          const wrapperCenter = wrapperRect.top + wrapperRect.height / 2;
          setDotState(dot, wrapperCenter <= triggerY);
        });
      };

      // scroll 事件驱动（Lenis 每帧调用 ScrollTrigger.update() 会分发 scroll 事件）
      window.addEventListener("scroll", updateLinesAndDots, { passive: true });
      updateLinesAndDots(); // 初始同步一次

      wrappers.forEach((wrapper) => {
        const content = wrapper.querySelector<HTMLElement>(
          ".timeline-event-content",
        );
        if (!content) return;

        // ── B. 节点入场位移动画：target = content, trigger = wrapper ──
        gsap.fromTo(
          content,
          // 移动端去掉blur（GPU密集型），只用opacity+y
          { opacity: 0, y: 70, filter: "blur(10px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            scrollTrigger: {
              trigger: wrapper,
              pinnedContainer: ".timeline-container",
              start: "top 90%",
              end: "center 55%",
              scrub: 1.5,
            },
          },
        );

        const isImportant = wrapper.dataset.important === "true";
        if (isImportant) {
          const detailContent = container.current?.querySelector<HTMLElement>(
            `#detail-${wrapper.dataset.id}`,
          );
          const scrollyBg = detailContent?.querySelector<HTMLElement>(
            `.scrolly-bg-${wrapper.dataset.id}`,
          );
          const scrollyText = detailContent?.querySelector<HTMLElement>(
            `.scrolly-text-${wrapper.dataset.id}`,
          );
          const dot = content.querySelector<HTMLElement>(".event-dot");

          if (detailContent && scrollyBg && scrollyText && dot) {
            const setCirclePos = () => {
              const dotRect = dot.getBoundingClientRect();
              const wrapperRect = wrapper.getBoundingClientRect();
              const trueX = dotRect.left + dotRect.width / 2;
              const trueY = wrapperRect.top + wrapperRect.height / 2;
              scrollyBg.style.setProperty("--x", `${trueX}px`);
              scrollyBg.style.setProperty("--y", `${trueY}px`);
            };

            // panelInfiniteTweens 在 animate() 调用后填充；
            // setDetailVisibility 通过闭包引用该数组实现 pause/resume。
            let panelInfiniteTweens: gsap.core.Tween[] = [];

            const setDetailVisibility = (visible: boolean) => {
              gsap.set(detailContent, { display: visible ? "flex" : "none" });
              // 面板隐藏时暂停所有无限循环粒子动画，避免后台持续消耗 CPU；
              // 激活时恢复，做到真正按需运行。
              panelInfiniteTweens.forEach((t) =>
                visible ? t.resume() : t.pause(),
              );
            };

            const syncDetailVisibility = (trigger: ScrollTrigger) => {
              setDetailVisibility(trigger.isActive);
            };

            setDetailVisibility(false);

            // ── A. 沉浸式阅读 Pin 动画：trigger = wrapper ──
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: wrapper,
                pinnedContainer: ".timeline-container",
                start: "center 55%",
                end: "+=6000",
                // scrub: 1 比 scrub: true（=0）多一点追赶延迟，
                // 减少高频 timeline 更新，同时带来更顺滑的感知
                scrub: 1,
                pin: ".timeline-container",
                pinSpacing: true,
                invalidateOnRefresh: true,
                onToggle: (self) => {
                  if (self.isActive) setCirclePos();
                  syncDetailVisibility(self);
                },
                onRefresh: (self) => {
                  if (self.isActive) setCirclePos();
                  syncDetailVisibility(self);
                },
              },
            });

            const eventId = wrapper.dataset.id;
            if (!eventId) return;
            const customNode = CUSTOM_NODE_REGISTRY[eventId];

            if (customNode) {
              // ── 自定义节点：委托给注册表中的 animate 函数 ──
              customNode.animate(
                tl,
                detailContent,
                scrollyBg,
                scrollyText,
                eventId,
              );
            } else {
              // ── 默认节点：使用通用动效 ──
              animateDefault(
                tl,
                detailContent,
                scrollyBg,
                scrollyText,
                eventId,
              );
            }

            // animate() 同步执行完毕后，收集所有 repeat:-1 的无限循环粒子 tween。
            // 精确范围限定在 detailContent 内，避免影响其他面板的 tween。
            panelInfiniteTweens = (
              gsap.getTweensOf(
                Array.from(detailContent.querySelectorAll("*")),
              ) as gsap.core.Tween[]
            ).filter((t) => t.vars.repeat === -1);

            // 初始暂停所有粒子动画（面板此时处于 display:none 状态）
            panelInfiniteTweens.forEach((t) => t.pause());
          }
        }
      });

      // --- 终章：泪滴坠落与墨染动画 ---

      // 1. 红线底部生成泪滴
      gsap.set(".tear-drop-tip", { opacity: 0, scale: 0 });
      gsap.to(".tear-drop-tip", {
        opacity: 1,
        scale: 1.2,
        scrollTrigger: {
          trigger: ".footer-final", // 使用 footer 作为触发源，因为它被 timeline 的 pin 间距正确推后
          start: "top 100%", // Footer刚进入视口（即刚划过一小段距离）时就开始形成
          end: "top 55%", // Footer到达55vh（即与红线底部接触的位置）时刚好完全形成
          scrub: true,
        },
      });

      // 2. Footer 固定并播放滴落和晕染动画
      const endTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".footer-final",
          start: "top top", // 当 footer 到达视口顶部时固定
          end: "+=300%", // 增加滚动距离，让动画更缓慢细腻
          scrub: 1.5, // 增加 scrub 延迟，让过渡更顺滑
          pin: true,
          pinSpacing: true,
          invalidateOnRefresh: true,
          onEnter: () => {
            gsap.set(".tear-drop-tip", { opacity: 0 });
            gsap.set(".falling-tear", { opacity: 1 });
          },
          onLeaveBack: () => {
            gsap.set(".tear-drop-tip", { opacity: 1 });
            gsap.set(".falling-tear", { opacity: 0 });
          },
        },
      });

      // 初始大小设为 1.2 以完美衔接红线末端的 tear-drop-tip
      gsap.set(".falling-tear", { opacity: 0, y: 0, scale: 1.2 });

      endTl
        // 泪滴缓缓坠落到正中
        .to(".falling-tear", {
          y: "50vh",
          scale: 1,
          duration: 3,
          ease: "power1.in",
        })
        .add("hit")
        // 泪滴触底，如墨滴入水般极致晕开
        // 移动端降低放大倍数并去掉大radius blur（极耗GPU）
        .to(
          ".falling-tear",
          {
            scale: isMobile ? 20 : 45,
            filter: "blur(25px)",
            duration: 4,
            ease: "power2.out",
          },
          "hit",
        )
        // 墨迹缓慢消散
        .to(
          ".falling-tear",
          {
            opacity: 0,
            duration: 3,
            ease: "power2.inOut",
          },
          "hit+=1",
        )
        // 文本从浓墨中缓缓浮现
        .fromTo(
          ".bloom-content",
          // 移动端降低blur半径
          {
            opacity: 0,
            filter: isMobile ? "blur(8px)" : "blur(30px)",
            scale: 0.95,
          },
          {
            opacity: 1,
            filter: "blur(0px)",
            scale: 1,
            duration: 4,
            ease: "power2.inOut",
          },
          "hit+=0.5",
        );

      return () => {
        window.removeEventListener("scroll", updateLinesAndDots);
      };
    },
    { scope: container },
  );

  return (
    <div
      ref={container}
      className="relative min-h-screen overflow-x-hidden bg-black font-serif text-zinc-300 selection:bg-red-900 selection:text-white"
    >
      <style jsx global>{`
        html,
        body {
          height: auto !important;
          background: black !important;
          overflow-x: hidden !important;
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
          /* 全站在 html 上固定留出了滚动条的位置；这页不要滚动条，也不要那道空位 */
          scrollbar-gutter: auto !important;
        }

        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }

        html.lenis.lenis-smooth {
          scroll-behavior: auto !important;
        }

        html.lenis.lenis-stopped {
          overflow: hidden !important;
        }

        html.lenis.lenis-smooth [data-lenis-prevent] {
          overscroll-behavior: contain;
        }

        .ink-bloom-text {
          text-shadow: 0 0 20px rgba(185, 28, 28, 0.4);
        }
      `}</style>

      <section className="relative z-10 flex h-svh flex-col items-center justify-center">
        <div className="mt-[-10vh] flex flex-col items-center gap-12 sm:gap-16">
          <motion.h1
            variants={heroTitleVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-center pb-4 pl-[0.2em] text-5xl font-bold text-zinc-100 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] sm:pl-[0.4em] sm:text-7xl md:text-8xl lg:text-9xl"
          >
            {"倾尽天下".split("").map((char) => (
              <motion.span
                key={char}
                variants={heroCharVariants}
                className="inline-block px-1 tracking-[0.2em] sm:px-2 sm:tracking-[0.4em]"
              >
                {char}
              </motion.span>
            ))}
          </motion.h1>

          <motion.div
            variants={heroSubtitleVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center gap-6"
          >
            <motion.p
              variants={heroSubtitleLineVariants}
              className="pl-[0.8em] text-sm font-light tracking-[0.8em] text-zinc-400 sm:pl-[1em] sm:text-lg sm:tracking-[1em] md:text-xl"
            >
              <span className="text-red-700 drop-shadow-[0_0_15px_rgba(185,28,28,0.5)]">
                血
              </span>
              染江山的画
            </motion.p>
            <motion.p
              variants={heroSubtitleLineVariants}
              className="pl-[0.8em] text-sm font-light tracking-[0.8em] text-zinc-400 sm:pl-[1em] sm:text-lg sm:tracking-[1em] md:text-xl"
            >
              怎敌你眉间一点
              <span className="text-red-700 drop-shadow-[0_0_15px_rgba(185,28,28,0.5)]">
                朱砂
              </span>
            </motion.p>
          </motion.div>
        </div>

        <motion.div
          variants={scrollHintVariants}
          initial="hidden"
          animate="visible"
          className="scroll-hint absolute bottom-12 flex flex-col items-center gap-3 text-zinc-600 left-14 -translate-x-1/2 md:left-1/2"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-light text-zinc-400 [writing-mode:vertical-rl] md:[writing-mode:horizontal-tb] md:ml-[0.3em]">
            展开编年史
          </span>
          <div className="relative h-16 w-[2px] overflow-hidden bg-zinc-800/40 rounded-full">
            <div className="scroll-hint-line absolute top-0 left-0 h-full w-full bg-red-900/40 rounded-full" />
          </div>
        </motion.div>
      </section>

      <main
        className="timeline-container relative z-20 mx-auto w-full max-w-7xl px-4 py-[15vh]"
        style={{ contain: "layout" }}
      >
        <div className="absolute top-0 bottom-0 left-14 w-px -translate-x-1/2 rounded bg-zinc-800/40 md:left-1/2" />
        <div className="timeline-progress absolute top-0 left-14 z-10 w-px -translate-x-1/2 rounded bg-red-800/80 shadow-[0_0_10px_rgba(185,28,28,0.8)] md:left-1/2">
          <div className="tear-drop-tip absolute top-full left-1/2 -translate-x-1/2 opacity-0 w-3 h-4">
            <svg
              viewBox="0 0 100 120"
              className="w-full h-full fill-red-700 drop-shadow-[0_0_8px_rgba(185,28,28,0.8)]"
            >
              <path d="M50 0 C50 0 20 45 20 75 A30 30 0 1 0 80 75 C80 45 50 0 50 0 Z" />
            </svg>
          </div>
        </div>

        <div className="relative flex w-full flex-col pt-10 pb-[30vh]">
          {events.map((event, index) => {
            const isLeft = index % 2 === 0;

            return (
              <div
                key={event.id}
                data-important={event.important ? "true" : "false"}
                data-id={event.id}
                className="timeline-event-wrapper my-10 w-full md:my-20"
              >
                <div className="timeline-event-content group relative flex w-full flex-col md:flex-row md:justify-center">
                  <div className="event-dot absolute top-1/2 left-10 z-20 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 origin-center rounded-full border border-zinc-500 bg-black md:left-1/2 md:h-[13px] md:w-[13px]" />

                  <div className="flex w-full justify-start pl-18 pr-2 md:hidden">
                    <div className="flex flex-row items-center gap-4 sm:gap-6">
                      <EventDate year={event.year} month={event.month} mobile />
                      <EventLines
                        content={event.content}
                        important={event.important}
                        mobile
                      />
                    </div>
                  </div>

                  <div
                    className={`hidden w-1/2 justify-end pr-12 md:flex lg:pr-24 ${
                      !isLeft ? "invisible" : ""
                    }`}
                  >
                    <div className="flex flex-row items-center gap-8 lg:gap-12">
                      <EventLines
                        content={event.content}
                        important={event.important}
                        align="left"
                      />
                      <EventDate
                        year={event.year}
                        month={event.month}
                        monthFirst
                      />
                    </div>
                  </div>

                  <div
                    className={`hidden w-1/2 justify-start pl-12 md:flex lg:pl-24 ${
                      isLeft ? "invisible" : ""
                    }`}
                  >
                    <div className="flex flex-row items-center gap-8 lg:gap-12">
                      <EventDate year={event.year} month={event.month} />
                      <EventLines
                        content={event.content}
                        important={event.important}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 沉浸式阅读覆盖层，渲染顺序在 main 之后以保证 z-index 覆盖 */}
      {events.map((event) => (
        <ImmersiveReadingPanel key={`detail-${event.id}`} event={event} />
      ))}

      <footer className="footer-final relative z-10 w-full min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
        <div className="falling-tear absolute top-0 left-14 md:left-1/2 -translate-x-1/2 w-3 h-4 opacity-0 pointer-events-none">
          <svg
            viewBox="0 0 100 120"
            className="w-full h-full fill-red-700 drop-shadow-[0_0_12px_rgba(185,28,28,0.9)]"
          >
            <path d="M50 0 C50 0 20 45 20 75 A30 30 0 1 0 80 75 C80 45 50 0 50 0 Z" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-12 text-center px-4 relative z-10">
          <div className="bloom-content opacity-0 flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <p className="ink-bloom-text text-xl md:text-3xl font-serif font-light tracking-[0.8em] text-zinc-100 pl-[0.8em]">
                山河万里 · 故人长绝
              </p>
              <div className="w-12 h-px bg-red-900/50" />
            </div>
            <Link
              href="/"
              className="text-[11px] md:text-xs font-light tracking-[0.5em] text-zinc-500 uppercase opacity-60 hover:opacity-100 hover:text-zinc-200 transition-all duration-300"
            >
              河图作品勘鉴
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
