"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Link } from "@/i18n/navigation";
import {
  apiGetOccurrencesForImagery,
  apiSetWordMotifs,
} from "@/lib/api/client-api";
import { categoryPath, type MotifOption } from "@/lib/imagery/word-motifs";
import type { ImageryCategory, ImageryItem } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { ErrorState, LoadingState } from "../kit/parts";
import {
  LABEL_CLASS,
  META_CLASS,
  SELECT_CLASS,
  SOLID_BUTTON_CLASS,
  TAG_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";
import { IMAGERY_KEYS, useUpdateCache } from "./queries";

export type PanelView =
  | { type: "motif"; id: number }
  /** from：从哪个母题点进来的，供返回 */
  | { type: "word"; id: number; from?: number };

type Role = "primary" | "alternative" | "part";

const ROLE_LABEL: Record<Role, string> = {
  primary: "默认母题",
  alternative: "多义候选",
  part: "并列组成",
};

export function roleOf(item: ImageryItem, motifId: number): Role | null {
  if (item.primary === motifId) return "primary";
  if (item.alternatives.includes(motifId)) return "alternative";
  if (item.parts.includes(motifId)) return "part";
  return null;
}

/**
 * 母题页的详情弹窗：一个母题登记了哪些词；点词进到这个词，看它的候选母题和标在哪些歌里。
 * 词的候选母题（imagery_motifs）只在这里改，标注时选了候选之外的母题会自动登记为多义候选。
 */
export default function MotifPanel({
  view,
  categories,
  items,
  motifs,
  onNavigate,
  onEditMotif,
  onClose,
}: {
  view: PanelView | null;
  categories: ImageryCategory[];
  items: ImageryItem[];
  motifs: MotifOption[];
  onNavigate: (view: PanelView) => void;
  onEditMotif: (motif: ImageryCategory) => void;
  onClose: () => void;
}) {
  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const motif = view?.type === "motif" ? byId.get(view.id) : undefined;
  const word =
    view?.type === "word" ? items.find((i) => i.id === view.id) : undefined;
  const title = motif
    ? `母题 · ${motif.name}`
    : word
      ? `词 · ${word.name}`
      : "意象";

  return (
    <ResponsiveDialog
      open={view !== null}
      onOpenChange={(next) => !next && onClose()}
      title={title}
    >
      {motif && (
        <MotifView
          motif={motif}
          byId={byId}
          items={items}
          onOpenWord={(id) => onNavigate({ type: "word", id, from: motif.id })}
          onEdit={() => onEditMotif(motif)}
        />
      )}
      {view?.type === "word" && word && (
        <WordView
          key={word.id}
          word={word}
          byId={byId}
          motifs={motifs}
          backTo={view.from === undefined ? undefined : byId.get(view.from)}
          onBack={(id) => onNavigate({ type: "motif", id })}
          onOpenMotif={(id) => onNavigate({ type: "motif", id })}
        />
      )}
    </ResponsiveDialog>
  );
}

function MotifView({
  motif,
  byId,
  items,
  onOpenWord,
  onEdit,
}: {
  motif: ImageryCategory;
  byId: ReadonlyMap<number, ImageryCategory>;
  items: ImageryItem[];
  onOpenWord: (id: number) => void;
  onEdit: () => void;
}) {
  const groups = useMemo(() => {
    const byRole: Record<Role, ImageryItem[]> = {
      primary: [],
      alternative: [],
      part: [],
    };
    for (const item of items) {
      const role = roleOf(item, motif.id);
      if (role) byRole[role].push(item);
    }
    for (const list of Object.values(byRole)) {
      list.sort((a, b) => b.count - a.count);
    }
    return byRole;
  }, [items, motif.id]);
  const parentPath =
    motif.parent_id === null ? "" : categoryPath(motif.parent_id, byId);
  const total =
    groups.primary.length + groups.alternative.length + groups.part.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-3">
          <p className={cn(META_CLASS, "min-w-0 flex-1")}>{parentPath}</p>
          <button type="button" onClick={onEdit} className={TEXT_BUTTON_CLASS}>
            编辑母题
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {motif.description || (
            <span className="text-amber-600 dark:text-amber-400">
              还没有说明，点「编辑母题」补一句它指什么
            </span>
          )}
        </p>
      </div>

      {total === 0 ? (
        <p className="py-6 text-center font-kaiti text-base text-slate-400">
          还没有词登记在这个母题下
        </p>
      ) : (
        (Object.keys(groups) as Role[]).map((role) =>
          groups[role].length === 0 ? null : (
            <section key={role} className="space-y-2">
              <h3 className={LABEL_CLASS}>
                {role === "primary"
                  ? "以它为默认母题的词"
                  : role === "alternative"
                    ? "以它为多义候选的词"
                    : "以它为并列组成的词"}{" "}
                {groups[role].length}
              </h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                {groups[role].map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenWord(item.id)}
                      className="text-sm text-slate-800 hover:text-(--tone) dark:text-slate-200"
                    >
                      {item.name}
                      <span className="ml-1 text-xs tabular-nums text-slate-400">
                        {item.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )
      )}
    </div>
  );
}

function WordView({
  word,
  byId,
  motifs,
  backTo,
  onBack,
  onOpenMotif,
}: {
  word: ImageryItem;
  byId: ReadonlyMap<number, ImageryCategory>;
  motifs: MotifOption[];
  backTo?: ImageryCategory;
  onBack: (motifId: number) => void;
  onOpenMotif: (motifId: number) => void;
}) {
  const setItems = useUpdateCache<ImageryItem>(IMAGERY_KEYS.items);
  const occurrences = useQuery({
    queryKey: ["admin", "imagery", "word-occurrences", word.id],
    queryFn: () => apiGetOccurrencesForImagery(word.id),
  });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<{ id: number | null; role: Role }>({
    id: null,
    role: word.primary === null ? "primary" : "alternative",
  });

  /** 每个母题下这个词有几条标注；去掉有标注的候选会让它们落到候选之外，不让去 */
  const annotatedCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const o of occurrences.data ?? []) {
      counts.set(o.category_id, (counts.get(o.category_id) ?? 0) + 1);
    }
    return counts;
  }, [occurrences.data]);
  const songs = useMemo(() => {
    const bySong = new Map<
      number,
      { id: number; title: string; motifIds: Set<number> }
    >();
    for (const o of occurrences.data ?? []) {
      const entry = bySong.get(o.song_id) ?? {
        id: o.song_id,
        title: o.song_title,
        motifIds: new Set<number>(),
      };
      entry.motifIds.add(o.category_id);
      bySong.set(o.song_id, entry);
    }
    return [...bySong.values()].sort((a, b) =>
      a.title.localeCompare(b.title, "zh-CN"),
    );
  }, [occurrences.data]);

  const nameOf = (id: number) => byId.get(id)?.name ?? `母题 #${id}`;
  const pathOf = (id: number) => categoryPath(id, byId);
  const candidates: Array<{ id: number; role: Role }> = [
    ...(word.primary === null
      ? []
      : [{ id: word.primary, role: "primary" as const }]),
    ...word.alternatives.map((id) => ({ id, role: "alternative" as const })),
    ...word.parts.map((id) => ({ id, role: "part" as const })),
  ];
  const registered = new Set(candidates.map((c) => c.id));

  const save = async (
    next: { primary: number; alternatives: number[]; parts: number[] },
    message: string,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await apiSetWordMotifs(word.id, next);
      setItems((current) =>
        current.map((i) => (i.id === word.id ? { ...i, ...saved } : i)),
      );
      notify({ type: "success", text: message });
      return true;
    } catch (error) {
      notifyError(error, "保存词的母题失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setDefault = (id: number) => {
    if (word.primary === null) return;
    void save(
      {
        primary: id,
        alternatives: [
          word.primary,
          ...word.alternatives.filter((a) => a !== id),
        ],
        parts: word.parts,
      },
      `「${word.name}」的默认母题改为 ${nameOf(id)}`,
    );
  };

  const remove = (id: number) => {
    if (word.primary === null) return;
    void save(
      {
        primary: word.primary,
        alternatives: word.alternatives.filter((a) => a !== id),
        parts: word.parts.filter((p) => p !== id),
      },
      `已从「${word.name}」去掉 ${nameOf(id)}`,
    );
  };

  const add = async () => {
    const { id, role } = adding;
    if (id === null || registered.has(id)) return;
    const next =
      word.primary === null || role === "primary"
        ? {
            primary: id,
            alternatives:
              word.primary === null
                ? word.alternatives
                : [word.primary, ...word.alternatives],
            parts: word.parts,
          }
        : {
            primary: word.primary,
            alternatives:
              role === "alternative"
                ? [...word.alternatives, id]
                : word.alternatives,
            parts: role === "part" ? [...word.parts, id] : word.parts,
          };
    const ok = await save(
      next,
      `「${word.name}」登记了 ${nameOf(id)}（${ROLE_LABEL[next.primary === id ? "primary" : role]}）`,
    );
    if (ok) setAdding({ id: null, role: "alternative" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {backTo && (
          <button
            type="button"
            onClick={() => onBack(backTo.id)}
            className={cn(
              TEXT_BUTTON_CLASS,
              "inline-flex items-center gap-0.5",
            )}
          >
            <ChevronLeft size={12} />
            {backTo.name}
          </button>
        )}
        <p className={META_CLASS}>标注 {word.count} 处</p>
      </div>

      <section className="space-y-2">
        <h3 className={LABEL_CLASS}>登记的母题</h3>
        {candidates.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            还没有默认母题，下面登记一个
          </p>
        ) : (
          <ul>
            {candidates.map((c) => {
              const count = annotatedCount.get(c.id) ?? 0;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-200/70 py-2 text-sm last:border-0 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => onOpenMotif(c.id)}
                    className="min-w-0 text-left text-slate-800 hover:text-(--tone) dark:text-slate-200"
                  >
                    {pathOf(c.id)}
                  </button>
                  <span className={TAG_CLASS}>{ROLE_LABEL[c.role]}</span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {occurrences.isSuccess ? `${count} 处` : ""}
                  </span>
                  <span className="ml-auto flex gap-3">
                    {c.role === "alternative" && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDefault(c.id)}
                        className={TEXT_BUTTON_CLASS}
                      >
                        设为默认
                      </button>
                    )}
                    {c.role !== "primary" && (
                      <button
                        type="button"
                        disabled={saving || !occurrences.isSuccess || count > 0}
                        title={
                          count > 0
                            ? "这个母题下还有标注，先到歌曲里改标或删掉"
                            : undefined
                        }
                        onClick={() => remove(c.id)}
                        className={TEXT_BUTTON_CLASS}
                      >
                        去掉
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <select
            aria-label="要登记的母题"
            value={adding.id ?? ""}
            onChange={(e) =>
              setAdding({
                ...adding,
                id: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={cn(SELECT_CLASS, "min-w-0 flex-1")}
          >
            <option value="">登记一个母题…</option>
            {motifs
              .filter((m) => !registered.has(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </select>
          {word.primary !== null && (
            <select
              aria-label="登记为"
              value={adding.role}
              onChange={(e) =>
                setAdding({ ...adding, role: e.target.value as Role })
              }
              className={cn(SELECT_CLASS, "w-auto")}
            >
              <option value="alternative">多义候选</option>
              <option value="part">并列组成</option>
              <option value="primary">默认母题</option>
            </select>
          )}
          <button
            type="button"
            disabled={adding.id === null || saving}
            onClick={() => void add()}
            className={SOLID_BUTTON_CLASS}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            登记
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          多义候选：同一个词在不同歌里指不同的东西，标注时按语境选。并列组成：「风雨」标了风，再写一条雨。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className={LABEL_CLASS}>标在哪些歌里 {songs.length}</h3>
        {occurrences.isPending ? (
          <LoadingState text="加载标注…" />
        ) : occurrences.isError ? (
          <ErrorState
            message={occurrences.error.message}
            onRetry={() => void occurrences.refetch()}
          />
        ) : songs.length === 0 ? (
          <p className="text-sm text-slate-400">还没有标注</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {songs.map((song) => (
              <li
                key={song.id}
                className="flex items-baseline gap-3 border-b border-slate-200/70 py-1.5 text-sm last:border-0 dark:border-slate-800"
              >
                <Link
                  href={`/admin/songs/${song.id}?tab=imagery`}
                  className="min-w-0 flex-1 truncate text-slate-800 hover:text-(--tone) dark:text-slate-200"
                >
                  {song.title}
                </Link>
                <span className="shrink-0 text-xs text-slate-400">
                  {[...song.motifIds].map(nameOf).join("、")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
