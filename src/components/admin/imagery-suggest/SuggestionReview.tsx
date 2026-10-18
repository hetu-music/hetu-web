"use client";

import { Bot, Loader2, Pencil, Sparkles, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ImagerySuggestion,
  RECOMMEND_THRESHOLD,
} from "@/lib/imagery/suggest";
import type {
  CategoryOption,
  DictionaryOption,
} from "@/lib/server/service-imagery-suggest";
import { cn } from "@/lib/utils/utils";
import { OUTLINE_BUTTON_CLASS, SOLID_BUTTON_CLASS } from "../kit/styles";
import type {
  AiNote,
  ImagerySuggestionsState,
  SuggestionDraft,
} from "./useImagerySuggestions";

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
      className="max-w-full rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-700 outline-none focus:border-(--tone) dark:border-slate-700 dark:text-slate-200 [&>option]:bg-[#FAFAFA] dark:[&>option]:bg-[#0B0F19]"
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
        className="group/name flex items-center gap-1 text-slate-900 hover:text-(--tone) dark:text-slate-100"
      >
        {name}
        <Pencil
          size={12}
          className="text-slate-300 group-hover/name:text-(--tone)"
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
      className="w-28 rounded-md border border-(--tone) bg-transparent px-2 py-0.5 text-sm text-slate-900 outline-none dark:text-slate-100"
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
      ? ["AI 补充", "text-(--tone)"]
      : note.keep
        ? ["AI 保留", "text-slate-500 dark:text-slate-400"]
        : ["AI 剔除", "text-rose-600 dark:text-rose-400"];
  return (
    <span
      title={note.reason}
      className={cn("max-w-[16rem] truncate text-[11px]", className)}
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
        "flex items-start gap-3 border-b border-l-2 border-b-slate-200/70 py-2.5 pl-3 transition-colors dark:border-b-slate-800",
        draft.checked
          ? "border-l-(--tone) bg-(--tone)/5"
          : "border-l-transparent",
      )}
    >
      <input
        type="checkbox"
        checked={draft.checked}
        onChange={(e) => onUpdate({ checked: e.target.checked })}
        className="mt-1 h-4 w-4 shrink-0 accent-(--tone)"
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
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-(--tone)"
            >
              <Undo2 size={11} />
              原：{suggestion.name}
            </button>
          )}
          {!resolved && (
            <span
              className="text-[11px] text-amber-600 dark:text-amber-400"
              title="词典中没有这个意象，保存时会新建"
            >
              新意象
            </span>
          )}
          {alreadyAnnotated && (
            <span
              className="text-[11px] text-rose-600 dark:text-rose-400"
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
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300",
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

/**
 * 预标注候选的审核区：生成候选 / AI 校验按钮、候选列表、批量保存。
 * 歌曲管理的意象面板与关系管理的对照编辑共用。
 */
export default function SuggestionReview({
  imagery,
  songId,
  onHoverSuggestion,
}: {
  imagery: ImagerySuggestionsState;
  songId: number;
  /** 鼠标移入 / 移出某个候选，供对照编辑在歌词中高亮 */
  onHoverSuggestion?: (imageryId: number | null) => void;
}) {
  const { result, drafts } = imagery;
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
        <div
          key={s.imageryId}
          onMouseEnter={() => onHoverSuggestion?.(s.imageryId)}
          onMouseLeave={() => onHoverSuggestion?.(null)}
        >
          <SuggestionRow
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
        </div>
      );
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {result?.llmEnabled && result.hasLyrics && (
          <button
            type="button"
            onClick={async () => {
              // AI 勾选了折叠区里的候选时展开，免得漏看
              if ((await imagery.review()) > 0) setOthersOpen(true);
            }}
            disabled={imagery.reviewing || imagery.generating}
            title="让 AI 逐个判断候选是否作为意象使用，并补充词典没匹配到的意象"
            className={OUTLINE_BUTTON_CLASS}
          >
            {imagery.reviewing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Bot size={14} />
            )}
            {imagery.reviewing ? "AI 校验中…" : "AI 校验"}
          </button>
        )}
        <button
          type="button"
          onClick={imagery.generate}
          disabled={imagery.generating || imagery.reviewing}
          className={result ? OUTLINE_BUTTON_CLASS : SOLID_BUTTON_CLASS}
        >
          {imagery.generating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {result ? "重新生成候选" : "从歌词生成候选"}
        </button>
      </div>

      {imagery.message && (
        <p
          className={cn(
            "text-sm",
            imagery.message.type === "error"
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-600 dark:text-slate-300",
          )}
        >
          {imagery.message.text}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          {/* 改意象时的自动补全，整个审核区共用一份 */}
          <datalist id={dictionaryListId}>
            {result.dictionary.map((d) => (
              <option key={d.id} value={d.name} />
            ))}
          </datalist>
          {!result.published && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              歌曲尚未发布，可以先预览候选；发布后才能保存标注。
            </p>
          )}
          {!result.hasLyrics ? (
            <p className="font-kaiti text-base text-slate-400">
              这首歌还没有歌词，无法生成候选。
            </p>
          ) : suggestions.length === 0 ? (
            <p className="font-kaiti text-base text-slate-400">
              歌词中没有找到词典里尚未标注的意象。
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
                    className="hover:text-(--tone)"
                  >
                    全选 / 全不选
                  </button>
                )}
              </div>
              <div>{renderRows(recommended)}</div>

              {others.length > 0 && (
                <details
                  open={othersOpen}
                  onToggle={(e) => setOthersOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600">
                    其他候选 {others.length}{" "}
                    个（其他歌里很少被标注，或被更长的意象包含，默认不勾选）
                  </summary>
                  <div className="mt-2">{renderRows(others)}</div>
                </details>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <span className="text-sm text-slate-500">
                  已选 {imagery.selectedCount} 个
                </span>
                <button
                  type="button"
                  onClick={imagery.save}
                  disabled={!canSave || imagery.saving}
                  className={SOLID_BUTTON_CLASS}
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
    </div>
  );
}
