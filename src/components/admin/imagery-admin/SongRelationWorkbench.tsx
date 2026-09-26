"use client";

import { parseLrcLines, type LrcLine } from "@/lib/imagery/suggest";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { ImageryCategory, ImageryItem, ImageryMeaning } from "@/lib/types";
import { AlertCircle, Plus, Trash2, Wand2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import SuggestionReview from "../imagery-suggest/SuggestionReview";
import { useImagerySuggestions } from "../imagery-suggest/useImagerySuggestions";
import { cn, ghostButtonClassName, primaryButtonClassName } from "./shared";
import type { SongOption } from "./types";
import type { RelationDraft } from "./useOccurrencesTab";

/** 正在编辑的关系；occurrenceId 为 null 表示新建 */
interface EditorState {
  occurrenceId: number | null;
  imageryName: string;
  categoryId: number | null;
  meaningId: number | null;
  timetags: string[];
}

type Tone = "draft" | "hover" | "candidate" | "saved";

const TONE_CLASS: Record<Tone, string> = {
  draft:
    "bg-blue-200/80 text-blue-900 dark:bg-blue-500/30 dark:text-blue-100 rounded-sm",
  hover:
    "bg-amber-200/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100 rounded-sm",
  candidate:
    "bg-emerald-100 text-emerald-900 underline decoration-emerald-400 decoration-dashed underline-offset-4 dark:bg-emerald-500/20 dark:text-emerald-100 rounded-sm",
  saved:
    "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100 rounded-sm",
};
const TONE_PRIORITY: Record<Tone, number> = {
  hover: 4,
  draft: 3,
  candidate: 2,
  saved: 1,
};

function tagToSeconds(tag: string): number {
  const [m, s] = tag.split(":");
  return Number(m) * 60 + Number(s);
}

function sortTags(tags: readonly string[]): string[] {
  return [...tags].sort((a, b) => tagToSeconds(a) - tagToSeconds(b));
}

/** 把一行歌词切成若干段，命中的意象名加底色；同一位置优先最长词、再按色调优先级 */
function highlight(
  text: string,
  marks: ReadonlyArray<{ name: string; tone: Tone }>,
): ReactNode[] {
  const lower = text.toLowerCase();
  const usable = marks
    .filter((m) => m.name.trim())
    .map((m) => ({ ...m, key: m.name.toLowerCase() }))
    .sort(
      (a, b) =>
        b.key.length - a.key.length ||
        TONE_PRIORITY[b.tone] - TONE_PRIORITY[a.tone],
    );
  const out: ReactNode[] = [];
  let plain = "";
  for (let i = 0; i < text.length;) {
    const hit = usable.find((m) => lower.startsWith(m.key, i));
    if (!hit) {
      plain += text[i];
      i += 1;
      continue;
    }
    if (plain) out.push(plain);
    plain = "";
    out.push(
      <mark key={i} className={TONE_CLASS[hit.tone]}>
        {text.slice(i, i + hit.key.length)}
      </mark>,
    );
    i += hit.key.length;
  }
  if (plain) out.push(plain);
  return out;
}

function shortPath(path: string): string {
  return path.split(" / ").slice(-2).join(" / ");
}

/**
 * 关系管理的对照编辑：左侧整首歌词，右侧该歌的意象关系。
 * 在左侧点歌词行增删当前关系的时间标签，划选词语可直接新建关系。
 * 右侧可切换到「候选审核」：词典匹配 + AI 校验生成候选，勾选的候选在歌词中就地标出。
 */
export default function SongRelationWorkbench({
  song,
  occurrences,
  loading,
  items,
  leafCategories,
  meanings,
  submitting,
  getCategoryPath,
  csrfToken,
  onSave,
  onDelete,
  onReload,
}: {
  song: SongOption;
  occurrences: OccurrenceWithSong[];
  loading: boolean;
  items: ImageryItem[];
  leafCategories: ImageryCategory[];
  meanings: ImageryMeaning[];
  submitting: boolean;
  getCategoryPath: (categoryId: number) => string;
  onSave: (
    occurrenceId: number | null,
    draft: RelationDraft,
  ) => Promise<boolean>;
  onDelete: (occurrenceId: number, label: string) => void;
  csrfToken: string;
  /** 候选批量保存后刷新该歌的关系与意象列表 */
  onReload: () => Promise<unknown>;
}) {
  const lines = useMemo(
    () => parseLrcLines(song.lyrics, { includeCredits: true }),
    [song.lyrics],
  );
  const lyricTags = useMemo(() => new Set(lines.map((l) => l.tag)), [lines]);
  const textByTag = useMemo(
    () => new Map(lines.map((l) => [l.tag, l.text])),
    [lines],
  );
  const itemByName = useMemo(
    () => new Map(items.map((i) => [i.name.toLowerCase(), i])),
    [items],
  );
  const sortedOccurrences = useMemo(
    () =>
      [...occurrences].sort((a, b) => {
        const first = (o: OccurrenceWithSong) =>
          o.lyric_timetag.length > 0
            ? Math.min(...o.lyric_timetag.map(tagToSeconds))
            : Infinity;
        return first(a) - first(b);
      }),
    [occurrences],
  );
  const occurrencesByTag = useMemo(() => {
    const map = new Map<string, OccurrenceWithSong[]>();
    for (const o of occurrences) {
      for (const tag of o.lyric_timetag) {
        map.set(tag, [...(map.get(tag) ?? []), o]);
      }
    }
    return map;
  }, [occurrences]);
  const categoryOptions = useMemo(
    () =>
      leafCategories
        .map((c) => ({ id: c.id, label: getCategoryPath(c.id) }))
        .sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
    [getCategoryPath, leafCategories],
  );

  const [editorState, setEditor] = useState<EditorState | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [focusTag, setFocusTag] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    text: string;
    tag: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lineRefs = useRef(new Map<string, HTMLDivElement>());
  const [view, setView] = useState<"relations" | "suggestions">("relations");
  const [hoverSuggestionId, setHoverSuggestionId] = useState<number | null>(
    null,
  );
  const suggest = useImagerySuggestions(song.id, csrfToken, {
    existing: occurrences,
    onSaved: onReload,
  });

  /** 候选审核时：时间标签 → 该行上被勾选的候选 */
  const candidatesByTag = useMemo(() => {
    const map = new Map<string, Array<{ id: number; name: string }>>();
    if (view !== "suggestions") return map;
    for (const s of suggest.result?.suggestions ?? []) {
      const draft = suggest.drafts[s.imageryId];
      if (!draft?.checked && s.imageryId !== hoverSuggestionId) continue;
      for (const tag of s.timetags) {
        if (draft?.excludedTags.includes(tag)) continue;
        map.set(tag, [
          ...(map.get(tag) ?? []),
          { id: s.imageryId, name: s.name },
        ]);
      }
    }
    return map;
  }, [hoverSuggestionId, suggest.drafts, suggest.result, view]);

  // 正在编辑的关系被删除（或列表刷新后不存在）时视为已关闭
  const editor =
    editorState &&
    (editorState.occurrenceId === null ||
      occurrences.some((o) => o.id === editorState.occurrenceId))
      ? editorState
      : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resolvedItem = editor
    ? (itemByName.get(editor.imageryName.trim().toLowerCase()) ?? null)
    : null;
  const duplicate =
    editor && resolvedItem
      ? occurrences.find(
          (o) =>
            o.imagery_id === resolvedItem.id && o.id !== editor.occurrenceId,
        )
      : undefined;

  const linesContaining = (name: string) => {
    const key = name.trim().toLowerCase();
    return key
      ? lines
          .filter((l) => l.text.toLowerCase().includes(key))
          .map((l) => l.tag)
      : [];
  };

  const openExisting = (o: OccurrenceWithSong) => {
    setNotice(null);
    setEditor({
      occurrenceId: o.id,
      imageryName: o.imagery_name ?? "",
      categoryId: o.category_id,
      meaningId: o.meaning_id,
      timetags: sortTags(o.lyric_timetag),
    });
    const first = sortTags(o.lyric_timetag).find((t) => lyricTags.has(t));
    if (first) {
      lineRefs.current
        .get(first)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const startNew = (name = "", timetags?: string[]) => {
    const item = itemByName.get(name.trim().toLowerCase());
    const existing = item
      ? occurrences.find((o) => o.imagery_id === item.id)
      : undefined;
    if (existing) {
      openExisting(existing);
      setNotice(`这首歌已有「${existing.imagery_name}」，已打开这条关系`);
      return;
    }
    setNotice(null);
    setEditor({
      occurrenceId: null,
      imageryName: name,
      categoryId: item?.categoryIds[0] ?? null,
      meaningId: null,
      timetags: sortTags(timetags ?? (focusTag ? [focusTag] : [])),
    });
  };

  const toggleTag = (tag: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      timetags: editor.timetags.includes(tag)
        ? editor.timetags.filter((t) => t !== tag)
        : sortTags([...editor.timetags, tag]),
    });
  };

  const renameDraft = (name: string) => {
    if (!editor) return;
    const item = itemByName.get(name.trim().toLowerCase());
    setEditor({
      ...editor,
      imageryName: name,
      // 新建时跟随意象的常用分类；编辑已有关系时不擅自改分类
      categoryId:
        editor.occurrenceId === null && item?.categoryIds[0]
          ? item.categoryIds[0]
          : editor.categoryId,
    });
  };

  const onLyricsMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    const lineEl = sel?.anchorNode?.parentElement?.closest("[data-tag]");
    if (!text || text.length > 20 || text.includes("\n") || !lineEl) {
      setSelection(null);
      return;
    }
    setSelection({ text, tag: lineEl.getAttribute("data-tag") ?? "" });
  };

  const onLineClick = (tag: string) => {
    // 划选文字时的 mouseup 也会触发 click，不当作点行
    if (window.getSelection()?.toString().trim()) return;
    if (editor && view === "relations") toggleTag(tag);
    else setFocusTag((current) => (current === tag ? null : tag));
  };

  const save = async () => {
    if (!editor || !canSave || editor.categoryId === null) return;
    const ok = await onSave(editor.occurrenceId, {
      imageryId: resolvedItem?.id ?? null,
      imageryName: editor.imageryName.trim(),
      categoryId: editor.categoryId,
      meaningId: editor.meaningId,
      timetags: editor.timetags,
    });
    if (ok) {
      setEditor(null);
      setNotice(null);
    }
  };

  const nameError = !editor
    ? null
    : !editor.imageryName.trim()
      ? "请填写意象"
      : editor.imageryName.trim().length > 50
        ? "意象名不能超过 50 个字"
        : duplicate
          ? "这首歌已有这个意象"
          : null;
  const canSave =
    editor !== null &&
    nameError === null &&
    editor.categoryId !== null &&
    editor.timetags.length > 0 &&
    !submitting;

  const annotatedLineCount = lines.filter((l) =>
    occurrencesByTag.has(l.tag),
  ).length;
  const hovered = occurrences.find((o) => o.id === hoverId);
  const datalistId = `imagery-names-${song.id}`;

  const renderLine = (line: LrcLine, index: number) => {
    const onLine = occurrencesByTag.get(line.tag) ?? [];
    const inDraft = editor?.timetags.includes(line.tag) ?? false;
    const marks: Array<{ name: string; tone: Tone }> = onLine.map((o) => ({
      name: o.imagery_name ?? "",
      tone: o.id === hoverId ? "hover" : "saved",
    }));
    if (inDraft && editor)
      marks.push({ name: editor.imageryName, tone: "draft" });
    const candidates = candidatesByTag.get(line.tag) ?? [];
    for (const c of candidates) {
      marks.push({
        name: c.name,
        tone: c.id === hoverSuggestionId ? "hover" : "candidate",
      });
    }
    const hoveredCandidate = candidates.some((c) => c.id === hoverSuggestionId);
    // 意象名不在这一行字面出现时，在行尾列出，避免关系「隐身」
    const hidden = onLine.filter(
      (o) =>
        o.imagery_name &&
        !line.text.toLowerCase().includes(o.imagery_name.toLowerCase()),
    );

    return (
      <div
        key={`${line.tag}-${index}`}
        data-tag={line.tag}
        ref={(el) => {
          if (el) lineRefs.current.set(line.tag, el);
          else lineRefs.current.delete(line.tag);
        }}
        onClick={() => onLineClick(line.tag)}
        className={cn(
          "group flex cursor-pointer items-baseline gap-3 border-l-2 px-3 py-1.5 transition-colors",
          inDraft
            ? "border-blue-500 bg-blue-50/70 dark:bg-blue-900/20"
            : hoveredCandidate || hovered?.lyric_timetag.includes(line.tag)
              ? "border-amber-400 bg-amber-50/70 dark:bg-amber-900/10"
              : focusTag === line.tag
                ? "border-slate-400 bg-slate-100 dark:bg-slate-800/60"
                : candidates.length > 0
                  ? "border-emerald-300 dark:border-emerald-700"
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30",
        )}
      >
        <span className="w-16 shrink-0 font-mono text-[11px] text-slate-400">
          {line.tag}
        </span>
        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {highlight(line.text, marks)}
        </span>
        {hidden.length > 0 && (
          <span className="shrink-0 text-[11px] text-violet-500">
            {hidden.map((o) => o.imagery_name).join("、")}
          </span>
        )}
        {onLine.length > 0 && (
          <span
            className="shrink-0 rounded-full bg-violet-50 px-1.5 text-[10px] text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
            title={onLine.map((o) => o.imagery_name).join("、")}
          >
            {onLine.length}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* ── 左：歌词 ── */}
      <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            歌词
          </span>
          <span>
            {lines.length} 行 · 已标注 {annotatedLineCount} 行
          </span>
          <span className="ml-auto text-slate-400">
            {view === "suggestions"
              ? "绿色为已勾选的候选，悬停候选可定位"
              : editor
                ? "点击行加入 / 移出当前关系"
                : "点击行查看该行意象，划选词语可新建关系"}
          </span>
        </header>
        {selection && (
          <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-2 text-sm dark:border-blue-900/40 dark:bg-blue-900/10">
            <span className="text-slate-600 dark:text-slate-300">
              已选「<strong>{selection.text}</strong>」
            </span>
            <button
              type="button"
              onClick={() => {
                startNew(selection.text, linesContaining(selection.text));
                setSelection(null);
                setView("relations");
              }}
              className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              新建关系（匹配 {linesContaining(selection.text).length} 行）
            </button>
            {editor && (
              <button
                type="button"
                onClick={() => {
                  renameDraft(selection.text);
                  setSelection(null);
                }}
                className="rounded-full border border-blue-200 px-3 py-0.5 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300"
              >
                用作当前意象名
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="ml-auto text-slate-400 hover:text-slate-600"
              aria-label="取消选择"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div
          onMouseUp={onLyricsMouseUp}
          className="max-h-[70vh] overflow-y-auto py-2"
        >
          {lines.length > 0 ? (
            lines.map(renderLine)
          ) : (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              这首歌没有带时间标签的歌词，先在歌曲管理中补全歌词。
            </p>
          )}
        </div>
      </section>

      {/* ── 右：关系 ── */}
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            className="flex rounded-full border border-slate-200 bg-white p-0.5 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {(
              [
                ["relations", `关系 ${occurrences.length}`],
                [
                  "suggestions",
                  suggest.result
                    ? `候选审核 ${suggest.selectedCount}/${suggest.result.suggestions.length}`
                    : "候选审核",
                ],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  view === key
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "relations" && (
            <button
              type="button"
              onClick={() => startNew()}
              className={cn(primaryButtonClassName(), "ml-auto")}
            >
              <Plus size={12} />
              新增关系
            </button>
          )}
        </div>

        {view === "suggestions" ? (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <SuggestionReview
              imagery={suggest}
              songId={song.id}
              onHoverSuggestion={setHoverSuggestionId}
            />
          </div>
        ) : (
          <>
            {notice && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                {notice}
              </p>
            )}

            {editor && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-900/10">
                <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-300">
                  {editor.occurrenceId === null
                    ? "新增关系"
                    : `编辑关系 #${editor.occurrenceId}`}
                </p>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">意象</span>
                  <input
                    value={editor.imageryName}
                    onChange={(e) => renameDraft(e.target.value)}
                    list={datalistId}
                    maxLength={50}
                    placeholder="输入或选择意象"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <datalist id={datalistId}>
                    {items.map((i) => (
                      <option key={i.id} value={i.name} />
                    ))}
                  </datalist>
                  <span className="flex flex-wrap items-center gap-2 text-[11px]">
                    {nameError ? (
                      <span className="text-red-500">{nameError}</span>
                    ) : resolvedItem ? (
                      <span className="text-slate-400">
                        已有意象 · 用于 {resolvedItem.count} 首
                      </span>
                    ) : (
                      <span className="text-amber-600">新意象，保存时创建</span>
                    )}
                    {duplicate && (
                      <button
                        type="button"
                        onClick={() => openExisting(duplicate)}
                        className="text-blue-600 hover:underline"
                      >
                        打开那一条
                      </button>
                    )}
                  </span>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">分类</span>
                  <select
                    value={editor.categoryId ?? ""}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        categoryId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">— 选择分类 —</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                {meanings.length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-500">含义（可选）</span>
                    <select
                      value={editor.meaningId ?? ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          meaningId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">— 不设置 —</option>
                      {meanings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      出现位置 {editor.timetags.length}{" "}
                      处（在左侧点击歌词行增删）
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          timetags: sortTags([
                            ...new Set([
                              ...editor.timetags,
                              ...linesContaining(editor.imageryName),
                            ]),
                          ]),
                        })
                      }
                      disabled={!editor.imageryName.trim()}
                      title="把歌词中所有含该意象名的行都加进来"
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-500 disabled:opacity-40"
                    >
                      <Wand2 size={11} />
                      匹配全部行
                    </button>
                  </div>
                  {editor.timetags.length === 0 ? (
                    <p className="text-xs text-slate-400">至少选择一行歌词</p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {editor.timetags.map((tag) => {
                        const text = textByTag.get(tag);
                        return (
                          <li
                            key={tag}
                            className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs dark:bg-slate-900"
                          >
                            <span className="font-mono text-[10px] text-slate-400">
                              {tag}
                            </span>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate",
                                text
                                  ? "text-slate-600 dark:text-slate-300"
                                  : "text-orange-600",
                              )}
                            >
                              {text ?? "歌词中找不到这个时间"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className="text-slate-300 hover:text-red-500"
                              aria-label={`移除 ${tag}`}
                            >
                              <X size={12} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditor(null);
                      setNotice(null);
                    }}
                    className={ghostButtonClassName()}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!canSave}
                    className={primaryButtonClassName()}
                  >
                    {submitting ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-[70vh] space-y-2 overflow-y-auto">
              {loading ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  加载关系中…
                </p>
              ) : sortedOccurrences.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
                  暂无关系。在左侧划选词语，或点「新增关系」开始。
                </p>
              ) : (
                sortedOccurrences.map((o) => {
                  const orphans = o.lyric_timetag.filter(
                    (t) => !lyricTags.has(t),
                  );
                  const isEditing = editor?.occurrenceId === o.id;
                  const onFocusLine =
                    focusTag !== null && o.lyric_timetag.includes(focusTag);
                  const label = o.imagery_name ?? `意象 #${o.imagery_id}`;
                  return (
                    <div
                      key={o.id}
                      onMouseEnter={() => setHoverId(o.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={() => openExisting(o)}
                      className={cn(
                        "group flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors dark:bg-slate-900/50",
                        isEditing
                          ? "border-blue-400 ring-1 ring-blue-400"
                          : onFocusLine
                            ? "border-slate-400"
                            : "border-slate-200 hover:border-amber-300 dark:border-slate-800",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {label}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {shortPath(getCategoryPath(o.category_id))}
                          </span>
                          {o.meaning_label && (
                            <span className="rounded-full bg-emerald-50 px-2 text-[11px] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                              {o.meaning_label}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span>{o.lyric_timetag.length} 处</span>
                          {orphans.length > 0 && (
                            <span
                              className="flex items-center gap-1 text-orange-600"
                              title={orphans.join("、")}
                            >
                              <AlertCircle size={11} />
                              {orphans.length} 个时间在歌词中找不到
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(o.id, label);
                        }}
                        className="invisible rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500 group-hover:visible dark:hover:bg-red-900/20"
                        aria-label={`删除「${label}」`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
