"use client";

import { cn } from "@/lib/utils/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface AuditLog {
  id: string;
  table_name: string;
  action_type: string;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT:
    "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  UPDATE: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  DELETE: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10",
};

function isEmpty(val: unknown): boolean {
  return (
    val === null ||
    val === undefined ||
    val === "" ||
    (Array.isArray(val) && val.length === 0)
  );
}

/** Returns only keys that differ between old and new (UPDATE diffs). */
function getDiffKeys(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...keys].filter((k) => {
    const oldVal = oldData[k];
    const newVal = newData[k];
    if (isEmpty(oldVal) && isEmpty(newVal)) return false;
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  });
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8) + "…";
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderLogValue(val: unknown) {
  if (val === null) return <span className="italic text-slate-400">null</span>;
  if (val === undefined)
    return <span className="italic text-slate-400">undefined</span>;
  if (val === "")
    return (
      <span className="italic text-slate-400">&quot;&quot; (空字符串)</span>
    );
  if (Array.isArray(val)) {
    if (val.length === 0)
      return <span className="italic text-slate-400">[] (空数组)</span>;
    return `[${val.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(", ")}]`;
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return String(val);
}

function getEntityIdentity(
  tableName: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string | null {
  const data = newData || oldData;
  if (!data) return null;

  switch (tableName) {
    case "temp":
      return data.title
        ? `曲目：${data.title}`
        : data.id
          ? `曲目 ID：${data.id}`
          : null;
    case "imagery":
      return data.name ? `意象：${data.name}` : null;
    case "imagery_categories":
      return data.name ? `分类：${data.name}` : null;
    case "imagery_meanings":
      return data.label ? `释义：${data.label}` : null;
    case "imagery_occurrences":
      return `标注 (曲目 ID: ${data.song_id}, 意象 ID: ${data.imagery_id})`;
    default:
      return null;
  }
}

async function fetchAuditLogs(
  page: number,
  table: string,
): Promise<AuditLogsResponse> {
  const res = await fetch(`/api/admin/audit-logs?page=${page}&table=${table}`);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? "加载失败");
  }
  return res.json();
}

export default function AuditLogsPanel() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("all");

  const {
    data,
    error,
    isFetching: loading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "audit-logs", page, tableFilter],
    queryFn: () => fetchAuditLogs(page, tableFilter),
    // 翻页、换表时先留着上一页，不闪回整页加载
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const loadPage = (p: number, table: string = tableFilter) => {
    setPage(p);
    setTableFilter(table);
    setExpandedId(null);
    window.scrollTo({ top: 0 });
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <p className="text-sm">{error.message}</p>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-600"
        >
          <RefreshCw size={13} />
          重试
        </button>
      </div>
    );
  }

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
            共 {data?.total ?? 0} 条记录
          </span>
          <select
            value={tableFilter}
            onChange={(e) => {
              const val = e.target.value;
              loadPage(1, val);
            }}
            disabled={loading}
            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          >
            <option value="all">全部表</option>
            <option value="temp">temp (曲目)</option>
            <option value="imagery">imagery (意象)</option>
            <option value="imagery_categories">
              imagery_categories (意象分类)
            </option>
            <option value="imagery_meanings">
              imagery_meanings (意象释义)
            </option>
            <option value="imagery_occurrences">
              imagery_occurrences (意象标注)
            </option>
          </select>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* Log rows */}
      {logs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          暂无日志记录
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const actionColor =
              ACTION_COLORS[log.action_type.toUpperCase()] ??
              "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800";
            const hasData = log.old_data || log.new_data;

            return (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden"
              >
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  {/* Action badge */}
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 rounded font-bold uppercase tracking-wide text-[10px]",
                      actionColor,
                    )}
                  >
                    {log.action_type}
                  </span>

                  {/* Table name */}
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">
                    {log.table_name}
                  </span>

                  {/* Entity Identity */}
                  <span
                    className="text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0"
                    title={
                      getEntityIdentity(
                        log.table_name,
                        log.old_data,
                        log.new_data,
                      ) ?? undefined
                    }
                  >
                    {getEntityIdentity(
                      log.table_name,
                      log.old_data,
                      log.new_data,
                    )}
                  </span>

                  {/* User */}
                  <span
                    className="text-slate-400 font-mono shrink-0 max-w-[80px] truncate"
                    title={log.user_id ?? undefined}
                  >
                    {shortId(log.user_id)}
                  </span>

                  {/* Timestamp */}
                  <span className="text-slate-400 ml-auto shrink-0">
                    {formatDate(log.changed_at)}
                  </span>

                  {/* Expand toggle */}
                  {hasData && (
                    <button
                      onClick={() =>
                        setExpandedId((prev) =>
                          prev === log.id ? null : log.id,
                        )
                      }
                      className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded diff */}
                {isExpanded &&
                  hasData &&
                  (() => {
                    const isUpdate =
                      log.action_type.toUpperCase() === "UPDATE" &&
                      log.old_data !== null &&
                      log.new_data !== null;
                    const diffKeys = isUpdate
                      ? getDiffKeys(log.old_data, log.new_data)
                      : [];

                    if (isUpdate) {
                      return (
                        <div className="border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
                          {diffKeys.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-slate-400">
                              无字段变更
                            </p>
                          ) : (
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                  <th className="px-4 py-1.5 text-left font-bold text-slate-400 uppercase tracking-wide text-[10px] w-1/4">
                                    字段
                                  </th>
                                  <th className="px-4 py-1.5 text-left font-bold text-rose-400 uppercase tracking-wide text-[10px] w-[37.5%]">
                                    旧值
                                  </th>
                                  <th className="px-4 py-1.5 text-left font-bold text-emerald-500 uppercase tracking-wide text-[10px] w-[37.5%]">
                                    新值
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {diffKeys.map((k) => (
                                  <tr
                                    key={k}
                                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                                  >
                                    <td className="px-4 py-1.5 font-mono text-slate-500 dark:text-slate-400 align-top">
                                      {k}
                                    </td>
                                    <td className="px-4 py-1.5 font-mono text-rose-500 dark:text-rose-400 align-top break-all">
                                      {renderLogValue(log.old_data?.[k])}
                                    </td>
                                    <td className="px-4 py-1.5 font-mono text-emerald-600 dark:text-emerald-400 align-top break-all">
                                      {renderLogValue(log.new_data?.[k])}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    }

                    // INSERT or DELETE — show the full data block
                    return (
                      <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
                        {log.old_data !== null && (
                          <div className="bg-white dark:bg-slate-900 p-3 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500">
                              旧数据
                            </p>
                            <pre className="text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_data !== null && (
                          <div className="bg-white dark:bg-slate-900 p-3 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                              新数据
                            </p>
                            <pre className="text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => loadPage(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          <span className="text-xs font-bold text-slate-500 min-w-20 text-center">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => loadPage(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
