"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { InlineOptions } from "@/components/shared/topbar/menu";
import { Link } from "@/i18n/navigation";
import { apiGetAdminRequests, apiReplyRequest } from "@/lib/api/client-api";
import type { RequestStatus, RequestType, UserRequest } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  AdminToolbar,
  EmptyState,
  ErrorState,
  FilterOptions,
  LoadingState,
} from "./kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  META_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
  TEXT_PRIMARY_CLASS,
  WARN_TEXT_CLASS,
} from "./kit/styles";
import { notify } from "./kit/toast";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "待处理",
  replied: "已回复",
  approved: "已同意",
  rejected: "已拒绝",
};

const STATUS_TEXT: Record<RequestStatus, string> = {
  pending: WARN_TEXT_CLASS,
  replied: "text-slate-500 dark:text-slate-400",
  approved: "text-(--tone)",
  rejected: "text-rose-600 dark:text-rose-400",
};

const TYPE_LABELS: Record<RequestType, string> = {
  song_feedback: "歌曲纠错",
  benefit_apply: "申请权益",
  admin_apply: "申请管理员",
};

const STATUS_FILTERS = [
  { key: "all", label: "全部" },
  ...(Object.keys(STATUS_LABELS) as RequestStatus[]).map((key) => ({
    key,
    label: STATUS_LABELS[key],
  })),
];

const TYPE_FILTERS = [
  { id: "all", label: "全部类型" },
  ...(Object.keys(TYPE_LABELS) as RequestType[]).map((id) => ({
    id,
    label: TYPE_LABELS[id],
  })),
];

