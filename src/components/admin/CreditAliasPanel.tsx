"use client";

import {
  apiCreateCreditAlias,
  apiDeleteCreditAlias,
  apiGetCreditAliases,
} from "@/lib/api/client-api";
import type { CreditAliasRow } from "@/lib/server/service-credit-aliases";
import type { CreditField } from "@/lib/types";
import type { CreditNameUsage } from "@/lib/utils/utils-credits";
import { ArrowRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import SectionHeading from "@/components/detail/SectionHeading";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from "./kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  WARN_TEXT_CLASS,
} from "./kit/styles";
import { notify } from "./kit/toast";

const ROLE_LABELS: Record<CreditField, string> = {
  lyricist: "作词",
  composer: "作曲",
  arranger: "编曲",
  artist: "演唱",
  albumartist: "出品发行",
};

function describeUsage(usage: CreditNameUsage | undefined) {
  if (!usage) return null;
  return `${usage.songs} 首 · ${usage.roles.map((r) => ROLE_LABELS[r]).join(" / ")}`;
}

export default function CreditAliasPanel({ csrfToken }: { csrfToken: string }) {
  const [aliases, setAliases] = useState<CreditAliasRow[]>([]);
  const [names, setNames] = useState<CreditNameUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [aliasInput, setAliasInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // 只在异步回调里 setState；首屏的 loading 初值就是 true
  const fetchData = useCallback(
    () =>
      apiGetCreditAliases()
        .then((data) => {
          setAliases(data.aliases);
          setNames(data.names);
        })
        .catch((e: unknown) => {
          setLoadError(e instanceof Error ? e.message : "加载失败");
        })
        .finally(() => setLoading(false)),
    [],
  );

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const usageByName = useMemo(
    () => new Map(names.map((n) => [n.name, n])),
    [names],
  );
  const aliasSet = useMemo(
    () => new Set(aliases.map((a) => a.alias)),
    [aliases],
  );
  const mainSet = useMemo(() => new Set(aliases.map((a) => a.name)), [aliases]);

  // 候选按使用次数排，常见的名字在前；数据库只许一层归并，这里先把不合规的剔掉
  const sortedNames = useMemo(
    () => [...names].sort((a, b) => b.songs - a.songs),
    [names],
  );
  const aliasOptions = sortedNames.filter(
    (n) => !aliasSet.has(n.name) && !mainSet.has(n.name),
  );
  const nameOptions = sortedNames.filter((n) => !aliasSet.has(n.name));

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byName = new Map<string, CreditAliasRow[]>();
    for (const row of aliases) {
      if (
        q &&
        !row.alias.toLowerCase().includes(q) &&
        !row.name.toLowerCase().includes(q)
      ) {
        continue;
      }
      byName.set(row.name, [...(byName.get(row.name) ?? []), row]);
    }
    return [...byName].sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
  }, [aliases, query]);

  const flash = (ok: boolean, text: string) =>
    notify({ type: ok ? "success" : "error", text });

  const alias = aliasInput.trim();
  const name = nameInput.trim();
  const formError =
    alias && name && alias === name
      ? "别名不能与主名相同"
      : aliasSet.has(alias)
        ? "这个名字已登记为别名"
        : mainSet.has(alias)
          ? "这个名字已是主名，不能再当别名"
          : aliasSet.has(name)
            ? "主名本身是别名，请填它对应的主名"
            : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias || !name || formError) return;
    setSubmitting(true);
    try {
      const created = await apiCreateCreditAlias(alias, name, csrfToken);
      setAliases((prev) => [...prev, created]);
      setAliasInput("");
      flash(true, `已登记：${created.alias} → ${created.name}`);
    } catch (err) {
      flash(false, err instanceof Error ? err.message : "登记失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (target: string) => {
    setDeleting(target);
    try {
      await apiDeleteCreditAlias(target, csrfToken);
      setAliases((prev) => prev.filter((a) => a.alias !== target));
      flash(true, `已删除别名：${target}`);
    } catch (err) {
      flash(false, err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  const aliasUsage = usageByName.get(alias);
  const nameUsage = usageByName.get(name);

  return (
    <div className="space-y-16">
      <form onSubmit={handleSubmit}>
        <SectionHeading label="登记" />
        <div className="mt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-start">
            <div className="space-y-1 min-w-0">
              <label htmlFor="credit-alias" className={LABEL_CLASS}>
                别名（作品上的署名）
              </label>
              <input
                id="credit-alias"
                list="credit-alias-options"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="如 萧忆情Alex"
                autoComplete="off"
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-slate-400 min-h-4">
                {alias &&
                  (describeUsage(aliasUsage) ?? (
                    <span className={WARN_TEXT_CLASS}>
                      曲库里没有署这个名字的歌
                    </span>
                  ))}
              </p>
            </div>

            <ArrowRight
              size={16}
              className="hidden md:block mt-8 text-slate-300 dark:text-slate-600"
              aria-hidden
            />

            <div className="space-y-1 min-w-0">
              <label htmlFor="credit-name" className={LABEL_CLASS}>
                主名（全站统一显示）
              </label>
              <input
                id="credit-name"
                list="credit-name-options"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="如 萧忆情"
                autoComplete="off"
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-slate-400 min-h-4">
                {name && (describeUsage(nameUsage) ?? "曲库里还没有这个名字")}
              </p>
            </div>

            <button
              type="submit"
              disabled={!alias || !name || !!formError || submitting}
              className={`${SOLID_BUTTON_CLASS} md:mt-6`}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              登记
            </button>
          </div>

          <datalist id="credit-alias-options">
            {aliasOptions.map((n) => (
              <option key={n.name} value={n.name}>
                {describeUsage(n)}
              </option>
            ))}
          </datalist>
          <datalist id="credit-name-options">
            {nameOptions.map((n) => (
              <option key={n.name} value={n.name}>
                {describeUsage(n)}
              </option>
            ))}
          </datalist>

          <div className="min-h-5 text-xs">
            {formError ? (
              <span className="text-rose-500">{formError}</span>
            ) : (
              <span className="text-slate-400">
                只登记同一个人的不同署名。录入错字请直接在歌曲资料里改。登记后卷首、列表、筛选显示主名，版记照录原署。
              </span>
            )}
          </div>
        </div>
      </form>

      <section>
        <SectionHeading label={`已登记 ${aliases.length}`}>
          <button type="button" onClick={load} className={TEXT_BUTTON_CLASS}>
            刷新
          </button>
        </SectionHeading>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="查找别名或主名"
          className="mt-6"
        />

        {groups.length === 0 ? (
          <EmptyState>
            {aliases.length === 0 ? "还没有登记任何别名" : "没有匹配的别名"}
          </EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200/70 border-y border-slate-200/70 dark:divide-slate-800 dark:border-slate-800">
            {groups.map(([main, rows]) => (
              <li
                key={main}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <div className="sm:w-56 shrink-0 min-w-0">
                  <button
                    type="button"
                    onClick={() => setNameInput(main)}
                    className="text-left text-sm text-slate-900 transition-colors wrap-break-word hover:text-(--tone) dark:text-slate-100"
                    title="填入主名，继续登记别名"
                  >
                    {main}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    {describeUsage(usageByName.get(main)) ?? "曲库里没有署主名"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-1">
                  {rows.map((row) => (
                    <span
                      key={row.alias}
                      className="inline-flex items-baseline gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <span className="wrap-break-word">{row.alias}</span>
                      <span className="text-xs text-slate-400">
                        {usageByName.get(row.alias)?.songs ?? 0} 首
                      </span>
                      <ConfirmButton
                        onConfirm={() => void handleDelete(row.alias)}
                        busy={deleting === row.alias}
                      />
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
