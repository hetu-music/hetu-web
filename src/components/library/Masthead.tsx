"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

// 别卷：站内另外几处可读的地方。新增入口只需在此添加一项，文案见 library.hero.featureEntrances
const FEATURE_ENTRANCES = [
  { id: "qjtx", href: "/story/qjtx" },
  { id: "imagery", href: "/imagery" },
  // 寻曲测验内测中，暂不开放入口；上线时取消注释
  // { id: "quiz", href: "/quiz" },
] as const;

/**
 * 刊头：题名、首数、题词与别卷。
 * 封面墙里它是开头一大块字，与年份字块一样嵌在封面之间；目录视图里单独放在最上面。
 */
export default function Masthead({
  songCount,
  className,
}: {
  songCount: number;
  className?: string;
}) {
  const t = useTranslations("library.hero");

  return (
    <header className={cn("flex flex-col justify-between gap-8", className)}>
      <div>
        <p className="text-xs tracking-[0.35em] text-(--tone) transition-colors duration-1000">
          {t("eyebrow", { count: songCount })}
        </p>
        <h2 className="mt-4 font-serif text-6xl xl:text-7xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
          {t("title")}
        </h2>
        <p className="mt-5 font-kaiti text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t("defaultDesc")}……
        </p>
      </div>

      <dl className="flex items-baseline gap-5">
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
    </header>
  );
}
