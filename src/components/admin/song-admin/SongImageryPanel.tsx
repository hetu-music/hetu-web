"use client";

import {
  AlertCircle,
  Bot,
  Loader2,
  Pencil,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  type ImagerySuggestion,
  RECOMMEND_THRESHOLD,
} from "@/lib/imagery/suggest";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import type {
  CategoryOption,
  DictionaryOption,
} from "@/lib/server/service-imagery-suggest";
import { cn } from "@/lib/utils/utils";
import {
  type AiNote,
  type SuggestionDraft,
  useSongImagery,
} from "./useSongImagery";

function CategorySelect({
  categoryIds,
  value,
  categories,
  labelById,
  onChange,
}: {
  /** 该意象用过的分类 */
  categoryIds: number[];
  value: number | null;
  categories: CategoryOption[];
  labelById: Map<number, string>;
  onChange: (id: number | null) => void;
}) {
  // 全部叶子分类有数百项，逐行渲染会拖慢列表；默认只列该意象用过的分类和当前值
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || (categoryIds.length === 0 && value === null);
  const options = showAll
    ? categories
    : [...new Set([...categoryIds, ...(value === null ? [] : [value])])].map(
        (id) => ({ id, label: labelById.get(id) ?? `分类 #${id}` }),
      );

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__all") {
          setExpanded(true);
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

function NameEditor({
  name,
  listId,
  onCommit,
}: {
  name: string;
  listId: string;
  onCommit: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="点击修改意象"
        className="group/name flex items-center gap-1 font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100"
      >
        {name}
        <Pencil
          size={12}
          className="text-slate-300 group-hover/name:text-blue-500"
        />
      </button>
    );
  }

  const finish = (value: string) => {
    setEditing(false);
    if (value.trim() && value.trim() !== name) onCommit(value);
  };
  return (
    <input
      autoFocus
      defaultValue={name}
      list={listId}
      maxLength={50}
      aria-label="意象名"
      onBlur={(e) => finish(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(e.currentTarget.value);
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-28 rounded-md border border-blue-400 bg-white px-2 py-0.5 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-slate-100"
    />
  );
}

/** 历史标注情况：其他已标注的歌里，歌词含这个词的有几首、其中几首标注了它 */
function HistoryBadge({ suggestion }: { suggestion: ImagerySuggestion }) {
  const { name, seen, annotated, rate } = suggestion;
  const threshold = Math.round(RECOMMEND_THRESHOLD * 100);
  const coveredByLonger =
    !suggestion.recommended &&
    suggestion.categoryIds.length > 0 &&
    (rate === null || rate >= RECOMMEND_THRESHOLD);
  const title = [
    rate === null
      ? `其他已标注的歌里，歌词都没有出现「${name}」，无从参考`
      : `其他已标注的歌里，歌词含「${name}」的有 ${seen} 首，其中 ${annotated} 首标注了它（${Math.round(rate * 100)}%）。达到 ${threshold}% 默认勾选`,
    coveredByLonger &&
      `这首歌里「${name}」每次都出现在更长的意象里（如「明月」之于「月」），所以默认不勾选`,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      title={title}
      className="ml-auto shrink-0 text-[11px] text-slate-400 dark:text-slate-500"
    >
      {rate === null
        ? "其他歌未出现"
        : `出现 ${seen} 首 · 标注 ${annotated} 首`}
    </span>
  );
}

function AiChip({ note }: { note: AiNote }) {
  const [label, className] =
    note.kind === "addition"
      ? [
          "AI 补充",
          "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
        ]
      : note.keep
        ? [
            "AI 保留",
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
          ]
        : [
            "AI 剔除",
            "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300",
          ];
  return (
    <span
      title={note.reason}
      className={cn(
        "max-w-[16rem] truncate rounded-full px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      {label}
      {note.reason && ` · ${note.reason}`}
    </span>
  );
}

function SuggestionRow({
  suggestion,
  draft,
  resolved,
  alreadyAnnotated,
  aiNote,
  categories,
  labelById,
  dictionaryListId,
  onUpdate,
  onRename,
  onToggleTag,
}: {
  suggestion: ImagerySuggestion;
  draft: SuggestionDraft;
  /** 当前意象名对应的词典条目；为 null 表示保存时新建 */
  resolved: DictionaryOption | null;
  /** 当前意象该歌已经标注过，保存时会被跳过 */
  alreadyAnnotated: boolean;
  aiNote: AiNote | undefined;
  categories: CategoryOption[];
  labelById: Map<number, string>;
  dictionaryListId: string;
  onUpdate: (patch: Partial<SuggestionDraft>) => void;
  onRename: (name: string) => void;
  onToggleTag: (tag: string) => void;
}) {
  const renamed = draft.name !== suggestion.name;
  const categoryIds =
    renamed && resolved?.categoryIds.length
      ? resolved.categoryIds
      : suggestion.categoryIds;

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
        aria-label={`标注「${draft.name}」`}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <NameEditor
            name={draft.name}
            listId={dictionaryListId}
            onCommit={onRename}
          />
          {renamed && (
            <button
              type="button"
              onClick={() => onRename(suggestion.name)}
              title="恢复原意象"
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600"
            >
              <Undo2 size={11} />
              原：{suggestion.name}
            </button>
          )}
          {!resolved && (
            <span
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
              title="词典中没有这个意象，保存时会新建"
            >
              新意象
            </span>
          )}
          {alreadyAnnotated && (
            <span
              className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600 dark:bg-red-900/20 dark:text-red-300"
              title="这首歌已经标注过该意象，保存时会跳过"
            >
              已标注
            </span>
          )}
          {aiNote && <AiChip note={aiNote} />}
          <CategorySelect
            categoryIds={categoryIds}
            value={draft.categoryId}
            categories={categories}
            labelById={labelById}
            onChange={(categoryId) => onUpdate({ categoryId })}
          />
          {/* 统计的是原候选词；改名后不再适用 */}
          {!renamed && <HistoryBadge suggestion={suggestion} />}
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
  const [othersOpen, setOthersOpen] = useState(false);

  const labelById = useMemo(
    () => new Map((result?.categories ?? []).map((c) => [c.id, c.label])),
    [result],
  );
  const suggestions = result?.suggestions ?? [];
  const recommended = suggestions.filter((s) => s.recommended);
  const others = suggestions.filter((s) => !s.recommended);
  const canSave = Boolean(result?.published) && imagery.selectedCount > 0;

  const dictionaryListId = `imagery-dictionary-${songId}`;

  const renderRows = (list: ImagerySuggestion[]) =>
    list.map((s) => {
      const draft = drafts[s.imageryId];
      const resolved = imagery.resolveName(draft.name);
      return (
        <SuggestionRow
          key={s.imageryId}
          suggestion={s}
          draft={draft}
          resolved={resolved}
          alreadyAnnotated={
            resolved !== null && imagery.existingImageryIds.has(resolved.id)
          }
          aiNote={imagery.aiNotes[s.imageryId]}
          categories={result?.categories ?? []}
          labelById={labelById}
          dictionaryListId={dictionaryListId}
          onUpdate={(patch) => imagery.updateDraft(s.imageryId, patch)}
          onRename={(name) => imagery.rename(s.imageryId, name)}
          onToggleTag={(tag) => imagery.toggleTag(s.imageryId, tag)}
        />
      );
    });

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
          {result?.llmEnabled && result.hasLyrics && (
            <button
              type="button"
              onClick={async () => {
                // AI 勾选了折叠区里的候选时展开，免得漏看
                if ((await imagery.review()) > 0) setOthersOpen(true);
              }}
              disabled={imagery.reviewing || imagery.generating}
              title="让 AI 逐个判断候选是否作为意象使用，并补充词典没匹配到的意象"
              className="flex items-center gap-1.5 rounded-full border border-violet-200 px-4 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/20"
            >
              {imagery.reviewing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Bot size={14} />
              )}
              {imagery.reviewing ? "AI 校验中…" : "AI 校验"}
            </button>
          )}
          <Link
            href="/admin/imagery"
            className="text-xs text-slate-400 hover:text-blue-600"
          >
            编辑已有标注
          </Link>
          <button
            type="button"
            onClick={imagery.generate}
            disabled={imagery.generating || imagery.reviewing}
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
          {/* 改意象时的自动补全，整个面板共用一份 */}
          <datalist id={dictionaryListId}>
            {result.dictionary.map((d) => (
              <option key={d.id} value={d.name} />
            ))}
          </datalist>
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
                  推荐 {recommended.length} 个（其他歌里常被标注的默认勾选）
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
                <details
                  open={othersOpen}
                  onToggle={(e) => setOthersOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600">
                    其他候选 {others.length}{" "}
                    个（其他歌里很少被标注，或被更长的意象包含，默认不勾选）
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
