"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Pagination from "@/components/shared/Pagination";
import { cn } from "@/lib/utils/utils";
import {
  AdminOptions,
  AdminToolbar,
  EmptyState,
  ErrorState,
  LoadingState,
} from "./kit/parts";
import { TEXT_BUTTON_CLASS } from "./kit/styles";

interface AuditLog {
  id: number;
  table_name: string;
  action_type: string;
  user_id: string | null;
  /** 操作人的用户名；用户已删除、查不到时为 null */
  user_name: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: "新增",
  UPDATE: "修改",
  DELETE: "删除",
  // 歌曲的生命周期操作（songs，见 docs/DATABASE.md）
  CREATE: "新建歌曲",
  PUBLISH: "发布",
  REPUBLISH: "重新上线",
  UNPUBLISH: "下架",
  DISCARD_DRAFT: "放弃草稿",
};

const ACTION_TEXT: Record<string, string> = {
  INSERT: "text-(--tone)",
  UPDATE: "text-ink-muted",
  DELETE: "text-rose-600 dark:text-rose-400",
  CREATE: "text-(--tone)",
  PUBLISH: "text-(--tone)",
  REPUBLISH: "text-(--tone)",
  UNPUBLISH: "text-rose-600 dark:text-rose-400",
  DISCARD_DRAFT: "text-ink-muted",
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

/** 操作人：显示用户名，查不到（如用户已删除）才退回 UUID 前 8 位 */
function operatorLabel(log: AuditLog): string {
  if (log.user_name) return log.user_name;
  if (!log.user_id) return "—";
  return log.user_id.slice(0, 8) + "…";
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
  if (val === null) return <span className="italic text-ink-meta">null</span>;
  if (val === undefined)
    return <span className="italic text-ink-meta">undefined</span>;
  if (val === "")
    return (
      <span className="italic text-ink-meta">&quot;&quot; (空字符串)</span>
    );
  if (Array.isArray(val)) {
    if (val.length === 0)
      return <span className="italic text-ink-meta">[] (空数组)</span>;
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
    case "songs":
      return data.song_id ? `歌曲 ID：${data.song_id}` : null;
    case "song_versions":
      return data.title
        ? `曲目：${data.title}（草稿 #${data.id}）`
        : data.song_id
          ? `曲目 ID：${data.song_id}`
          : null;
    case "song_links":
      return `链接 (曲目 ID: ${data.song_id}, ${data.platform})`;
    case "song_emotions":
      return `基调 (版本 #${data.version_id}, 基调 ID: ${data.emotion_id})`;
    case "song_collations":
      return `校勘 (版本 #${data.version_id}, #${data.id})`;
    case "imagery":
      return data.name ? `意象：${data.name}` : null;
    case "imagery_categories":
      return data.name ? `分类：${data.name}` : null;
    case "song_imagery":
      return `标注 (版本 #${data.version_id}, 意象 ID: ${data.imagery_id})`;
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

const TABLE_FILTERS = [
  { id: "all", label: "全部" },
  { id: "songs", label: "发布" },
  { id: "song_versions", label: "资料" },
  { id: "song_imagery", label: "意象标注" },
  { id: "song_emotions", label: "基调" },
  { id: "song_collations", label: "校勘" },
  { id: "song_links", label: "链接" },
  { id: "imagery", label: "意象" },
  { id: "imagery_categories", label: "意象分类" },
];

function DataBlock({
  label,
  data,
  className,
}: {
  label: string;
  data: Record<string, unknown>;
  className: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className={cn("text-xs tracking-[0.2em]", className)}>{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function LogDetail({ log }: { log: AuditLog }) {
  const isUpdate =
    log.action_type.toUpperCase() === "UPDATE" &&
    log.old_data !== null &&
    log.new_data !== null;

  if (!isUpdate) {
    return (
      <div className="grid gap-6 pb-5 sm:grid-cols-2">
        {log.old_data !== null && (
          <DataBlock
            label="旧数据"
            data={log.old_data}
            className="text-rose-500 dark:text-rose-400"
          />
        )}
        {log.new_data !== null && (
          <DataBlock
            label="新数据"
            data={log.new_data}
            className="text-(--tone)"
          />
        )}
      </div>
    );
  }

  const diffKeys = getDiffKeys(log.old_data, log.new_data);
  if (diffKeys.length === 0) {
    return <p className="pb-4 text-xs text-ink-meta">无字段变更</p>;
  }
  return (
    <div className="overflow-x-auto pb-5">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-200/70 text-left text-xs tracking-[0.2em] dark:border-slate-800">
            <th className="w-1/4 py-1.5 pr-4 font-normal text-ink-meta">
              字段
            </th>
            <th className="w-[37.5%] py-1.5 pr-4 font-normal text-rose-500 dark:text-rose-400">
              旧值
            </th>
            <th className="w-[37.5%] py-1.5 font-normal text-(--tone)">新值</th>
          </tr>
        </thead>
        <tbody>
          {diffKeys.map((k) => (
            <tr
              key={k}
              className="border-b border-slate-200/40 align-top last:border-0 dark:border-slate-800/60"
            >
              <td className="py-1.5 pr-4 font-mono text-ink-muted">{k}</td>
              <td className="break-all py-1.5 pr-4 font-mono text-ink-prose">
                {renderLogValue(log.old_data?.[k])}
              </td>
              <td className="break-all py-1.5 font-mono text-ink-body">
                {renderLogValue(log.new_data?.[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogsPanel() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
  const logs = data?.logs ?? [];

  return (
    <>
      <AdminToolbar
        search={
          <div className="flex items-center gap-4 text-xs text-ink-meta">
            <span className="tabular-nums">共 {data?.total ?? 0} 条</span>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={loading}
              className={TEXT_BUTTON_CLASS}
            >
              刷新
            </button>
          </div>
        }
      >
        <AdminOptions
          items={TABLE_FILTERS}
          active={tableFilter}
          disabled={loading}
          onSelect={(id) => loadPage(1, id)}
        />
      </AdminToolbar>

      {loading && !data ? (
        <LoadingState />
      ) : error && !loading ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState>暂无日志记录</EmptyState>
      ) : (
        <ol className="border-t border-slate-200/70 dark:border-slate-800">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const action = log.action_type.toUpperCase();
            const hasData = Boolean(log.old_data || log.new_data);
            const identity = getEntityIdentity(
              log.table_name,
              log.old_data,
              log.new_data,
            );

            return (
              <li
                key={log.id}
                className="border-b border-slate-200/70 dark:border-slate-800"
              >
                <button
                  type="button"
                  disabled={!hasData}
                  onClick={() =>
                    setExpandedId((prev) => (prev === log.id ? null : log.id))
                  }
                  aria-expanded={isExpanded}
                  className="flex w-full items-baseline gap-4 py-2.5 text-left text-xs transition-colors enabled:hover:bg-slate-100/60 dark:enabled:hover:bg-slate-900/60"
                >
                  <span
                    className={cn(
                      "w-8 shrink-0",
                      ACTION_TEXT[action] ?? "text-ink-muted",
                    )}
                  >
                    {ACTION_LABELS[action] ?? log.action_type}
                  </span>
                  <span className="hidden w-36 shrink-0 font-mono text-ink-muted sm:block">
                    {log.table_name}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-ink-prose"
                    title={identity ?? undefined}
                  >
                    {identity}
                  </span>
                  <span
                    className={cn(
                      "hidden max-w-32 shrink-0 truncate text-ink-meta md:block",
                      !log.user_name && "font-mono",
                    )}
                    title={log.user_id ?? undefined}
                  >
                    {operatorLabel(log)}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-meta">
                    {formatDate(log.created_at)}
                  </span>
                </button>
                {isExpanded && hasData && <LogDetail log={log} />}
              </li>
            );
          })}
        </ol>
      )}

      <Pagination
        className="mt-10"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => loadPage(p)}
      />
    </>
  );
}
