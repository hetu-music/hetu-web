"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { apiCreateMotif, apiUpdateMotif } from "@/lib/api/client-api";
import type { MotifPayload } from "@/lib/forms/imagery-form";
import {
  categoryPath,
  isMotif,
  motifOptions,
  wordMotifIds,
} from "@/lib/imagery/word-motifs";
import type { ImageryCategory, ImageryItem } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import AdminShell from "../kit/AdminShell";
import {
  AdminToolbar,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from "../kit/parts";
import {
  META_CLASS,
  OUTLINE_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";
import { CleanupMotifsDialog } from "./CleanupMotifsDialog";
import MotifFormDialog, { type MotifFormTarget } from "./MotifFormDialog";
import MotifPanel, { type PanelView } from "./MotifPanel";
import {
  IMAGERY_KEYS,
  useImageryCategoriesQuery,
  useImageryItemsQuery,
  useUpdateCache,
} from "./queries";

const SEARCH_LIMIT = 60;

/**
 * 意象库：门类 › 类别 › 母题，点母题看登记在它下面的词，点词改它的候选母题。
 *
 * 门类与类别固定（增减要先讨论，见 IMAGERY.md），这里只增改母题。词在标注时按歌词原文创建，
 * 不单独新建或改名；词能取哪些母题只看 imagery_motifs。
 */
export default function MotifsClient({
  initialCategories,
}: {
  initialCategories: ImageryCategory[];
}) {
  const categoriesQuery = useImageryCategoriesQuery(initialCategories);
  const categories = categoriesQuery.data ?? initialCategories;
  const itemsQuery = useImageryItemsQuery();
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const setCategories = useUpdateCache<ImageryCategory>(
    IMAGERY_KEYS.categories,
  );

  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState<PanelView | null>(null);
  const [form, setForm] = useState<MotifFormTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const motifs = useMemo(() => motifOptions(categories), [categories]);

  /** 门类 › 类别 › 母题，各层按名称排 */
  const tree = useMemo(() => {
    const children = new Map<number | null, ImageryCategory[]>();
    for (const c of categories) {
      const list = children.get(c.parent_id) ?? [];
      list.push(c);
      children.set(c.parent_id, list);
    }
    const sorted = (id: number | null) =>
      [...(children.get(id) ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-CN"),
      );
    return sorted(null).map((top) => ({
      ...top,
      groups: sorted(top.id).map((group) => ({
        ...group,
        motifs: sorted(group.id).filter(isMotif),
      })),
    }));
  }, [categories]);

  /** 每个母题登记了几个词（默认、多义、并列都算） */
  const wordCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      for (const id of [...wordMotifIds(item), ...item.parts]) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  const query = term.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    return {
      motifs: categories
        .filter((c) => isMotif(c) && c.name.toLowerCase().includes(query))
        .slice(0, SEARCH_LIMIT),
      words: items
        .filter((i) => i.name.toLowerCase().includes(query))
        .sort(
          (a, b) =>
            Number(b.name.toLowerCase() === query) -
              Number(a.name.toLowerCase() === query) || b.count - a.count,
        )
        .slice(0, SEARCH_LIMIT),
    };
  }, [categories, items, query]);

  const motifCount = categories.filter(isMotif).length;
  const unregistered = items.filter((i) => i.primary === null).length;

  const submitMotif = async (values: MotifPayload) => {
    if (!form || submitting) return;
    setSubmitting(true);
    try {
      if (form.type === "add") {
        const created = await apiCreateMotif(values);
        setCategories((current) => [...current, created]);
        setOpen((current) => new Set(current).add(created.parent_id ?? 0));
        notify({ type: "success", text: `母题「${created.name}」已创建` });
      } else {
        const updated = await apiUpdateMotif(form.motif.id, values);
        setCategories((current) =>
          current.map((c) => (c.id === updated.id ? updated : c)),
        );
        notify({ type: "success", text: "母题已更新" });
      }
      setForm(null);
    } catch (error) {
      notifyError(error, "保存母题失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = (id: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderMotif = (motif: ImageryCategory) => (
    <li key={motif.id}>
      <button
        type="button"
        onClick={() => setPanel({ type: "motif", id: motif.id })}
        className="flex w-full items-baseline gap-2 py-1 text-left text-sm hover:text-(--tone)"
      >
        <span className="shrink-0 text-slate-700 dark:text-slate-300">
          {motif.name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {wordCount.get(motif.id) ?? 0}
        </span>
        <span className="min-w-0 truncate text-xs text-slate-400 dark:text-slate-500">
          {motif.description}
        </span>
      </button>
    </li>
  );

  const renderWord = (item: ImageryItem) => (
    <li key={item.id}>
      <button
        type="button"
        onClick={() => setPanel({ type: "word", id: item.id })}
        className="flex w-full items-baseline gap-2 py-1 text-left text-sm hover:text-(--tone)"
      >
        <span className="shrink-0 text-slate-800 dark:text-slate-200">
          {item.name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {item.count}
        </span>
        <span className="min-w-0 truncate text-xs text-slate-400">
          {item.primary === null ? (
            <span className="text-amber-600 dark:text-amber-400">
              没有默认母题
            </span>
          ) : (
            categoryPath(item.primary, byId)
          )}
        </span>
      </button>
    </li>
  );

  const failed = [categoriesQuery, itemsQuery].find((q) => q.isError);

  return (
    <AdminShell
      section="imagery"
      title="意象"
      description={
        <>
          门类 › 类别 ›
          母题。每个词登记一个默认母题，多义词另有候选。某首歌标了哪些意象，到
          <Link
            href="/admin/songs"
            className="mx-1 text-(--tone) hover:opacity-75"
          >
            歌曲
          </Link>
          里打开那首歌编辑。
        </>
      }
      stats={[
        {
          label: "类别",
          value: categories.filter((c) => c.level === 2).length,
        },
        { label: "母题", value: motifCount },
        { label: "词", value: items.length },
        ...(unregistered > 0
          ? [{ label: "没有默认母题", value: unregistered }]
          : []),
      ]}
      actions={
        <button
          type="button"
          onClick={() => setCleaning(true)}
          className={OUTLINE_BUTTON_CLASS}
        >
          整理
        </button>
      }
    >
      <AdminToolbar
        search={
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="搜索母题或词"
          />
        }
      />

      {failed?.error ? (
        <ErrorState
          message={failed.error.message}
          onRetry={() => void failed.refetch()}
        />
      ) : itemsQuery.isPending ? (
        <LoadingState text="加载意象词典…" />
      ) : results ? (
        results.motifs.length === 0 && results.words.length === 0 ? (
          <EmptyState>没有找到「{term.trim()}」</EmptyState>
        ) : (
          <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            <section>
              <h2 className={META_CLASS}>母题 {results.motifs.length}</h2>
              <ul className="mt-2">{results.motifs.map(renderMotif)}</ul>
            </section>
            <section>
              <h2 className={META_CLASS}>词 {results.words.length}</h2>
              <ul className="mt-2">{results.words.map(renderWord)}</ul>
            </section>
          </div>
        )
      ) : (
        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {tree.map((top) => (
            <section key={top.id} className="min-w-0">
              <h2 className="border-b border-slate-200/70 pb-2 font-serif text-base text-slate-900 dark:border-slate-800 dark:text-slate-100">
                {top.name}
                <span className="ml-2 text-xs tabular-nums text-slate-400">
                  {top.groups.reduce((n, g) => n + g.motifs.length, 0)}
                </span>
              </h2>
              <div className="mt-2">
                {top.groups.map((group) => {
                  const expanded = open.has(group.id);
                  return (
                    <div key={group.id}>
                      <div className="group flex items-baseline gap-2 py-1.5 text-sm">
                        <button
                          type="button"
                          onClick={() => toggle(group.id)}
                          aria-expanded={expanded}
                          className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left text-slate-700 dark:text-slate-300"
                        >
                          <ChevronRight
                            size={12}
                            className={cn(
                              "shrink-0 translate-y-px text-slate-400 transition-transform",
                              expanded && "rotate-90",
                            )}
                          />
                          <span className="truncate">{group.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">
                            {group.motifs.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ type: "add", parentId: group.id })
                          }
                          className={cn(
                            TEXT_BUTTON_CLASS,
                            "shrink-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
                          )}
                        >
                          加母题
                        </button>
                      </div>
                      {expanded && (
                        <ul className="mb-2 ml-1.5 border-l border-slate-200/70 pl-4 dark:border-slate-800">
                          {group.motifs.length > 0 ? (
                            group.motifs.map(renderMotif)
                          ) : (
                            <li className="py-1 text-xs text-slate-400">
                              还没有母题
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <MotifPanel
        view={panel}
        categories={categories}
        items={items}
        motifs={motifs}
        onNavigate={setPanel}
        onEditMotif={(motif) => setForm({ type: "edit", motif })}
        onClose={() => setPanel(null)}
      />

      <MotifFormDialog
        target={form}
        categories={categories}
        submitting={submitting}
        onClose={() => setForm(null)}
        onSubmit={submitMotif}
      />

      <CleanupMotifsDialog
        open={cleaning}
        onClose={() => setCleaning(false)}
        getCategoryPath={(id) => categoryPath(id, byId)}
        onDeleted={(ids) => {
          const gone = new Set(ids);
          setCategories((current) => current.filter((c) => !gone.has(c.id)));
          void itemsQuery.refetch();
        }}
      />
    </AdminShell>
  );
}
