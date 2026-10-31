"use client";

import { useState } from "react";
import type { MotifOption } from "@/lib/imagery/word-motifs";
import { cn } from "@/lib/utils/utils";

/**
 * 选母题的下拉框，标注编辑、预标注审核、母题页共用。
 *
 * 默认只列这个词登记的母题（默认母题打头）和当前值，最后一项「其他母题…」展开全部：
 * 语境由标注者判断，但只在登记的候选里选（见 IMAGERY.md）。选了登记之外的，保存时登记为多义候选。
 * 没登记过的词直接列全部。换了词要用 key 重新挂载，收回展开状态。
 */
export default function MotifSelect({
  candidateIds,
  value,
  motifs,
  onChange,
  placeholder = "选择母题…",
  hint = false,
  className,
  "aria-label": ariaLabel = "母题",
}: {
  /** 这个词登记的母题，第一个为默认 */
  candidateIds: readonly number[];
  value: number | null;
  /** 全部母题，已排好序 */
  motifs: readonly MotifOption[];
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** 选了这个词可选范围之外的母题时，在下方提示保存后会加一个「有时也指」 */
  hint?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || candidateIds.length === 0;
  const labelOf = (id: number) =>
    motifs.find((m) => m.id === id)?.label ?? `母题 #${id}`;
  const options: MotifOption[] = showAll
    ? [...motifs]
    : [...new Set([...candidateIds, ...(value === null ? [] : [value])])].map(
        (id) => ({
          id,
          label:
            labelOf(id) +
            (id === candidateIds[0]
              ? "（通常）"
              : candidateIds.includes(id)
                ? ""
                : "（新的意思）"),
        }),
      );
  const offCandidate =
    candidateIds.length > 0 && value !== null && !candidateIds.includes(value);

  return (
    <>
      <select
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "__all") {
            setExpanded(true);
            return;
          }
          onChange(e.target.value ? Number(e.target.value) : null);
        }}
        className={cn("max-w-full", className)}
      >
        {value === null && <option value="">{placeholder}</option>}
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
        {!showAll && <option value="__all">其他母题…</option>}
      </select>
      {hint && offCandidate && (
        <span className="block text-xs text-slate-400 dark:text-slate-500">
          这个词以前没这样标过，保存后会给它加一个「有时也指」
        </span>
      )}
    </>
  );
}
