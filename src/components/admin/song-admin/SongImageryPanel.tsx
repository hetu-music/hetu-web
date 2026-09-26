"use client";

import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { ImagerySuggestion } from "@/lib/imagery/suggest";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import type { CategoryOption } from "@/lib/server/service-imagery-suggest";
import { cn } from "@/lib/utils/utils";
import { type SuggestionDraft, useSongImagery } from "./useSongImagery";

function CategorySelect({
  suggestion,
  value,
  categories,
  labelById,
  onChange,
}: {
  suggestion: ImagerySuggestion;
  value: number | null;
  categories: CategoryOption[];
  labelById: Map<number, string>;
  onChange: (id: number | null) => void;
}) {
  // 全部叶子分类有数百项，逐行渲染会拖慢列表；默认只列该意象用过的分类
  const [showAll, setShowAll] = useState(suggestion.categoryIds.length === 0);
  const options = showAll
    ? categories
    : suggestion.categoryIds.map((id) => ({
        id,
        label: labelById.get(id) ?? `分类 #${id}`,
      }));

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__all") {
          setShowAll(true);
          return;
        }
        onChange(e.target.value ? Number(e.target.value) : null);
      }}
      className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      {value === null && <option value="">选择分类…</option>}
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
      {!showAll && <option value="__all">其他分类…</option>}
    </select>
  );
}

function SuggestionRow({
  suggestion,
  draft,
  categories,
  labelById,
  onUpdate,
  onToggleTag,
}: {
  suggestion: ImagerySuggestion;
  draft: SuggestionDraft;
  categories: CategoryOption[];
  labelById: Map<number, string>;
  onUpdate: (patch: Partial<SuggestionDraft>) => void;
  onToggleTag: (tag: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        draft.checked
          ? "border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-900/10"
          : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/40",
      )}
    >
      <input
        type="checkbox"
        checked={draft.checked}
        onChange={(e) => onUpdate({ checked: e.target.checked })}
        className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
        aria-label={`标注「${suggestion.name}」`}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {suggestion.name}
          </span>
          <span
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            title="其他已标注歌曲中：歌词出现该意象的歌曲里，有多少首标注了它"
          >
            {suggestion.seen > 0
              ? `历史 ${suggestion.annotated}/${suggestion.seen}`
              : "无历史"}
          </span>
          <CategorySelect
            suggestion={suggestion}
            value={draft.categoryId}
            categories={categories}
            labelById={labelById}
            onChange={(categoryId) => onUpdate({ categoryId })}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestion.timetags.map((tag, i) => {
            const excluded = draft.excludedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                title={excluded ? "点击恢复" : "点击排除这一处"}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-left text-xs transition-colors",
                  excluded
                    ? "border-dashed border-slate-200 text-slate-400 line-through dark:border-slate-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                )}
              >
                <span className="mr-1.5 font-mono text-[10px] text-slate-400">
                  {tag}
                </span>
                {suggestion.lines[i]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 歌曲管理展开行中的意象标注区：已有标注一览 + 从歌词生成候选并审核保存 */
export default function SongImageryPanel({
  songId,
  csrfToken,
}: {
  songId: number;
  csrfToken: string;
}) {
  const imagery = useSongImagery(songId, csrfToken);
  const { existing, result, drafts } = imagery;

  const labelById = useMemo(
    () => new Map((result?.categories ?? []).map((c) => [c.id, c.label])),
    [result],
  );
  const suggestions = result?.suggestions ?? [];
  const recommended = suggestions.filter((s) => s.recommended);
  const others = suggestions.filter((s) => !s.recommended);
  const canSave = Boolean(result?.published) && imagery.selectedCount > 0;

  const renderRows = (list: ImagerySuggestion[]) =>
    list.map((s) => (
      <SuggestionRow
        key={s.imageryId}
        suggestion={s}
        draft={drafts[s.imageryId]}
        categories={result?.categories ?? []}
        labelById={labelById}
        onUpdate={(patch) => imagery.updateDraft(s.imageryId, patch)}
        onToggleTag={(tag) => imagery.toggleTag(s.imageryId, tag)}
      />
    ));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            意象标注
          </h4>
          {existing && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              已标注 {existing.length} 个
            </span>
          )}
          {existing && existing.length < MIN_OCCURRENCES && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              少于 {MIN_OCCURRENCES} 个不会进入寻曲测验
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/imagery"
            className="text-xs text-slate-400 hover:text-blue-600"
          >
            编辑已有标注
          </Link>
          <button
            type="button"
            onClick={imagery.generate}
            disabled={imagery.generating}
            className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {imagery.generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {result ? "重新生成候选" : "从歌词生成候选"}
          </button>
        </div>
      </div>

      {existing && existing.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {existing.map((o) => (
            <span
              key={o.id}
              title={o.category_name}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {o.imagery_name ?? `#${o.imagery_id}`}
            </span>
          ))}
        </div>
      )}

      {imagery.message && (
        <p
          className={cn(
            "mt-3 text-sm",
            imagery.message.type === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {imagery.message.text}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {!result.published && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/10 dark:text-amber-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              歌曲尚未发布，可以先预览候选；发布后才能保存标注。
            </div>
          )}
          {!result.hasLyrics ? (
            <p className="text-sm text-slate-400">
              这首歌还没有歌词，无法生成候选。
            </p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-slate-400">
              歌词中没有找到词典里尚未标注的意象。新意象请先在意象管理中添加。
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  推荐 {recommended.length} 个（按历史标注率默认勾选）
                </span>
                {recommended.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      imagery.setChecked(
                        recommended.map((s) => s.imageryId),
                        !recommended.every((s) => drafts[s.imageryId].checked),
                      )
                    }
                    className="hover:text-blue-600"
                  >
                    全选 / 全不选
                  </button>
                )}
              </div>
              <div className="space-y-2">{renderRows(recommended)}</div>

              {others.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600">
                    其他候选 {others.length} 个（历史上很少被标注，默认不勾选）
                  </summary>
                  <div className="mt-2 space-y-2">{renderRows(others)}</div>
                </details>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-sm text-slate-500">
                  已选 {imagery.selectedCount} 个
                </span>
                <button
                  type="button"
                  onClick={imagery.save}
                  disabled={!canSave || imagery.saving}
                  className="flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {imagery.saving && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  保存选中
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
