"use client";

import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import React, { useEffect, useId, useRef, useState } from "react";

/**
 * 版记里的一栏署名。别署照录原署，下加虚线；悬停、键盘聚焦或点按时，
 * 在整栏下方展开一行注，说明即是谁。
 *
 * 注放在栏下而不浮在名字旁：演唱一栏常有几十个名字折成多行，
 * 浮层无论放哪都会盖住别的名字。
 *
 * 点按要靠自己的状态：iOS Safari 点按钮不会让它获得焦点，
 * 也等不到 blur，所以点别处收起要自己监听。
 */
export default function CreditNames({
  names,
  aliasOf,
}: {
  names: string[];
  aliasOf: Record<string, string>;
}) {
  const t = useTranslations("song");
  const noteId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  // 悬停只管临时显示；点按、键盘聚焦会钉住，直到再点一次或离开
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = pinned ?? hovered;
  // 收起的动画里注文还要留着，不能跟着 active 立刻变空
  const [shown, setShown] = useState<string | null>(null);
  if (active && active !== shown) setShown(active);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPinned(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);

  return (
    <span ref={rootRef} className="block">
      {names.map((name, i) => (
        <React.Fragment key={name}>
          {i > 0 && " "}
          {aliasOf[name] ? (
            <button
              type="button"
              aria-describedby={active === name ? noteId : undefined}
              aria-expanded={active === name}
              onClick={() => setPinned((p) => (p === name ? null : name))}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) setPinned(name);
              }}
              onBlur={() => setPinned((p) => (p === name ? null : p))}
              onKeyDown={(e) => e.key === "Escape" && setPinned(null)}
              className={cn(
                // _ _ _ 式虚线：用重复渐变画，线段与间隔都可控，不依赖浏览器的 dashed；
                // 画在字框底边，紧贴下伸部，不另加留白
                "cursor-help bg-bottom bg-no-repeat bg-size-[100%_1px] bg-[repeating-linear-gradient(to_right,var(--dash)_0_4px,transparent_4px_7px)] transition-colors duration-300 focus-visible:outline-none",
                active === name
                  ? "[--dash:var(--tone)] text-(--tone)"
                  : "[--dash:color-mix(in_oklab,var(--tone)_45%,transparent)]",
              )}
            >
              {name}
            </button>
          ) : (
            name
          )}
        </React.Fragment>
      ))}

      <span
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          active ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <span className="overflow-hidden">
          <span
            id={noteId}
            role="note"
            className={cn(
              "block pt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500 transition-opacity duration-300",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            {shown &&
              t.rich("folio.aliasOf", {
                alias: shown,
                name: aliasOf[shown],
                em: (chunks) => (
                  <span className="text-slate-600 dark:text-slate-300">
                    {chunks}
                  </span>
                ),
              })}
          </span>
        </span>
      </span>
    </span>
  );
}
