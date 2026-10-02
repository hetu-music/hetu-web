"use client";

import VerticalExcerpt from "@/components/shared/VerticalExcerpt";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

// 别卷：站内另外几处可读的地方。新增入口只需在此添加一项，文案见 library.hero.featureEntrances
const FEATURE_ENTRANCES = [
  { id: "qjtx", href: "/story/qjtx" },
  { id: "imagery", href: "/imagery" },
  // 寻曲测验内测中，暂不开放入口；上线时取消注释
  // { id: "quiz", href: "/quiz" },
] as const;

/** 扉页：眉题、题名、题词与别卷，排法同歌曲页卷首 */
export default function HeroSection({ songCount }: { songCount: number }) {
  const t = useTranslations("library.hero");
  const motto = t("defaultDesc");
  // 竖排时按逗号分列，每一列是一个短语
  const mottoColumns = motto.split(/[，,\s]+/).filter(Boolean);

  return (
    <header className="relative pb-16 md:pb-20 lg:min-h-104 lg:flex lg:flex-col lg:justify-end">
      <div className="min-w-0 lg:pr-48">
        <p className="text-xs tracking-[0.35em] text-(--tone) mb-5">
          {t("eyebrow", { count: songCount })}
        </p>

        <h2 className="font-serif text-5xl md:text-6xl xl:text-7xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 text-balance">
          {t("title")}
        </h2>

        {/* 窄屏放不下竖排，题词横排在题名下面 */}
        <p className="lg:hidden mt-6 font-kaiti text-[15px] leading-[2.05] text-slate-600 dark:text-slate-400">
          {motto}……
        </p>

        <dl className="mt-10 flex items-baseline gap-6">
          <dt className="shrink-0 text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {t("otherVolumes")}
          </dt>
          <dd className="min-w-0">
            <ul className="flex flex-wrap gap-x-10 gap-y-4">
              {FEATURE_ENTRANCES.map((feature) => (
                <li key={feature.id}>
                  <Link href={feature.href} className="group block">
                    <span className="font-serif text-[15px] tracking-wider text-slate-800 dark:text-slate-200 group-hover:text-(--tone) transition-colors">
                      {t(`featureEntrances.${feature.id}.label`)}
                    </span>
                    <span className="mt-1 block font-kaiti text-sm text-slate-400 dark:text-slate-500">
                      {t(`featureEntrances.${feature.id}.desc`)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </div>

      <VerticalExcerpt
        columns={mottoColumns}
        className="hidden lg:flex absolute right-0 top-0"
      />
    </header>
  );
}
