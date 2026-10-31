"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import type { SongCollation } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * 管理员录的两种东西，同存一表：
 * - 校记：挂在某句歌词上（口误、异唱等），小字写在那一句下面，像古书行间的校语；
 * - 补遗：记在整首歌上的资料（各版本的发布时间、废弃的文案），在创作手记之后单成一节。
 * 都与评点分开：评点在左栏，这两样不进评点。
 */

/** 类型：与后台的标签同一种灰框，不抢正文和落款的强调色 */
const KIND_TAG_CLASS =
  "inline-flex shrink-0 items-center rounded border border-slate-200 dark:border-slate-700 px-1.5 font-sans text-[11px] leading-5 tracking-normal text-slate-500 dark:text-slate-400";

/** 落款里的「校」「辑」「订」：强调色细框小字。宽字距在末字后多留的 0.1em 从右内边距里扣掉，字在框里居中 */
const VERB_TAG_CLASS =
  "inline-block rounded-sm px-1 pr-[calc(0.25rem-0.1em)] ring-1 ring-current text-[11px] leading-4 tracking-[0.1em] text-(--tone)";

function verbTag(chunks: ReactNode) {
  return <span className={VERB_TAG_CLASS}>{chunks}</span>;
}

/** 落款：校记署「某某 校」，补遗署「某某 辑」；别人改过再加「某某 订」 */
function Signature({
  collation: c,
  verb,
}: {
  collation: SongCollation;
  verb: "collator" | "compiler";
}) {
  const t = useTranslations("song.folio");
  const name = c.collator || t("collations.anonymous");
  return (
    <>
      {verb === "collator"
        ? t.rich("collations.collator", { name, v: verbTag })
        : t.rich("supplements.compiler", { name, v: verbTag })}
      {c.reviser && (
        <>
          {" · "}
          {t.rich("collations.reviser", { name: c.reviser, v: verbTag })}
        </>
      )}
    </>
  );
}

/**
 * 句下小字：比歌词小一号的楷体。缩进按歌词的字号取 1em，正好比歌词退一个字；
 * 类型用灰框字，折行时正文与首行正文对齐，不钻到框字底下；落款灰字跟在后面
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
        <div key={c.id} className="flex items-baseline gap-2">
          <span className={KIND_TAG_CLASS}>
            {t(`kinds.${c.kind as "slip" | "sung" | "version" | "note"}`)}
          </span>
          <p className="min-w-0 flex-1 font-kaiti text-sm leading-[1.8] text-slate-600 dark:text-slate-400 wrap-break-word">
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
            <p className="flex items-baseline gap-3">
              <span className={KIND_TAG_CLASS}>
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
              <Signature collation={c} verb="compiler" />
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
