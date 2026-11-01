"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import type { SongCollation } from "@/lib/types";
import { cn, toChineseNumeral } from "@/lib/utils/utils";
import { summarizeRevisers } from "@/lib/utils/utils-collations";
import { useTranslations } from "next-intl";

/**
 * 管理员录的两种东西，同存一表：
 * - 校记：挂在某句歌词上（口误、异唱等），小字写在那一句下面，像古书行间的校语；
 * - 补遗：记在整首歌上的资料（各版本的发布时间、废弃的文案），在创作手记之后单成一节。
 * 都与评点分开：评点在左栏，这两样不进评点。
 *
 * 类型写成强调色的〔口误〕，是一行里唯一的颜色；不加框：框像应用里的徽章，
 * 六角括号是书上标注的写法，和引原文的「」形状也不同。落款是灰色小字，最不显眼。
 */

/** 类型的括号是排版的一部分，简繁相同，不进文案 */
function KindHead({ label, className }: { label: string; className?: string }) {
  // 括号随校语用楷体，楷体的括号自带空隙，不贴字；括号里的类型是编者加的标目，
  // 用加粗的衬线体、略小，与章节题头同一种字，和楷体写的「人话」分开。
  // 括号不加粗：楷体没有粗体，浏览器硬描出来的粗会糊。
  // 字距在末字后多出的 0.1em 用负边距收回，免得右括号离得比左括号远
  return (
    <span className={cn("font-kaiti text-(--tone)", className)}>
      〔
      <span className="font-serif font-semibold text-[0.92em] tracking-[0.1em] -mr-[0.1em]">
        {label}
      </span>
      〕
    </span>
  );
}

/**
 * 落款：校记署「某某 校」，补遗署「某某 辑」；别人改过再加「乙、丙 订」。
 * 订者超过三人只写首尾，如「乙、戊等四人 订」，全部名字放在悬停提示里
 */
function Signature({
  collation: c,
  verb,
}: {
  collation: SongCollation;
  verb: "collator" | "compiler";
}) {
  const t = useTranslations("song.folio");
  const name = c.collator || t("collations.anonymous");
  const by =
    verb === "collator"
      ? t("collations.collator", { name })
      : t("supplements.compiler", { name });
  const revisers = summarizeRevisers(c.revisers);
  if (!revisers) return by;
  if (revisers.count === null) {
    return `${by} · ${t("collations.reviser", { name: revisers.names })}`;
  }
  return (
    <>
      {by} ·{" "}
      <span title={c.revisers.join("、")}>
        {t("collations.revisersMany", {
          names: revisers.names,
          count: toChineseNumeral(revisers.count),
        })}
      </span>
    </>
  );
}

/**
 * 句下小字：比歌词小一号的楷体，灰度浅一档。缩进按歌词的字号取 1em，正好比歌词退一个字；
 * 类型单占一列，折行时校语与首行校语对齐，不钻到类型底下
 */
export function LineCollations({
  collations,
  className,
}: {
  collations: SongCollation[];
  className?: string;
}) {
  const t = useTranslations("song.folio.collations");
  return (
    <div
      className={cn(
        "pl-[1em] pb-2 space-y-1 text-[17px] sm:text-lg",
        className,
      )}
    >
      {collations.map((c) => (
        <div key={c.id} className="flex items-baseline text-sm leading-[1.8]">
          <KindHead
            label={t(`kinds.${c.kind as "slip" | "sung" | "version" | "note"}`)}
            className="shrink-0"
          />
          <p className="min-w-0 flex-1 font-kaiti text-slate-600 dark:text-slate-400 wrap-break-word">
            {c.quote && c.sung && t("sungAs", { quote: c.quote, sung: c.sung })}
            {c.body}
            <span className="ml-3 font-sans text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
              <Signature collation={c} verb="collator" />
            </span>
          </p>
        </div>
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
  return (
    <section id="supplements" className="py-16 md:py-20">
      <SectionHeading label={t("sections.supplements")} />
      <ol className="mt-12 lg:ml-[26rem] max-w-[40em] space-y-10">
        {supplements.map((c) => (
          <li key={c.id}>
            <p className="flex items-baseline gap-2">
              <KindHead
                label={t(
                  `supplements.kinds.${c.kind as "release" | "draft" | "note"}`,
                )}
                className="text-[15px]"
              />
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
              <Signature collation={c} verb="compiler" />
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
