"use client";

import { Fragment, useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/ui/useMediaQuery";
import { Link } from "@/i18n/navigation";
import { apiCreateMotif, apiUpdateMotif } from "@/lib/api/client-api";
import type { MotifPayload } from "@/lib/forms/imagery-form";
import { motifOptions, motifPaths, WORD_ROLE } from "@/lib/imagery/word-motifs";
import {
  IMAGERY_DOMAINS,
  type ImageryItem,
  type ImageryTaxonomy,
  type Motif,
} from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import AdminShell from "../kit/AdminShell";
import {
  AdminOptions,
  AdminToolbar,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from "../kit/parts";
import {
  META_CLASS,
  OUTLINE_BUTTON_CLASS,
  PANEL_CLASS,
  SOLID_BUTTON_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";
import { CleanupMotifsDialog } from "./CleanupMotifsDialog";
import MotifFormDialog, { type MotifFormTarget } from "./MotifFormDialog";
import {
  useImageryItemsQuery,
  useImageryTaxonomyQuery,
  useUpdateMotifs,
} from "./queries";
import WordPanel from "./WordPanel";

/** 每个母题先列这么多个词，其余点「还有 N 个」展开 */
const WORDS_SHOWN = 16;
/** 类别栏的「全部」；其余选项是类别 id 的字符串 */
const ALL = "all";

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "zh-CN");

/** 词带「有时也指」或「同时算进」时，悬停看到的说明 */
function extraNote(
  item: ImageryItem,
  nameOf: (id: number) => string,
): string | null {
  const notes = [
    item.alternatives.length > 0 &&
      `${WORD_ROLE.alternative.label}：${item.alternatives.map(nameOf).join("、")}`,
    item.parts.length > 0 &&
      `${WORD_ROLE.part.label}：${item.parts.map(nameOf).join("、")}`,
  ].filter(Boolean);
  return notes.length > 0 ? notes.join("；") : null;
}

/**
 * 意象库：按类别列出母题，每个母题下直接摊开它的词；点词在右侧（窄屏是底部抽屉）改它归到哪些母题。
 *
 * 门类与类别固定（见 IMAGERY.md），只在类别栏里当分组；这里只增改母题。
 * 词在标注时按歌词原文创建，不单独新建或改名。界面上的叫法见 WordPanel 的 WORD_ROLE。
 */
export default function MotifsClient({
  initialTaxonomy,
}: {
  initialTaxonomy: ImageryTaxonomy;
}) {
  const taxonomyQuery = useImageryTaxonomyQuery(initialTaxonomy);
  const taxonomy = taxonomyQuery.data ?? initialTaxonomy;
  const { categories, motifs: allMotifs } = taxonomy;
  const itemsQuery = useImageryItemsQuery();
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const setMotifs = useUpdateMotifs();
  const wide = useMediaQuery("(min-width: 1024px)");

  const [group, setGroup] = useState<string>(ALL);
  const [term, setTerm] = useState("");
  const [wordId, setWordId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [form, setForm] = useState<MotifFormTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const motifById = useMemo(
    () => new Map(allMotifs.map((m) => [m.id, m])),
    [allMotifs],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const nameOf = (id: number) => motifById.get(id)?.name ?? `母题 #${id}`;
  /** 类别的路径「门类 / 类别」 */
  const categoryLabel = (id: number) => {
    const c = categoryById.get(id);
    return c ? `${c.domain} / ${c.name}` : `类别 #${id}`;
  };
  const pathOf = useMemo(() => motifPaths(taxonomy), [taxonomy]);
  const motifs = useMemo(() => motifOptions(taxonomy), [taxonomy]);

  /** 类别栏：按门类分行，门类只是行首的小字 */
  const groupRows = useMemo(
    () =>
      IMAGERY_DOMAINS.map((domain) => ({
        domain,
        groups: categories.filter((c) => c.domain === domain).sort(byName),
      })),
    [categories],
  );

  /** 母题 → 通常算作它的词（按标注多少排）、有时也指它或同时算进它的词 */
  const wordsOf = useMemo(() => {
    const map = new Map<
      number,
      { main: ImageryItem[]; other: ImageryItem[] }
    >();
    const entry = (id: number) => {
      let e = map.get(id);
      if (!e) map.set(id, (e = { main: [], other: [] }));
      return e;
    };
    for (const item of items) {
      if (item.primary !== null) entry(item.primary).main.push(item);
      for (const id of [...item.alternatives, ...item.parts]) {
        entry(id).other.push(item);
      }
    }
    for (const e of map.values()) {
      e.main.sort((a, b) => b.count - a.count);
      e.other.sort((a, b) => b.count - a.count);
    }
    return map;
  }, [items]);

  const query = term.trim().toLowerCase();
  const matches = (item: ImageryItem) =>
    query !== "" && item.name.toLowerCase().includes(query);

  /** 列表里要显示的母题：搜索时跨类别找母题名或词，否则按类别（React Compiler 负责记忆化） */
  const shown = query
    ? allMotifs
        .filter(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            (wordsOf.get(m.id)?.main ?? []).some((i) =>
              i.name.toLowerCase().includes(query),
            ),
        )
        .sort(byName)
    : allMotifs
        .filter((m) => group === ALL || m.category_id === Number(group))
        .sort((a, b) => pathOf(a.id).localeCompare(pathOf(b.id), "zh-CN"));

  const unassigned = items
    .filter((i) => i.primary === null)
    .filter((i) => !query || i.name.toLowerCase().includes(query));
  const word = items.find((i) => i.id === wordId) ?? null;

  const submitMotif = async (values: MotifPayload) => {
    if (!form || submitting) return;
    setSubmitting(true);
    try {
      if (form.type === "add") {
        const created = await apiCreateMotif(values);
        setMotifs((current) => [...current, created]);
        notify({ type: "success", text: `母题「${created.name}」已创建` });
      } else {
        const updated = await apiUpdateMotif(form.motif.id, values);
        setMotifs((current) =>
          current.map((m) => (m.id === updated.id ? updated : m)),
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

  const wordButton = (item: ImageryItem, muted = false) => {
    const note = extraNote(item, nameOf);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setWordId(item.id)}
        title={note ?? undefined}
        aria-pressed={item.id === wordId}
        className={cn(
          "text-sm transition-colors hover:text-(--tone)",
          item.id === wordId
            ? "text-(--tone)"
            : matches(item)
              ? "font-medium text-ink"
              : muted
                ? "text-ink-meta"
                : "text-ink-prose",
        )}
      >
        {item.name}
        {note && <sup className="ml-px text-[10px] text-(--tone)">+</sup>}
      </button>
    );
  };

  const renderMotif = (motif: Motif) => {
    const { main = [], other = [] } = wordsOf.get(motif.id) ?? {};
    const open = expanded.has(motif.id) || query !== "";
    const visible = open ? main : main.slice(0, WORDS_SHOWN);
    return (
      <li
        key={motif.id}
        className="border-b border-slate-200/70 py-3 dark:border-slate-800"
      >
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={() => setForm({ type: "edit", motif })}
            title="编辑母题"
            className="shrink-0 font-serif text-base text-ink hover:text-(--tone)"
          >
            {motif.name}
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-ink-meta">
            {motif.description || (
              <span className="text-amber-600 dark:text-amber-400">
                还没有说明
              </span>
            )}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink-meta">
            {main.length} 个词
          </span>
        </div>
        {(query || group === ALL) && (
          <p className={cn(META_CLASS, "mt-0.5")}>
            {categoryLabel(motif.category_id)}
          </p>
        )}
        {main.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {visible.map((item) => wordButton(item))}
            {!open && main.length > WORDS_SHOWN && (
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => new Set(current).add(motif.id))
                }
                className="text-xs text-ink-meta hover:text-(--tone)"
              >
                还有 {main.length - WORDS_SHOWN} 个
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-ink-meta">还没有词通常算作它</p>
        )}
        {other.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-meta">
            <span>也会算到这里：</span>
            {other.map((item) => wordButton(item, true))}
          </p>
        )}
      </li>
    );
  };

  const failed = [taxonomyQuery, itemsQuery].find((q) => q.isError);
  const panel = word ? (
    <WordPanel
      key={word.id}
      word={word}
      taxonomy={taxonomy}
      motifs={motifs}
      onClose={() => setWordId(null)}
    />
  ) : null;

  return (
    <AdminShell
      section="imagery"
      title="意象"
      description={
        <>
          按类别列出母题和通常算作它的词，点词修改它算到哪些母题。某首歌标了哪些意象，到
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
        { label: "母题", value: allMotifs.length },
        { label: "词", value: items.length },
        ...(unassigned.length > 0 && !query
          ? [{ label: "没有归类", value: unassigned.length }]
          : []),
      ]}
      actions={
        <>
          <button
            type="button"
            onClick={() => setCleaning(true)}
            className={OUTLINE_BUTTON_CLASS}
          >
            整理
          </button>
          <button
            type="button"
            onClick={() =>
              setForm({
                type: "add",
                categoryId: group === ALL ? 0 : Number(group),
              })
            }
            className={SOLID_BUTTON_CLASS}
          >
            新增母题
          </button>
        </>
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

      {!query && (
        <div className="mb-6 space-y-1.5">
          <AdminOptions
            items={[{ id: ALL, label: "全部" }]}
            active={group}
            onSelect={setGroup}
          />
          {groupRows.map(({ domain, groups }) => (
            <div key={domain} className="flex items-baseline gap-3">
              <span className="w-8 shrink-0 text-xs text-ink-meta">
                {domain}
              </span>
              <AdminOptions
                items={groups.map((g) => ({ id: String(g.id), label: g.name }))}
                active={group}
                onSelect={setGroup}
              />
            </div>
          ))}
        </div>
      )}

      {failed?.error ? (
        <ErrorState
          message={failed.error.message}
          onRetry={() => void failed.refetch()}
        />
      ) : itemsQuery.isPending ? (
        <LoadingState text="加载意象词典…" />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {unassigned.length > 0 && (group === ALL || query) && (
              <section className="mb-4 rounded-md border border-amber-300/60 px-4 py-3 dark:border-amber-500/40">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  这些词还没有「通常算作」，点开选一个母题
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {unassigned.map((item) => wordButton(item))}
                </div>
              </section>
            )}
            {shown.length === 0 ? (
              <EmptyState>
                {query ? `没有找到「${term.trim()}」` : "这个类别还没有母题"}
              </EmptyState>
            ) : (
              <ul>
                {shown.map((motif, i) => (
                  <Fragment key={motif.id}>
                    {!query &&
                      group === ALL &&
                      (i === 0 ||
                        shown[i - 1].category_id !== motif.category_id) && (
                        <li className="pt-6 first:pt-0">
                          <h2 className="font-serif text-sm text-ink-muted">
                            {categoryLabel(motif.category_id)}
                          </h2>
                        </li>
                      )}
                    {renderMotif(motif)}
                  </Fragment>
                ))}
              </ul>
            )}
          </div>

          {wide && (
            <aside
              className={cn(
                PANEL_CLASS,
                "sticky top-[calc(var(--nav-h)+4rem)] max-h-[calc(100dvh-var(--nav-h)-5rem)] self-start overflow-y-auto p-5",
              )}
            >
              {panel ?? (
                <div className="space-y-3 text-sm text-ink-muted">
                  <p>点左边的词，查看并修改它算到哪些母题：</p>
                  <dl className="space-y-2 text-xs">
                    {(["primary", "alternative", "part"] as const).map(
                      (role) => (
                        <div key={role}>
                          <dt className="text-ink-prose">
                            {WORD_ROLE[role].label}
                          </dt>
                          <dd className="text-ink-meta">
                            {WORD_ROLE[role].help}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <p className="text-xs text-ink-meta">
                    词旁的 <sup className="text-(--tone)">+</sup>{" "}
                    表示它还有「有时也指」或「同时算进」，悬停可看。
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {!wide && (
        <Drawer
          open={word !== null}
          onOpenChange={(next) => !next && setWordId(null)}
        >
          <DrawerContent className="max-h-[85dvh]">
            <DrawerTitle className="sr-only">{word?.name ?? "词"}</DrawerTitle>
            {panel}
          </DrawerContent>
        </Drawer>
      )}

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
        categoryLabel={categoryLabel}
        onDeleted={(ids) => {
          const gone = new Set(ids);
          setMotifs((current) => current.filter((m) => !gone.has(m.id)));
          void itemsQuery.refetch();
        }}
      />
    </AdminShell>
  );
}
