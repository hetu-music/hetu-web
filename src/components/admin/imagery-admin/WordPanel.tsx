"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  apiGetOccurrencesForImagery,
  apiSetWordMotifs,
} from "@/lib/api/client-api";
import {
  categoryPath,
  type MotifOption,
  WORD_ROLE,
} from "@/lib/imagery/word-motifs";
import type { ImageryCategory, ImageryItem } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { ErrorState, LoadingState } from "../kit/parts";
import {
  LABEL_CLASS,
  META_CLASS,
  SELECT_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";
import { IMAGERY_KEYS, useUpdateCache } from "./queries";

type WordMotifs = { primary: number; alternatives: number[]; parts: number[] };

/**
 * 一个词归到哪些母题、标在哪些歌里。意象库右侧（窄屏是底部抽屉）显示。
 * 这里改的是这个词以后的可选母题（imagery_motifs），不动已有的标注。
 */
export default function WordPanel({
  word,
  categories,
  motifs,
  onClose,
}: {
  word: ImageryItem;
  categories: ImageryCategory[];
  motifs: MotifOption[];
  onClose?: () => void;
}) {
  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const setItems = useUpdateCache<ImageryItem>(IMAGERY_KEYS.items);
  const occurrences = useQuery({
    queryKey: ["admin", "imagery", "word-occurrences", word.id],
    queryFn: () => apiGetOccurrencesForImagery(word.id),
  });
  const [saving, setSaving] = useState(false);

  /** 每个母题下这个词有几条标注：还有标注的不能去掉，否则那些标注会落到可选范围之外 */
  const annotated = useMemo(() => {
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
  const registered = new Set([
    ...(word.primary === null ? [] : [word.primary]),
    ...word.alternatives,
    ...word.parts,
  ]);
  const ready = occurrences.isSuccess;

  const save = async (next: WordMotifs, message: string) => {
    if (saving) return false;
    setSaving(true);
    try {
      const saved = await apiSetWordMotifs(word.id, next);
      setItems((current) =>
        current.map((i) => (i.id === word.id ? { ...i, ...saved } : i)),
      );
      notify({ type: "success", text: message });
      return true;
    } catch (error) {
      notifyError(error, "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * 换「通常算作」。原来的那个下面还有标注就留作「有时也指」，没有就去掉
   * （多半是当初选错了，比如「汗」挂过新建的母题汗）
   */
  const changePrimary = (id: number) => {
    const old = word.primary;
    const keepOld = old !== null && (annotated.get(old) ?? 0) > 0;
    void save(
      {
        primary: id,
        alternatives: [
          ...(keepOld && old !== null ? [old] : []),
          ...word.alternatives.filter((a) => a !== id),
        ],
        parts: word.parts.filter((p) => p !== id),
      },
      keepOld && old !== null
        ? `「${word.name}」通常算作 ${nameOf(id)}；${nameOf(old)} 下还有标注，留作「有时也指」`
        : `「${word.name}」通常算作 ${nameOf(id)}`,
    );
  };

  const add = (role: "alternative" | "part", id: number) => {
    if (word.primary === null) return Promise.resolve(false);
    return save(
      {
        primary: word.primary,
        alternatives:
          role === "alternative"
            ? [...word.alternatives, id]
            : word.alternatives,
        parts: role === "part" ? [...word.parts, id] : word.parts,
      },
      `「${word.name}」${WORD_ROLE[role].label} ${nameOf(id)}`,
    );
  };

  const remove = (role: "alternative" | "part", id: number) => {
    if (word.primary === null) return;
    void save(
      {
        primary: word.primary,
        alternatives:
          role === "alternative"
            ? word.alternatives.filter((a) => a !== id)
            : word.alternatives,
        parts:
          role === "part" ? word.parts.filter((p) => p !== id) : word.parts,
      },
      `「${word.name}」不再${WORD_ROLE[role].label} ${nameOf(id)}`,
    );
  };

  const available = motifs.filter((m) => !registered.has(m.id));

  return (
    <div className="space-y-7">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl text-slate-900 dark:text-slate-100">
            {word.name}
          </h2>
          <p className={cn(META_CLASS, "mt-1")}>
            标注 {word.count} 处{ready ? ` · ${songs.length} 首歌` : ""}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        )}
      </header>

      <section className="space-y-1.5">
        <h3 className={LABEL_CLASS}>{WORD_ROLE.primary.label}</h3>
        <select
          aria-label={WORD_ROLE.primary.label}
          value={word.primary ?? ""}
          disabled={saving}
          onChange={(e) =>
            e.target.value && changePrimary(Number(e.target.value))
          }
          className={SELECT_CLASS}
        >
          {word.primary === null && <option value="">选一个母题…</option>}
          {motifs.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {WORD_ROLE.primary.help}
        </p>
      </section>

      {(["alternative", "part"] as const).map((role) => (
        <RoleSection
          key={role}
          role={role}
          ids={role === "alternative" ? word.alternatives : word.parts}
          available={available}
          annotated={annotated}
          ready={ready}
          saving={saving}
          disabled={word.primary === null}
          nameOf={nameOf}
          pathOf={(id) => categoryPath(id, byId)}
          onAdd={(id) => add(role, id)}
          onRemove={(id) => remove(role, id)}
        />
      ))}

      <section className="space-y-2">
        <h3 className={LABEL_CLASS}>出现在</h3>
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
          <ul>
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

function RoleSection({
  role,
  ids,
  available,
  annotated,
  ready,
  saving,
  disabled,
  nameOf,
  pathOf,
  onAdd,
  onRemove,
}: {
  role: "alternative" | "part";
  ids: number[];
  available: MotifOption[];
  annotated: ReadonlyMap<number, number>;
  ready: boolean;
  saving: boolean;
  /** 还没有「通常算作」时先选那个 */
  disabled: boolean;
  nameOf: (id: number) => string;
  pathOf: (id: number) => string;
  onAdd: (id: number) => Promise<boolean>;
  onRemove: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const { label, help } = WORD_ROLE[role];

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline gap-3">
        <h3 className={cn(LABEL_CLASS, "flex-1")}>{label}</h3>
        {!adding && (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => setAdding(true)}
            className={TEXT_BUTTON_CLASS}
          >
            + 添加
          </button>
        )}
      </div>
      {ids.length === 0 ? (
        <p className="text-sm text-slate-400">（无）</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const count = annotated.get(id) ?? 0;
            const locked = !ready || count > 0;
            return (
              <li
                key={id}
                title={pathOf(id)}
                className="inline-flex items-center gap-1.5 rounded border border-slate-200 py-0.5 pr-1 pl-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {nameOf(id)}
                {ready && count > 0 && (
                  <span className="text-xs tabular-nums text-slate-400">
                    {count}
                  </span>
                )}
                <button
                  type="button"
                  disabled={locked || saving}
                  onClick={() => onRemove(id)}
                  aria-label={`去掉 ${nameOf(id)}`}
                  title={
                    count > 0
                      ? `还有 ${count} 处标注挂在 ${nameOf(id)} 下，先到歌曲里改标或删掉`
                      : undefined
                  }
                  className="text-slate-400 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-400"
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            aria-label={`${label}的母题`}
            autoFocus
            value={choice ?? ""}
            onChange={(e) =>
              setChoice(e.target.value ? Number(e.target.value) : null)
            }
            className={cn(SELECT_CLASS, "min-w-0 flex-1")}
          >
            <option value="">选一个母题…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={choice === null || saving}
            onClick={async () => {
              if (choice === null) return;
              if (await onAdd(choice)) {
                setAdding(false);
                setChoice(null);
              }
            }}
            className={SOLID_BUTTON_CLASS}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            添加
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setChoice(null);
            }}
            className={TEXT_BUTTON_CLASS}
          >
            取消
          </button>
        </div>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">{help}</p>
    </section>
  );
}
