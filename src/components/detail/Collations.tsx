"use client";

import { cn } from "@/lib/utils/utils";
import type { ResolvedCollation } from "@/lib/utils/utils-collations";
import { useTranslations } from "next-intl";

/**
 * 校勘记：管理员写在某句歌词上的勘误。正文里所校的句子末尾挂一个「校」，
 * 校记本身集中列在创作手记一节，像书末的校勘记；两边点了互相跳转。
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

/** 滚到离视口顶部约三成处，与题签跳到意象首句的位置一致 */
function scrollAndFlash(el: Element) {
  const top =
    el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
  window.scrollTo({ top, behavior: "smooth" });
  flash(el);
}

function scrollToCollation(id: number) {
  const el = document.querySelector(`[data-collation="${id}"]`);
  if (el) scrollAndFlash(el);
}

/** LRC 模式下没有逐行的正文，退回到歌词一节的开头 */
function scrollToLine(line: number) {
  const lyrics = document.getElementById("lyrics");
  if (!lyrics) return;
  const row = lyrics.querySelectorAll("[data-folio-line]")[line];
  scrollAndFlash(row ?? lyrics);
}

/** 句末的「校」：与窄屏批注的条数标记同一种上标，用字而不用数字区分开 */
export function CollationMarker({ id }: { id: number }) {
  const t = useTranslations("song.folio.collations");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        scrollToCollation(id);
      }}
      aria-label={t("markerLabel")}
      className="relative -top-[0.6em] ml-1 px-0.5 font-kaiti text-[11px] leading-none text-(--tone) hover:opacity-70 transition-opacity"
    >
      {t("marker")}
    </button>
  );
}

export function CollationList({
  entries,
  className,
}: {
  entries: ResolvedCollation[];
  className?: string;
}) {
  const t = useTranslations("song.folio.collations");
  return (
    <ol className={cn("space-y-7", className)}>
      {entries.map(({ collation: c, line }) => (
        // 负边距留出亮起时的底色范围，文字仍与正文对齐
        <li
          key={c.id}
          data-collation={c.id}
          className="-mx-3 px-3 py-1.5 rounded-md"
        >
          <p className="flex items-baseline gap-3">
            <span className="shrink-0 text-xs tracking-widest text-(--tone)">
              {t(`kinds.${c.kind}`)}
            </span>
            {line !== null ? (
              <button
                type="button"
                onClick={() => scrollToLine(line)}
                title={t("jump")}
                className="min-w-0 text-left font-serif text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 hover:text-(--tone) dark:hover:text-(--tone) transition-colors wrap-break-word"
              >
                {c.anchorQuote}
              </button>
            ) : (
              <span className="min-w-0 font-serif text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 wrap-break-word">
                {c.anchorQuote}
                <span className="ml-2 font-sans text-xs text-slate-400 dark:text-slate-500">
                  {t("orphan")}
                </span>
              </span>
            )}
          </p>
          <p className="mt-1.5 font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 wrap-break-word">
            {c.quote && c.sung && t("sungAs", { quote: c.quote, sung: c.sung })}
            {c.body}
          </p>
          <p className="mt-1 text-right text-xs tracking-wider text-slate-400 dark:text-slate-500">
            {t("collator", { name: c.collator || t("anonymous") })}
            {c.reviser && ` · ${t("reviser", { name: c.reviser })}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
