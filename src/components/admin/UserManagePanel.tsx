"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGetUsers, apiUpdateUser } from "@/lib/api/client-api";
import type { UserRecord, UserUpdatePayload } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  AdminOptions,
  AdminToolbar,
  ConfirmButton,
  EmptyState,
  ErrorState,
  type FilterOption,
  FilterOptions,
  LoadingState,
  SearchInput,
} from "./kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  SOLID_BUTTON_CLASS,
  TAG_CLASS,
  TEXT_BUTTON_CLASS,
  TEXT_PRIMARY_CLASS,
} from "./kit/styles";
import { notify } from "./kit/toast";

interface EditState {
  name: string;
  display: boolean;
  intro: string;
  is_admin: boolean;
  can_stream: boolean;
}

function buildEditState(user: UserRecord): EditState {
  return {
    name: user.name,
    display: user.display,
    intro: user.intro ?? "",
    is_admin: user.is_admin,
    can_stream: user.can_stream,
  };
}

type Filter = "all" | "admin" | "stream";

const YES_NO = [
  { id: "yes", label: "是" },
  { id: "no", label: "否" },
];

/** 布尔字段：标签加「是 · 否」两个文字选项 */
function BoolField({
  label,
  value,
  onChange,
  locked,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** 锁定时的说明，如超管不能取消管理员 */
  locked?: string;
}) {
  return (
    <div>
      <span className={LABEL_CLASS}>
        {label}
        {locked && <span className="ml-2 tracking-normal">（{locked}）</span>}
      </span>
      <AdminOptions
        items={YES_NO}
        active={value ? "yes" : "no"}
        disabled={Boolean(locked)}
        onSelect={(id) => onChange(id === "yes")}
      />
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={LABEL_CLASS}>{label}</dt>
      <dd className="mt-1 text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}

export default function UserManagePanel() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: data } = await apiGetUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void apiGetUsers()
      .then(({ users: data }) => setUsers(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "加载失败"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filters: FilterOption<Filter>[] = [
    { key: "all", label: "全部", count: users.length },
    {
      key: "admin",
      label: "管理员",
      count: users.filter((u) => u.is_admin).length,
    },
    {
      key: "stream",
      label: "有试听权益",
      count: users.filter((u) => u.can_stream).length,
    },
  ];

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (filter === "all" ||
          (filter === "admin" && u.is_admin) ||
          (filter === "stream" && u.can_stream)) &&
        (!q || `${u.name} ${u.id}`.toLowerCase().includes(q)),
    );
  }, [filter, query, users]);

  const patch = (next: Partial<EditState>) =>
    setEditState((s) => (s ? { ...s, ...next } : s));

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditState(buildEditState(user));
    setExpandedId(user.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const handleClearBenefits = async (userId: string) => {
    setClearingId(userId);
    try {
      await apiUpdateUser({ id: userId, can_stream: false });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, can_stream: false } : u)),
      );
      notify({ type: "success", text: "已收回试听权益" });
    } catch (e) {
      notify({
        type: "error",
        text: e instanceof Error ? e.message : "操作失败",
      });
    } finally {
      setClearingId(null);
    }
  };

  const handleSave = async (userId: string) => {
    if (!editState) return;
    setSaving(true);
    try {
      const payload: UserUpdatePayload = {
        id: userId,
        name: editState.name,
        display: editState.display,
        intro: editState.intro || null,
        is_admin: editState.is_admin,
        can_stream: editState.can_stream,
      };
      await apiUpdateUser(payload);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, ...editState, intro: editState.intro || null }
            : u,
        ),
      );
      notify({ type: "success", text: "已保存" });
      cancelEdit();
    } catch (e) {
      notify({
        type: "error",
        text: e instanceof Error ? e.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminToolbar
        search={
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="搜索用户名或 ID"
          />
        }
      >
        <FilterOptions options={filters} active={filter} onSelect={setFilter} />
      </AdminToolbar>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadUsers()} />
      ) : loading ? (
        <LoadingState />
      ) : visibleUsers.length === 0 ? (
        <EmptyState>没有符合条件的用户</EmptyState>
      ) : (
        <ol className="border-t border-slate-200/70 dark:border-slate-800">
          {visibleUsers.map((user) => {
            const isEditing = editingId === user.id && editState;
            const isExpanded = expandedId === user.id;

            return (
              <li
                key={user.id}
                className="border-b border-slate-200/70 dark:border-slate-800"
              >
                <div className="flex items-center gap-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === user.id ? null : user.id,
                      )
                    }
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
                  >
                    <span className="truncate text-slate-900 dark:text-slate-100">
                      {user.name}
                    </span>
                    {user.is_super ? (
                      <span className={TAG_CLASS}>超管</span>
                    ) : (
                      user.is_admin && <span className={TAG_CLASS}>管理员</span>
                    )}
                    {user.can_stream && <span className={TAG_CLASS}>试听</span>}
                    <span className="hidden min-w-0 truncate font-mono text-[11px] text-slate-400 md:block">
                      {user.id}
                    </span>
                  </button>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className={TEXT_PRIMARY_CLASS}
                    >
                      编辑
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="pb-6 pt-1">
                    {isEditing ? (
                      <div className="max-w-2xl space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className={LABEL_CLASS}>用户名</span>
                            <input
                              type="text"
                              value={editState.name}
                              onChange={(e) => patch({ name: e.target.value })}
                              className={INPUT_CLASS}
                            />
                          </label>
                          <label className="block space-y-1.5 sm:col-span-2">
                            <span className={LABEL_CLASS}>简介</span>
                            <textarea
                              value={editState.intro}
                              onChange={(e) => patch({ intro: e.target.value })}
                              rows={2}
                              className={cn(INPUT_CLASS, "resize-y")}
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-x-10 gap-y-3">
                          <BoolField
                            label="公开展示"
                            value={editState.display}
                            onChange={(display) => patch({ display })}
                          />
                          <BoolField
                            label="试听权益"
                            value={editState.can_stream}
                            onChange={(can_stream) => patch({ can_stream })}
                          />
                          <BoolField
                            label="管理员"
                            value={editState.is_admin}
                            onChange={(is_admin) => patch({ is_admin })}
                            locked={user.is_super ? "超管锁定" : undefined}
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => void handleSave(user.id)}
                            disabled={saving}
                            className={SOLID_BUTTON_CLASS}
                          >
                            {saving && (
                              <Loader2 size={14} className="animate-spin" />
                            )}
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className={TEXT_BUTTON_CLASS}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
                        <ReadField
                          label="公开展示"
                          value={user.display ? "是" : "否"}
                        />
                        <ReadField
                          label="管理员"
                          value={user.is_admin ? "是" : "否"}
                        />
                        <ReadField
                          label="超管"
                          value={user.is_super ? "是" : "否"}
                        />
                        <ReadField
                          label="试听权益"
                          value={user.can_stream ? "有" : "无"}
                        />
                        <div className="col-span-2 font-mono text-[11px] text-slate-400 sm:col-span-4 md:hidden">
                          {user.id}
                        </div>
                        {user.intro && (
                          <div className="col-span-2 sm:col-span-4">
                            <dt className={LABEL_CLASS}>简介</dt>
                            <dd className="mt-1 font-kaiti leading-relaxed text-slate-700 dark:text-slate-300">
                              {user.intro}
                            </dd>
                          </div>
                        )}
                        {user.can_stream && (
                          <div className="col-span-2 sm:col-span-4">
                            <ConfirmButton
                              onConfirm={() =>
                                void handleClearBenefits(user.id)
                              }
                              busy={clearingId === user.id}
                              label="收回试听权益"
                              confirmLabel="确认收回"
                            />
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
