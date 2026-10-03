"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useMemo } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;
/** 朱砂：倾尽天下那条红线的颜色 */
const CINNABAR = "#c8402f";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const TILE_CLASS =
  "group relative block h-28 md:h-40 overflow-hidden rounded-xl ring-1 ring-slate-900/5 dark:ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-(--tone)";

function TileText({
  eyebrow,
  title,
  desc,
  inverted,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  /** 压在图上：用白字 */
  inverted?: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col justify-end p-4 md:p-6">
      <p
        className={cn(
          "text-[10px] md:text-[11px] tracking-[0.35em]",
          inverted ? "text-white/70" : "text-(--tone)",
        )}
      >
        {eyebrow}
      </p>
      <p
        className={cn(
          "mt-1.5 md:mt-2 flex items-center gap-2 font-serif text-xl md:text-3xl font-semibold tracking-tight",
          inverted ? "text-white" : "text-slate-900 dark:text-slate-50",
        )}
      >
        {title}
        <ArrowRight
          size={18}
          className="opacity-0 -translate-x-1 transition-[opacity,translate] duration-500 ease-page group-hover:opacity-70 group-hover:translate-x-0"
        />
      </p>
      <p
        className={cn(
          "mt-1 hidden sm:block font-kaiti text-sm",
          inverted ? "text-white/75" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {desc}
      </p>
    </div>
  );
}

/** 倾尽天下：插画缓缓推近，一缕朱砂线从左往右画过 */
function StoryTile() {
  return (
    <Link href="/story/qjtx" className={TILE_CLASS}>
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1.02, 1.1] }}
        transition={{
          duration: 18,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <Image
          src="/story/qjtx/31.avif"
          alt=""
          fill
          sizes="(min-width: 768px) 40vw, 50vw"
          className="object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/35 to-black/5 transition-opacity duration-700 group-hover:opacity-80" />
      <svg
        aria-hidden
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
      >
        <motion.path
          d="M -10 118 C 70 96, 120 136, 190 104 S 300 52, 410 74"
          fill="none"
          stroke={CINNABAR}
          strokeWidth={1.6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1], opacity: [0.9, 0.9, 0] }}
          transition={{
            duration: 6,
            times: [0, 0.6, 1],
            ease: EASE,
            repeat: Infinity,
            repeatDelay: 1.5,
            delay: 1.2,
          }}
        />
      </svg>
      <TileText
        inverted
        eyebrow="专题 · 长篇叙事"
        title="倾尽天下"
        desc="一曲长歌，倾尽天下"
      />
    </Link>
  );
}

/** 意象：最常写到的那些字在右侧浮沉 */
function ImageryTile({
  imagery,
}: {
  imagery: { name: string; count: number }[];
}) {
  const glyphs = useMemo(() => {
    const max = imagery[0]?.count ?? 1;
    // 固定种子的散布，服务端与客户端一致
    const rand = seeded(11);
    // 右侧排成错落的两行，每字一格，格内微微抖开，免得叠在一起
    const cols = 6;
    return imagery.slice(0, 12).map((item, i) => ({
      ...item,
      index: i % cols,
      row: i < cols ? 0 : 1,
      left: 42 + (i % cols) * 9.2 + rand() * 3,
      top: (i < cols ? 14 : 52) + ((i % cols) % 2) * 10 + rand() * 6,
      size: 0.95 + 1.1 * Math.sqrt(item.count / max),
      delay: i * 0.35,
      drift: 6 + rand() * 8,
      duration: 7 + rand() * 6,
      strong: i < 3,
    }));
  }, [imagery]);

  return (
    <Link
      href="/imagery"
      className={cn(TILE_CLASS, "bg-white/80 dark:bg-slate-900/70")}
    >
      <div aria-hidden className="absolute inset-0">
        {glyphs.map((g) => (
          <motion.span
            key={g.name}
            className={cn(
              "absolute font-calligraphy leading-none transition-colors duration-700",
              // 窄屏卡片只有半屏宽：只留第一排前三个字，拉开间距、缩小字号
              (g.index >= 3 || g.row === 1) && "max-md:hidden",
              "left-(--gl-m) md:left-(--gl) [--gs:0.75] md:[--gs:1]",
              g.strong
                ? "text-(--tone)"
                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300",
            )}
            style={
              {
                "--gl": `${g.left}%`,
                "--gl-m": `${48 + g.index * 16}%`,
                top: `${g.top}%`,
                fontSize: `calc(${g.size}rem * var(--gs))`,
              } as React.CSSProperties
            }
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: [0, 0.9, 0.9, 0],
              y: [8, 0, -g.drift, -g.drift - 6],
            }}
            transition={{
              duration: g.duration,
              times: [0, 0.2, 0.75, 1],
              ease: "easeInOut",
              repeat: Infinity,
              delay: g.delay,
            }}
          >
            {g.name}
          </motion.span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-2/3 bg-linear-to-r from-white/90 via-white/60 to-transparent dark:from-slate-900/90 dark:via-slate-900/50" />
      <TileText
        eyebrow="专题 · 意象词云"
        title="意象"
        desc="词里反复写到的那些字"
      />
    </Link>
  );
}

export default function FeatureTiles({
  imagery,
}: {
  imagery: { name: string; count: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-5">
      <StoryTile />
      <ImageryTile imagery={imagery} />
    </div>
  );
}