interface ReplyState {
  reply: string;
  status: "replied" | "approved" | "rejected";
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function RequestsPanel({
  csrfToken,
  isSuper,
  initialStatus = "all",
}: {
  csrfToken: string;
  isSuper: boolean;
  initialStatus?: string;
}) {
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyStates, setReplyStates] = useState<Record<string, ReplyState>>(
    {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (p: number, type: string, status: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetAdminRequests({
          type: type === "all" ? undefined : type,
          status: status === "all" ? undefined : status,
          page: p,
        });
        setRequests(data.requests);
        setTotal(data.total);
        setPage(p);
        setExpandedId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(1, typeFilter, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReply = async (id: string, state: ReplyState) => {
    if (!state.reply.trim()) return;
    setSavingId(id);
    try {
      await apiReplyRequest(
        { id, reply: state.reply.trim(), status: state.status },
        csrfToken,
      );
      notify({ type: "success", text: "回复已保存" });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                reply: state.reply.trim(),
                status: state.status,
                replied_at: new Date().toISOString(),
              }
            : r,
        ),
      );
      setExpandedId(null);
    } catch (e) {
      notify({
        type: "error",
        text: e instanceof Error ? e.message : "操作失败",
      });
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AdminToolbar
        search={
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="tabular-nums">共 {total} 条</span>
            <button
              type="button"
              onClick={() => void fetchPage(page, typeFilter, statusFilter)}
              disabled={loading}
              className={TEXT_BUTTON_CLASS}
            >
              刷新
            </button>
          </div>
        }
      >
        <FilterOptions
          options={STATUS_FILTERS}
          active={statusFilter}
          onSelect={(val) => {
            setStatusFilter(val);
            void fetchPage(1, typeFilter, val);
          }}
        />
        {/* 普通管理员只看得到歌曲纠错 */}
        {isSuper && (
          <InlineOptions
            items={TYPE_FILTERS}
            active={typeFilter}
            disabled={loading}
            onSelect={(val) => {
              setTypeFilter(val);
              void fetchPage(1, val, statusFilter);
            }}
          />
        )}
      </AdminToolbar>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => void fetchPage(page, typeFilter, statusFilter)}
        />
      ) : loading && requests.length === 0 ? (
        <LoadingState />
      ) : requests.length === 0 ? (
        <EmptyState>暂无记录</EmptyState>
      ) : (
        <ol className="border-t border-slate-200/70 dark:border-slate-800">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id;
            const isFeedback = req.type === "song_feedback";
            const replyState = replyStates[req.id] ?? {
              reply: req.reply ?? "",
              status:
                req.status === "pending"
                  ? isFeedback
                    ? "replied"
                    : "approved"
                  : req.status,
            };
            const setReply = (next: Partial<ReplyState>) =>
              setReplyStates((prev) => ({
                ...prev,
                [req.id]: { ...replyState, ...next },
              }));

            return (
              <li
                key={req.id}
                className="border-b border-slate-200/70 dark:border-slate-800"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) => (prev === req.id ? null : req.id))
                  }
                  aria-expanded={isExpanded}
                  className="flex w-full items-baseline gap-4 py-3 text-left text-sm transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-900/60"
                >
                  <span className={cn(META_CLASS, "w-16 shrink-0")}>
                    {TYPE_LABELS[req.type]}
                  </span>
                  <span className="w-20 shrink-0 truncate text-slate-700 dark:text-slate-200">
                    {req.user_name ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">
                    {req.song_title && (
                      <span className="mr-2 text-slate-700 dark:text-slate-200">
                        《{req.song_title}》
                      </span>
                    )}
                    {req.content}
                  </span>
                  <span
                    className={cn("shrink-0 text-xs", STATUS_TEXT[req.status])}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                  <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block">
                    {new Date(req.created_at).toLocaleDateString("zh-CN")}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-5 pb-6 pt-2 md:pl-20">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
                      <div>
                        <dt className="inline">用户 </dt>
                        <dd className="inline font-mono text-slate-600 dark:text-slate-300">
                          {req.user_id.slice(0, 8)}…
                        </dd>
                      </div>
                      {req.category && (
                        <div>
                          <dt className="inline">类别 </dt>
                          <dd className="inline text-slate-600 dark:text-slate-300">
                            {req.category}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">提交于 </dt>
                        <dd className="inline tabular-nums">
                          {formatDateTime(req.created_at)}
                        </dd>
                      </div>
                    </dl>

                    <p className="max-w-[40em] whitespace-pre-wrap font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300">
                      {req.content}
                    </p>

                    {req.song_id && (
                      <Link
                        href={`/admin/songs/${req.song_id}`}
                        className={TEXT_PRIMARY_CLASS}
                      >
                        去改《{req.song_title ?? `#${req.song_id}`}》
                      </Link>
                    )}

                    <div className="max-w-2xl space-y-3">
                      <label
                        className={LABEL_CLASS}
                        htmlFor={`reply-${req.id}`}
                      >
                        回复
                      </label>
                      <textarea
                        id={`reply-${req.id}`}
                        rows={3}
                        maxLength={2000}
                        value={replyState.reply}
                        onChange={(e) => setReply({ reply: e.target.value })}
                        placeholder="输入回复内容…"
                        className={cn(INPUT_CLASS, "resize-y")}
                      />
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {/* 纠错只有「已回复」；申请类要选同意或拒绝 */}
                        {!isFeedback &&
                          (["approved", "rejected"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={replyState.status === s}
                              onClick={() => setReply({ status: s })}
                              className={cn(
                                "text-sm tracking-wider transition-colors",
                                replyState.status === s
                                  ? s === "approved"
                                    ? "text-(--tone)"
                                    : "text-rose-600 dark:text-rose-400"
                                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                              )}
                            >
                              {s === "approved" ? "同意" : "拒绝"}
                            </button>
                          ))}
                        <span className="ml-auto flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setExpandedId(null)}
                            className={TEXT_BUTTON_CLASS}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReply(req.id, replyState)}
                            disabled={
                              savingId === req.id || !replyState.reply.trim()
                            }
                            className={SOLID_BUTTON_CLASS}
                          >
                            {savingId === req.id && (
                              <Loader2 size={14} className="animate-spin" />
                            )}
                            提交回复
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-6 text-sm">
          <button
            type="button"
            onClick={() => void fetchPage(page - 1, typeFilter, statusFilter)}
            disabled={page <= 1 || loading}
            className={TEXT_BUTTON_CLASS}
          >
            上一页
          </button>
          <span className="tabular-nums text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => void fetchPage(page + 1, typeFilter, statusFilter)}
            disabled={page >= totalPages || loading}
            className={TEXT_BUTTON_CLASS}
          >
            下一页
          </button>
        </div>
      )}
    </>
  );
}
