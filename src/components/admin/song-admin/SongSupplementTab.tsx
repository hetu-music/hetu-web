"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useUserContext } from "@/context/UserContext";
import {
  apiCreateSupplement,
  apiDeleteCollation,
  apiGetCollations,
  apiUpdateSupplement,
} from "@/lib/api/client-api";
import type { SongCollation, SupplementKind } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import {
  SUPPLEMENT_BODY_MAX,
  SUPPLEMENT_KINDS,
  type SupplementPayload,
  sortSupplements,
  supplementInputSchema,
} from "@/lib/utils/utils-collations";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../kit/parts";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  META_CLASS,
  OUTLINE_BUTTON_CLASS,
  PANEL_CLASS,
  SOLID_BUTTON_CLASS,
  TAG_CLASS,
  TEXT_BUTTON_CLASS,
  optionClass,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";
import { KIND_LABEL, collationsKey } from "./SongCollationTab";

const KIND_HINT: Record<SupplementKind, string> = {
  release: "某个版本的发布：专辑版、现场版、重制版等，写明在哪里、何时发布",
  draft: "废弃的文案：旧版简介、宣传语等，照录原文",
  note: "以上都不算的资料",
};

function signature(c: SongCollation) {
  return `${c.collator || "佚名"} 辑${c.reviser ? ` · ${c.reviser} 订` : ""}`;
}

/**
 * 一首歌的补遗：歌词以外、关于这首歌本身的资料，在详情页创作手记之后单成一节。
 * 与校记同一张表、同一个读取接口，这里只取记在整首歌上的。
 */
export default function SongSupplementTab({ songId }: { songId: number }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: collationsKey(songId),
    queryFn: () => apiGetCollations(songId),
  });
  // null 不在编辑；"new" 新写一条；数字为正在改的那条
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const supplements = useMemo(
    () =>
      sortSupplements(
        (query.data?.collations ?? []).filter((c) => c.anchor === "song"),
      ),
    [query.data],
  );

  if (query.isError) {
    return (
      <ErrorState
        message={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingState text="加载补遗…" />;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: collationsKey(songId) });
  const done = async (saved: boolean) => {
    if (saved) await refresh();
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className={META_CLASS}>
          记歌词以外、关于这首歌本身的资料，如各版本的发布时间、废弃的文案。
          详情页里排在创作手记之后，署「某某 辑」，按日期排。
        </p>
        {editing !== "new" && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={SOLID_BUTTON_CLASS}
          >
            新增一条
          </button>
        )}
      </div>

      {editing === "new" && (
        <SupplementForm songId={songId} initial={null} onDone={done} />
      )}

      {supplements.length === 0 && editing !== "new" ? (
        <EmptyState>这首歌还没有补遗</EmptyState>
      ) : (
        <ol className="space-y-4">
          {supplements.map((c) =>
            editing === c.id ? (
              <li key={c.id}>
                <SupplementForm songId={songId} initial={c} onDone={done} />
              </li>
            ) : (
              <SupplementItem
                key={c.id}
                supplement={c}
                onEdit={() => setEditing(c.id)}
                onDeleted={refresh}
              />
            ),
          )}
        </ol>
      )}
    </div>
  );
}

function SupplementItem({
  supplement: c,
  onEdit,
  onDeleted,
}: {
  supplement: SongCollation;
  onEdit: () => void;
  onDeleted: () => Promise<unknown>;
}) {
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await apiDeleteCollation(c.id);
      await onDeleted();
      notify({ type: "success", text: "补遗已删除" });
    } catch (error) {
      notifyError(error, "删除补遗失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className={cn(PANEL_CLASS, "space-y-2 px-5 py-4 text-sm")}>
      <p className="flex items-baseline gap-3">
        <span className={TAG_CLASS}>{KIND_LABEL[c.kind]}</span>
        {c.date && <span className={META_CLASS}>{c.date}</span>}
      </p>
      <p className="whitespace-pre-line wrap-break-word leading-relaxed text-slate-700 dark:text-slate-200">
        {c.body}
      </p>
      <p className="flex items-baseline gap-3">
        <span className={META_CLASS}>{signature(c)}</span>
        <button type="button" onClick={onEdit} className={TEXT_BUTTON_CLASS}>
          修改
        </button>
        <ConfirmButton onConfirm={() => void remove()} busy={deleting} />
      </p>
    </li>
  );
}

function SupplementForm({
  songId,
  initial,
  onDone,
}: {
  songId: number;
  /** null 为新写 */
  initial: SongCollation | null;
  onDone: (saved: boolean) => Promise<void>;
}) {
  const { user } = useUserContext();
  const [kind, setKind] = useState<SupplementKind>(
    (initial?.kind as SupplementKind | undefined) ?? "release",
  );
  const [date, setDate] = useState(initial?.date ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const payload: SupplementPayload = { kind, date, body };
    const parsed = supplementInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "内容有误");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (initial) await apiUpdateSupplement(initial.id, payload);
      else await apiCreateSupplement(songId, payload);
      notify({ type: "success", text: "补遗已保存" });
      await onDone(true);
    } catch (e) {
      notifyError(e, "保存补遗失败");
      setSaving(false);
    }
  };

  return (
    <div className={cn(PANEL_CLASS, "space-y-4 border-(--tone) px-5 py-4")}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className={LABEL_CLASS}>类型</p>
          <div className="mt-1 flex flex-wrap gap-x-5">
            {SUPPLEMENT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                title={KIND_HINT[k]}
                className={optionClass(kind === k)}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <label className="block w-44 space-y-1">
          <span className={LABEL_CLASS}>日期（可不填）</span>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2019-08-15"
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <p className={META_CLASS}>
        {KIND_HINT[kind]}。日期可只写年或年月，如 2019、2019-08
      </p>

      <label className="block space-y-1">
        <span className={LABEL_CLASS}>内容</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={SUPPLEMENT_BODY_MAX}
          rows={4}
          className={cn(INPUT_CLASS, "field-sizing-content min-h-28")}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className={cn(META_CLASS, "mr-auto")}>
          {initial
            ? `${signature(initial)}${initial.collator !== user?.name ? "，保存后署你为订者" : ""}`
            : `署名：${user?.name ?? ""} 辑`}
        </span>
        {error && <span className="text-xs text-rose-500">{error}</span>}
        <button
          type="button"
          onClick={() => void onDone(false)}
          disabled={saving}
          className={OUTLINE_BUTTON_CLASS}
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={SOLID_BUTTON_CLASS}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
