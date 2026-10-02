"use client";

import VerticalExcerpt from "@/components/shared/VerticalExcerpt";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import type React from "react";

// 别卷：站内另外几处可读的地方。新增入口只需在此添加一项，文案见 library.hero.featureEntrances
const FEATURE_ENTRANCES = [
  { id: "qjtx", href: "/story/qjtx" },
  { id: "imagery", href: "/imagery" },
  // 寻曲测验内测中，暂不开放入口；上线时取消注释
  // { id: "quiz", href: "/quiz" },
] as const;

/** 刊头开场：题名逐字升起后，其余几行依次淡入 */
const TITLE_STAGGER_MS = 140;
const fadeIn = (delayMs: number): React.CSSProperties => ({
  animationDelay: `${delayMs}ms`,
});
const FADE_CLASS =
  "animate-in fade-in slide-in-from-bottom-1 duration-1000 ease-page fill-mode-both motion-reduce:animate-none";

/**
 * 刊头：题名、首数、题词与别卷。
 * hall：近赏的开场，大字题名从遮罩里升起，右侧竖排题词；
 * tile：远观时嵌在墙里的一大块字；目录视图也用它。
 */
export default function Masthead({
  songCount,
  variant,
  className,
}: {
  songCount: number;
  variant: "hall" | "tile";
  className?: string;
}) {
  const t = useTranslations("library.hero");
  const hall = variant === "hall";
  const title = t("title");
  const motto = t("defaultDesc");
  const titleDone = Array.from(title).length * TITLE_STAGGER_MS + 500;

  return (
    <header
      className={cn(
        "relative flex flex-col justify-between",
        hall ? "gap-14 lg:min-h-[26rem] lg:justify-end" : "gap-8",
        className,
      )}
    >
      <div className={cn(hall && "lg:pr-48")}>
        <p
          className={cn(
            "text-xs tracking-[0.35em] text-(--tone) transition-colors duration-1000",
            hall && FADE_CLASS,
          )}
          style={hall ? fadeIn(200) : undefined}
        >
          {t("eyebrow", { count: songCount })}
        </p>
        <h2
          aria-label={title}
          className={cn(
            "font-serif font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50",
            hall
              ? "mt-6 text-7xl md:text-8xl xl:text-9xl"
              : "mt-4 text-6xl xl:text-7xl",
          )}
        >
          {hall
            ? Array.from(title).map((char, i) => (
                // 每个字一层遮罩，字从遮罩下沿升上来
                <span
                  key={i}
                  aria-hidden
                  className="inline-block overflow-hidden pb-[0.08em] align-bottom"
                >
                  <span
                    className="hall-rise"
                    style={
                      {
                        "--rise-delay": `${300 + i * TITLE_STAGGER_MS}ms`,
                      } as React.CSSProperties
                    }
                  >
                    {char}
                  </span>
                </span>
              ))
            : title}
        </h2>
        <p
          className={cn(
            "font-kaiti leading-relaxed text-slate-600 dark:text-slate-400",
            hall ? "mt-8 text-lg lg:hidden" : "mt-5 text-[15px]",
            hall && FADE_CLASS,
          )}
          style={hall ? fadeIn(titleDone) : undefined}
        >
          {motto}……
        </p>
      </div>

      <dl
        className={cn("flex items-baseline gap-5", hall && FADE_CLASS)}
        style={hall ? fadeIn(titleDone + 300) : undefined}
      >
        <dt className="shrink-0 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {t("otherVolumes")}
        </dt>
        <dd className="min-w-0">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {FEATURE_ENTRANCES.map((feature) => (
              <li key={feature.id}>
                <Link
                  href={feature.href}
                  className="group inline-flex items-baseline gap-2"
                >
                  <span className="font-serif text-[15px] tracking-wider text-slate-800 dark:text-slate-200 group-hover:text-(--tone) transition-colors">
                    {t(`featureEntrances.${feature.id}.label`)}
                  </span>
                  <span className="hidden sm:inline font-kaiti text-sm text-slate-400 dark:text-slate-500">
                    {t(`featureEntrances.${feature.id}.desc`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </dl>

      {hall && (
        <div
          className={cn("hidden lg:block absolute right-0 top-0", FADE_CLASS)}
          style={fadeIn(titleDone - 200)}
        >
          <VerticalExcerpt columns={motto.split(/[，,\s]+/).filter(Boolean)} />
        </div>
      )}
    </header>
  );
}
