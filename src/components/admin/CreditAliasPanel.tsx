"use client";

import {
  apiCreateCreditAlias,
  apiDeleteCreditAlias,
  apiGetCreditAliases,
} from "@/lib/api/client-api";
import type { CreditAliasRow } from "@/lib/server/service-credit-aliases";
import type { CreditField } from "@/lib/types";
import type { CreditNameUsage } from "@/lib/utils/utils-credits";
import { cn } from "@/lib/utils/utils";
import { ArrowRight, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROLE_LABELS: Record<CreditField, string> = {
  lyricist: "作词",
  composer: "作曲",
  arranger: "编曲",
  artist: "演唱",
  albumartist: "出品发行",
};

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

/** 危险操作两步确认，3 秒不点就复原 */
const CONFIRM_RESET_MS = 3000;

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
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

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

  const flash = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 4000);
  };

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
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirming !== target) {
      setConfirming(target);
      confirmTimer.current = setTimeout(
        () => setConfirming(null),
        CONFIRM_RESET_MS,
      );
      return;
    }
    setConfirming(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <p className="text-sm">{loadError}</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600"
        >
          <RefreshCw size={13} />
          重试
        </button>
      </div>
    );
  }

  const aliasUsage = usageByName.get(alias);
  const nameUsage = usageByName.get(name);

  return (
    <div className="space-y-8">
      {/* 登记 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-start">
          <div className="space-y-1 min-w-0">
            <label
              htmlFor="credit-alias"
              className="text-[11px] font-bold text-slate-500 tracking-wide"
            >
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
                  <span className="text-amber-600 dark:text-amber-400">
                    曲库里没有署这个名字的歌
                  </span>
                ))}
            </p>
          </div>

          <ArrowRight
            size={16}
            className="hidden md:block mt-9 text-slate-300 dark:text-slate-600"
            aria-hidden
          />

          <div className="space-y-1 min-w-0">
            <label
              htmlFor="credit-name"
              className="text-[11px] font-bold text-slate-500 tracking-wide"
            >
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
            className="md:mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
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
          ) : message ? (
            <span className={message.ok ? "text-emerald-600" : "text-rose-500"}>
              {message.text}
            </span>
          ) : (
            <span className="text-slate-400">
              只登记同一个人的不同署名。录入错字请直接在歌曲管理里改。登记后卷首、列表、筛选显示主名，版记照录原署。
            </span>
          )}
        </div>
      </form>

      {/* 已登记 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            已登记 {aliases.length} 个别名
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="查找"
                className="w-40 pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={load}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="刷新"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {aliases.length === 0 ? "还没有登记任何别名" : "没有匹配的别名"}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            {groups.map(([main, rows]) => (
              <li
                key={main}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <div className="sm:w-56 shrink-0 min-w-0">
                  <button
                    type="button"
                    onClick={() => setNameInput(main)}
                    className="text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 wrap-break-word text-left"
                    title="填入主名，继续登记别名"
                  >
                    {main}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    {describeUsage(usageByName.get(main)) ?? "曲库里没有署主名"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 min-w-0">
                  {rows.map((row) => {
                    const isConfirming = confirming === row.alias;
                    return (
                      <span
                        key={row.alias}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 pl-2.5 pr-1 py-1 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <span className="wrap-break-word">{row.alias}</span>
                        <span className="text-slate-400">
                          {usageByName.get(row.alias)?.songs ?? 0} 首
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.alias)}
                          disabled={deleting === row.alias}
                          className={cn(
                            "inline-flex items-center rounded-md px-1 py-0.5 transition-colors",
                            isConfirming
                              ? "text-rose-600 bg-rose-50 dark:bg-rose-500/10 font-bold"
                              : "text-slate-400 hover:text-rose-500",
                          )}
                          title={isConfirming ? "再点一次删除" : "删除"}
                        >
                          {deleting === row.alias ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isConfirming ? (
                            "确认删除"
                          ) : (
                            <X size={12} />
                          )}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
