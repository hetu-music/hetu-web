"use client";

import { linesForWord } from "@/lib/imagery/consistency";
import { parseLrcLines, type LrcLine } from "@/lib/imagery/suggest";
import type { OccurrenceWithSong } from "@/lib/server/service-imagery";
import type { ImageryItem } from "@/lib/types";
import {
  type MotifOption,
  WORD_ROLE,
  wordMotifIds,
} from "@/lib/imagery/word-motifs";
import { AlertCircle, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuggestionReview from "../imagery-suggest/SuggestionReview";
import { useImagerySuggestions } from "../imagery-suggest/useImagerySuggestions";
import MotifSelect from "./MotifSelect";
import { ConfirmButton } from "../kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PANEL_CLASS,
  SELECT_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { cn } from "@/lib/utils/utils";
import type { SongOption } from "./types";

/** 对照编辑提交的一条标注；imageryId 为 null 表示词典里还没有，保存时随标注创建 */
export interface AnnotationDraft {
  imageryId: number | null;
  imageryName: string;
  categoryId: number;
}

/** 正在编辑的标注；occurrenceId 为 null 表示新建。出现位置由歌词算出，不在这里 */
interface EditorState {
  occurrenceId: number | null;
  imageryName: string;
  categoryId: number | null;
}

type Tone = "draft" | "hover" | "candidate" | "saved";

type View = "annotations" | "suggestions";

// 歌词里的标记。已存的要在正文的灰字里一眼认出来：墨蓝字加浅墨蓝底；
// 正在编辑的铺实色反白，和已存的分开；悬停定位用琥珀；候选只画加粗的虚线
const TONE_CLASS: Record<Tone, string> = {
  draft: "rounded-sm bg-(--tone) text-white dark:text-slate-900",
  hover:
    "rounded-sm bg-amber-300 text-amber-950 dark:bg-amber-400/70 dark:text-amber-50",
  candidate:
    "bg-transparent text-slate-900 underline decoration-(--tone) decoration-dashed decoration-2 underline-offset-4 dark:text-slate-50",
  saved: "rounded-sm bg-(--tone)/15 font-medium text-(--tone)",
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
 * 一个词在这首歌里的标注。挂「通常算作」的词会补写「同时算进」的各条（「风雨」写风、雨两条），
 * 它们是一次标注写出来的：界面上合成一行，编辑、删除都按主条
 */
interface WordAnnotation {
  main: OccurrenceWithSong;
  parts: OccurrenceWithSong[];
}

function firstSecond(o: OccurrenceWithSong): number {
  return o.lyric_timetag.length > 0
    ? Math.min(...o.lyric_timetag.map(tagToSeconds))
    : Infinity;
}

/**
 * 一首歌的标注对照编辑：左侧整首歌词，右侧这首歌的标注。
 * 出现位置按歌词自动确定（词字面出现的行），划选词语可直接新建标注。
 * 右侧可切换到「候选审核」：词典匹配 + AI 校验生成候选，勾选的候选在歌词中就地标出。
 */
export default function SongAnnotationWorkbench({
  song,
  occurrences,
  loading,
  items,
  motifs,
  submitting,
  getCategoryPath,
  onSave,
  onDelete,
  onReload,
}: {
  song: SongOption;
  occurrences: OccurrenceWithSong[];
  loading: boolean;
  items: ImageryItem[];
  /** 全部母题，已排好序 */
  motifs: MotifOption[];
  submitting: boolean;
  getCategoryPath: (categoryId: number) => string;
  onSave: (
    occurrenceId: number | null,
    draft: AnnotationDraft,
  ) => Promise<boolean>;
  onDelete: (occurrenceId: number, label: string) => void;
  /** 候选批量保存后刷新该歌的标注与词典 */
  onReload: () => Promise<unknown>;
}) {
  const lines = useMemo(
    () => parseLrcLines(song.lyrics, { includeCredits: true }),
    [song.lyrics],
  );
  const lyricTags = useMemo(() => new Set(lines.map((l) => l.tag)), [lines]);
  // 与服务端一致：制作名单行不算歌词
  const lyricLines = useMemo(() => parseLrcLines(song.lyrics), [song.lyrics]);
  const textByTag = useMemo(
    () => new Map(lines.map((l) => [l.tag, l.text])),
    [lines],
  );
  const itemByName = useMemo(
    () => new Map(items.map((i) => [i.name.toLowerCase(), i])),
    [items],
  );
  /** 按词合并的标注，主条是不在这个词「同时算进」里的那条，按首次出现排 */
  const annotations = useMemo(() => {
    const partsOf = new Map(items.map((i) => [i.id, new Set(i.parts)]));
    const byWord = new Map<number, OccurrenceWithSong[]>();
    for (const o of occurrences) {
      byWord.set(o.imagery_id, [...(byWord.get(o.imagery_id) ?? []), o]);
    }
    return [...byWord.values()]
      .map((rows): WordAnnotation => {
        const parts = partsOf.get(rows[0].imagery_id) ?? new Set<number>();
        const main = rows.find((r) => !parts.has(r.category_id)) ?? rows[0];
        return { main, parts: rows.filter((r) => r !== main) };
      })
      .sort((a, b) => firstSecond(a.main) - firstSecond(b.main));
  }, [items, occurrences]);
  /** 歌词行上的标注，一个词只算一次 */
  const occurrencesByTag = useMemo(() => {
    const map = new Map<string, OccurrenceWithSong[]>();
    for (const { main } of annotations) {
      for (const tag of main.lyric_timetag) {
        map.set(tag, [...(map.get(tag) ?? []), main]);
      }
    }
    return map;
  }, [annotations]);

  /** 新建标注时默认选的母题：这个词登记的默认母题 */
  const defaultMotif = (item: ImageryItem | undefined) =>
    (item && wordMotifIds(item)[0]) ?? null;

  const [editorState, setEditor] = useState<EditorState | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [focusTag, setFocusTag] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    text: string;
    tag: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lineRefs = useRef(new Map<string, HTMLDivElement>());
  const [view, setView] = useState<View>("annotations");
  const [hoverSuggestionId, setHoverSuggestionId] = useState<number | null>(
    null,
  );
  const suggest = useImagerySuggestions(song.id, {
    existing: occurrences,
    items,
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
        map.set(tag, [
          ...(map.get(tag) ?? []),
          { id: s.imageryId, name: s.name },
        ]);
      }
    }
    return map;
  }, [hoverSuggestionId, suggest.drafts, suggest.result, view]);

  // 正在编辑的标注被删除（或列表刷新后不存在）时视为已关闭
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
      ? annotations.find(
          ({ main }) =>
            main.imagery_id === resolvedItem.id &&
            main.id !== editor.occurrenceId,
        )?.main
      : undefined;
  // 挂「通常算作」时会一并算进的母题，编辑时说一声
  const willAlsoCount =
    editor && resolvedItem && editor.categoryId === resolvedItem.primary
      ? resolvedItem.parts
      : [];

  /** 词在本曲应有的出现位置：字面出现的行，被同曲其他更长标注词覆盖的除外（见 IMAGERY.md） */
  const linesFor = (name: string, exceptOccurrenceId: number | null = null) =>
    linesForWord(lyricLines, name.trim(), [
      ...occurrences
        .filter((o) => o.id !== exceptOccurrenceId)
        .map((o) => o.imagery_name ?? ""),
      name.trim(),
    ]);
  const draftTags = editor
    ? linesFor(editor.imageryName, editor.occurrenceId)
    : [];

  const openExisting = (o: OccurrenceWithSong) => {
    setNotice(null);
    setEditor({
      occurrenceId: o.id,
      imageryName: o.imagery_name ?? "",
      categoryId: o.category_id,
    });
    const first = sortTags(o.lyric_timetag).find((t) => lyricTags.has(t));
    if (first) {
      lineRefs.current
        .get(first)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const startNew = (name = "") => {
    const item = itemByName.get(name.trim().toLowerCase());
    const existing = item
      ? annotations.find(({ main }) => main.imagery_id === item.id)?.main
      : undefined;
    if (existing) {
      openExisting(existing);
      setNotice(`这首歌已有「${existing.imagery_name}」，已打开这条标注`);
      return;
    }
    setNotice(null);
    setEditor({
      occurrenceId: null,
      imageryName: name,
      categoryId: defaultMotif(item),
    });
  };

  const renameDraft = (name: string) => {
    if (!editor) return;
    const item = itemByName.get(name.trim().toLowerCase());
    setEditor({
      ...editor,
      imageryName: name,
      // 新建时跟随词的默认母题；编辑已有标注时不擅自改母题
      categoryId:
        editor.occurrenceId === null && defaultMotif(item) !== null
          ? defaultMotif(item)
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
    setFocusTag((current) => (current === tag ? null : tag));
  };

  const save = async () => {
    if (!editor || !canSave || editor.categoryId === null) return;
    const ok = await onSave(editor.occurrenceId, {
      imageryId: resolvedItem?.id ?? null,
      imageryName: editor.imageryName.trim(),
      categoryId: editor.categoryId,
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
        ? "意象不能超过 50 个字"
        : duplicate
          ? "这首歌已经标过这个词"
          : null;
  const canSave =
    editor !== null &&
    nameError === null &&
    editor.categoryId !== null &&
    // 歌词没有时间轴时无从核对，不拦
    (lyricLines.length === 0 || draftTags.length > 0) &&
    !submitting;

  const annotatedLineCount = lines.filter((l) =>
    occurrencesByTag.has(l.tag),
  ).length;
  const hovered = occurrences.find((o) => o.id === hoverId);
  const datalistId = `imagery-names-${song.id}`;

  const renderLine = (line: LrcLine, index: number) => {
    const onLine = occurrencesByTag.get(line.tag) ?? [];
    const inDraft = draftTags.includes(line.tag);
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
    // 意象名不在这一行字面出现时，在行尾列出，避免标注「隐身」
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
            ? "border-(--tone) bg-(--tone)/5"
            : hoveredCandidate || hovered?.lyric_timetag.includes(line.tag)
              ? "border-amber-400 bg-amber-50/70 dark:bg-amber-900/10"
              : focusTag === line.tag
                ? "border-slate-400 bg-slate-100 dark:bg-slate-800/60"
                : candidates.length > 0
                  ? "border-(--tone)/40"
                  : "border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-900/60",
        )}
      >
        <span className="w-16 shrink-0 font-mono text-[11px] text-slate-400">
          {line.tag}
        </span>
        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {highlight(line.text, marks)}
        </span>
        {hidden.length > 0 && (
          <span className="shrink-0 text-[11px] text-slate-400">
            {hidden.map((o) => o.imagery_name).join("、")}
          </span>
        )}
        {onLine.length > 0 && (
          <span
            className="shrink-0 text-[10px] tabular-nums text-slate-400"
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
      <section className={cn(PANEL_CLASS, "flex min-h-0 flex-col")}>
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          <span className="text-slate-700 dark:text-slate-200">歌词</span>
          <span>
            {lines.length} 行 · 已标注 {annotatedLineCount} 行
          </span>
          <span className="ml-auto text-slate-400">
            {view === "suggestions"
              ? "虚线为已勾选的候选，悬停候选可定位"
              : editor
                ? "出现位置按歌词自动确定"
                : "点击行查看该行意象，划选词语可新建标注"}
          </span>
        </header>
        {selection && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200/70 bg-(--tone)/5 px-4 py-2 text-sm dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-300">
              已选「<strong>{selection.text}</strong>」
            </span>
            <button
              type="button"
              onClick={() => {
                startNew(selection.text);
                setSelection(null);
                setView("annotations");
              }}
              className="text-xs tracking-wider text-(--tone) hover:opacity-75"
            >
              新建标注（出现在 {linesFor(selection.text).length} 行）
            </button>
            {editor && (
              <button
                type="button"
                onClick={() => {
                  renameDraft(selection.text);
                  setSelection(null);
                }}
                className={TEXT_BUTTON_CLASS}
              >
                用作当前意象
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
              这首歌没有带时间标签的歌词，先在「资料」里补全。
            </p>
          )}
        </div>
      </section>

      {/* ── 右：标注 ── */}
      <Tabs
        value={view}
        onValueChange={(next: View) => setView(next)}
        render={<section />}
        className="flex min-h-0 flex-col gap-3"
      >
        <div className="flex items-center gap-2">
          <TabsList variant="inline" aria-label="标注与候选">
            <TabsTrigger value="annotations" variant="inline">
              标注 {annotations.length}
            </TabsTrigger>
            <TabsTrigger value="suggestions" variant="inline">
              {suggest.result
                ? `候选审核 ${suggest.selectedCount}/${suggest.result.suggestions.length}`
                : "候选审核"}
            </TabsTrigger>
          </TabsList>
          {view === "annotations" && (
            <button
              type="button"
              onClick={() => startNew()}
              className={cn(SOLID_BUTTON_CLASS, "ml-auto")}
            >
              <Plus size={12} />
              新增标注
            </button>
          )}
        </div>

        <TabsContent
          value="suggestions"
          variant="inline"
          className="max-h-[75vh] overflow-y-auto pr-1"
        >
          <SuggestionReview
            imagery={suggest}
            songId={song.id}
            items={items}
            motifs={motifs}
            onHoverSuggestion={setHoverSuggestionId}
          />
        </TabsContent>
        <TabsContent value="annotations" variant="inline" className="space-y-3">
          {notice && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {notice}
            </p>
          )}

          {editor && (
            <div className="space-y-3 rounded-lg border border-(--tone)/40 p-4">
              <p className="text-xs tracking-[0.2em] text-(--tone)">
                {editor.occurrenceId === null
                  ? "新增标注"
                  : `编辑标注 #${editor.occurrenceId}`}
              </p>

              <label className="block space-y-1">
                <span className={LABEL_CLASS}>意象</span>
                <input
                  value={editor.imageryName}
                  onChange={(e) => renameDraft(e.target.value)}
                  list={datalistId}
                  maxLength={50}
                  placeholder="输入或选择意象"
                  className={INPUT_CLASS}
                />
                <datalist id={datalistId}>
                  {items.map((i) => (
                    <option key={i.id} value={i.name} />
                  ))}
                </datalist>
                <span className="flex flex-wrap items-center gap-2 text-[11px]">
                  {nameError ? (
                    <span className="text-rose-500">{nameError}</span>
                  ) : resolvedItem ? (
                    <span className="text-slate-400">
                      词典里已有 · 标注 {resolvedItem.count} 处
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      词典里没有，保存时随标注创建
                    </span>
                  )}
                  {duplicate && (
                    <button
                      type="button"
                      onClick={() => openExisting(duplicate)}
                      className="text-(--tone) hover:underline"
                    >
                      打开那一条
                    </button>
                  )}
                </span>
              </label>

              <label className="block space-y-1">
                <span className={LABEL_CLASS}>母题</span>
                <MotifSelect
                  key={resolvedItem?.id ?? "new"}
                  candidateIds={resolvedItem ? wordMotifIds(resolvedItem) : []}
                  value={editor.categoryId}
                  motifs={motifs}
                  onChange={(categoryId) =>
                    setEditor({ ...editor, categoryId })
                  }
                  placeholder="— 选择母题 —"
                  hint
                  className={SELECT_CLASS}
                />
                {willAlsoCount.length > 0 && (
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    保存时{WORD_ROLE.part.label}：
                    {willAlsoCount
                      .map((id) => getCategoryPath(id).split(" / ").pop())
                      .join("、")}
                  </span>
                )}
              </label>

              <div className="space-y-1">
                <span className={LABEL_CLASS}>
                  出现位置 {draftTags.length} 处（词在歌词里字面出现的行）
                </span>
                {lyricLines.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    歌词没有时间轴，无法定位
                  </p>
                ) : draftTags.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {editor.imageryName.trim()
                      ? "歌词里没有这个词，或只出现在同曲更长的标注词里"
                      : "填写意象后自动定位"}
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {draftTags.map((tag) => (
                      <li
                        key={tag}
                        className="flex items-center gap-2 border-b border-slate-200/70 py-1 text-xs last:border-0 dark:border-slate-800"
                      >
                        <span className="font-mono text-[10px] text-slate-400">
                          {tag}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                          {textByTag.get(tag)}
                        </span>
                      </li>
                    ))}
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
                  className={TEXT_BUTTON_CLASS}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!canSave}
                  className={SOLID_BUTTON_CLASS}
                >
                  {submitting ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-400">
                加载标注中…
              </p>
            ) : annotations.length === 0 ? (
              <p className="py-8 text-center font-kaiti text-base text-slate-400">
                还没有标注。在左侧划选词语，或点「新增标注」开始。
              </p>
            ) : (
              annotations.map(({ main: o, parts }) => {
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
                      "group flex cursor-pointer items-start gap-3 border-l-2 px-3 py-2 transition-colors",
                      isEditing
                        ? "border-(--tone) bg-(--tone)/5"
                        : onFocusLine
                          ? "border-slate-400 bg-slate-100 dark:bg-slate-800/60"
                          : "border-transparent hover:border-amber-400 hover:bg-slate-100/60 dark:hover:bg-slate-900/60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-slate-900 dark:text-slate-100">
                          {label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {shortPath(getCategoryPath(o.category_id))}
                          {parts.length > 0 &&
                            ` · ${WORD_ROLE.part.label} ${parts
                              .map((p) =>
                                getCategoryPath(p.category_id)
                                  .split(" / ")
                                  .pop(),
                              )
                              .join("、")}`}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>{o.lyric_timetag.length} 处</span>
                        {orphans.length > 0 && (
                          <span
                            className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                            title={orphans.join("、")}
                          >
                            <AlertCircle size={11} />
                            {orphans.length} 个时间在歌词中找不到
                          </span>
                        )}
                      </div>
                    </div>
                    <ConfirmButton
                      onConfirm={() => onDelete(o.id, label)}
                      disabled={submitting}
                      className="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    />
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
