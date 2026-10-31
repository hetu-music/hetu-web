"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import type { SongCollation } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

/**
 * 管理员录的两种东西，同存一表：
 * - 校记：挂在某句歌词上（口误、异唱等），小字写在那一句下面，像古书行间的校语；
 * - 补遗：记在整首歌上的资料（各版本的发布时间、废弃的文案），在创作手记之后单成一节。
 * 都与评点分开：评点在左栏，这两样不进评点。
 */

/** 落款：校记署「某某 校」，补遗署「某某 辑」；别人改过再加「某某 订」 */
function useSignature(verb: "collator" | "compiler") {
  const t = useTranslations("song.folio");
  return (c: SongCollation) => {
    const name = c.collator || t("collations.anonymous");
    const by =
      verb === "collator"
        ? t("collations.collator", { name })
        : t("supplements.compiler", { name });
    return c.reviser
      ? `${by} · ${t("collations.reviser", { name: c.reviser })}`
      : by;
  };
}

/** 句下小字：比歌词小一号的楷体，缩进；类型用强调色，落款灰字跟在后面 */
export function LineCollations({
  collations,
  className,
}: {
  collations: SongCollation[];
  className?: string;
}) {
  const t = useTranslations("song.folio.collations");
  const signature = useSignature("collator");
  return (
    <div className={cn("pl-4 pb-2 space-y-0.5", className)}>
      {collations.map((c) => (
        <p
          key={c.id}
          className="font-kaiti text-sm leading-[1.8] text-slate-600 dark:text-slate-400 wrap-break-word"
        >
          <span className="mr-2 font-sans text-xs tracking-widest text-(--tone)">
            {t(`kinds.${c.kind as "slip" | "sung" | "version" | "note"}`)}
          </span>
          {c.quote && c.sung && t("sungAs", { quote: c.quote, sung: c.sung })}
          {c.body}
          <span className="ml-3 font-sans text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {signature(c)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** 补遗：一条条按日期排，正文是人写的话，用楷体、保留原有的分段 */
export function SupplementsSection({
  supplements,
}: {
  supplements: SongCollation[];
}) {
  const t = useTranslations("song.folio");
  const signature = useSignature("compiler");
  return (
    <section id="supplements" className="py-16 md:py-20">
      <SectionHeading label={t("sections.supplements")} />
      <ol className="mt-12 lg:ml-[26rem] max-w-[40em] space-y-10">
        {supplements.map((c) => (
          <li key={c.id}>
            <p className="flex items-baseline gap-3">
              <span className="text-xs tracking-widest text-(--tone)">
                {t(
                  `supplements.kinds.${c.kind as "release" | "draft" | "note"}`,
                )}
              </span>
              {c.date && (
                <span className="text-xs tracking-wider tabular-nums text-slate-400 dark:text-slate-500">
                  {c.date}
                </span>
              )}
            </p>
            <p className="mt-2 font-kaiti text-base sm:text-[17px] leading-[2.05] text-slate-700 dark:text-slate-300 whitespace-pre-line wrap-break-word">
              {c.body}
            </p>
            <p className="mt-1 text-right text-xs tracking-wider text-slate-400 dark:text-slate-500">
              {signature(c)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
