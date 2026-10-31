"use client";

import SectionHeading from "@/components/detail/SectionHeading";
import type { SongCollation } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import type { ResolvedCollation } from "@/lib/utils/utils-collations";
import { useTranslations } from "next-intl";

/**
 * 校记：管理员写在某句歌词上的勘误。正文里用小字写在所校那一句下面，
 * 像古书行间的校语；卷末另有校勘记一节把全部校记按行列出，点原句跳回正文。
 * 与评点分开：评点在左栏，校记在句下，不混在一处。
 */

/** 落点处淡淡亮一下（globals.css 的 collation-flash），好让眼睛找到 */
function flash(el: Element) {
  el.classList.remove("collation-flash");
  // 强制回流，连点两次时动画能从头再放
  void (el as HTMLElement).offsetWidth;
  el.classList.add("collation-flash");
  el.addEventListener(
    "animationend",
    () => el.classList.remove("collation-flash"),
    { once: true },
  );
}

/**
 * 滚到所校的那一句，离视口顶部约三成处，与题签跳到意象首句的位置一致。
 * LRC 模式下没有逐行的正文，退回到歌词一节的开头
 */
function scrollToLine(line: number) {
  const lyrics = document.getElementById("lyrics");
  if (!lyrics) return;
  const el = lyrics.querySelectorAll("[data-folio-line]")[line] ?? lyrics;
  const top =
    el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
  window.scrollTo({ top, behavior: "smooth" });
  flash(el);
}

/** 校语：「苍山」唱作「沧山」。再接说明 */
function useCollationText() {
  const t = useTranslations("song.folio.collations");
  return {
    kind: (c: SongCollation) => t(`kinds.${c.kind}`),
    text: (c: SongCollation) =>
      `${c.quote && c.sung ? t("sungAs", { quote: c.quote, sung: c.sung }) : ""}${c.body}`,
    signature: (c: SongCollation) =>
      `${t("collator", { name: c.collator || t("anonymous") })}${
        c.reviser ? ` · ${t("reviser", { name: c.reviser })}` : ""
      }`,
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
  const { kind, text, signature } = useCollationText();
  return (
    <div className={cn("pl-4 pb-2 space-y-0.5", className)}>
      {collations.map((c) => (
        <p
          key={c.id}
          className="font-kaiti text-sm leading-[1.8] text-slate-600 dark:text-slate-400 wrap-break-word"
        >
          <span className="mr-2 font-sans text-xs tracking-widest text-(--tone)">
            {kind(c)}
          </span>
          {text(c)}
          <span className="ml-3 font-sans text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {signature(c)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** 校勘记：全部校记按行列出，排在创作手记之后、正文之前 */
export function CollationsSection({
  entries,
}: {
  entries: ResolvedCollation[];
}) {
  const t = useTranslations("song.folio");
  const { kind, text, signature } = useCollationText();
  return (
    <section id="collations" className="py-16 md:py-20">
      <SectionHeading label={t("sections.collations")} />
      <ol className="mt-12 lg:ml-[26rem] max-w-[40em] space-y-7">
        {entries.map(({ collation: c, line }) => (
          <li key={c.id}>
            <p className="flex items-baseline gap-3">
              <span className="shrink-0 text-xs tracking-widest text-(--tone)">
                {kind(c)}
              </span>
              {line !== null ? (
                <button
                  type="button"
                  onClick={() => scrollToLine(line)}
                  title={t("collations.jump")}
                  className="min-w-0 text-left font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 hover:text-(--tone) dark:hover:text-(--tone) transition-colors wrap-break-word"
                >
                  {c.anchorQuote}
                </button>
              ) : (
                <span className="min-w-0 font-serif text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 wrap-break-word">
                  {c.anchorQuote}
                  <span className="ml-2 font-sans text-xs text-slate-400 dark:text-slate-500">
                    {t("collations.orphan")}
                  </span>
                </span>
              )}
            </p>
            <p className="mt-1.5 font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 wrap-break-word">
              {text(c)}
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
