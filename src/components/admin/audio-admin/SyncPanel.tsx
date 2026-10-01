"use client";

import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DbSong, NavSong, SyncPlan } from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import { formatDuration } from "./utils";

function songLabel(s: DbSong) {
  return `#${s.id} ${s.title}（${s.album ?? "无专辑"}，${formatDuration(s.length)}）`;
}

function navLabel(n: NavSong) {
  return `${n.title}（${n.album ?? "无专辑"}，${formatDuration(n.duration)}）`;
}

function Section({
  title,
  count,
  tone = "default",
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  tone?: "default" | "warn";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-sm"
      >
        <span
          className={cn(
            "font-medium",
            tone === "warn"
              ? "text-amber-700 dark:text-amber-300"
              : "text-slate-700 dark:text-slate-200",
          )}
        >
          {title}
          <span className="ml-2 tabular-nums text-slate-400">{count}</span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pb-3 text-xs text-slate-600 dark:text-slate-300">
          {children}
        </ul>
      )}
    </div>
  );
}

/** 同步预览与执行 */
export default function SyncPanel({
  plan,
  refreshing,
  syncing,
  onRefresh,
  onSync,
}: {
  plan: SyncPlan;
  refreshing: boolean;
  syncing: boolean;
  onRefresh: () => void;
  onSync: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const loose = plan.upserts.filter((u) => u.loose);
  const exact = plan.upserts.filter((u) => !u.loose);
  const changeCount =
    plan.upserts.length +
    plan.deletes.length +
    plan.mediaUpdates.length +
    plan.hasAudioChanges.length;

  return (
    <section className="mb-10 rounded-3xl border border-slate-200/70 bg-white/95 px-6 py-5 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.35)] dark:border-slate-800/70 dark:bg-slate-900/75">
      <div className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {changeCount === 0 ? (
            <CheckCircle2
              size={22}
              className="mt-0.5 shrink-0 text-emerald-500"
            />
          ) : (
            <RefreshCw size={22} className="mt-0.5 shrink-0 text-amber-500" />
          )}
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">
              {changeCount === 0 ? "映射已是最新" : "自动同步"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {changeCount === 0
                ? "曲库与歌曲的关联和元数据一致，无需同步。"
                : `按标题与时长自动配对：新增/替换 ${plan.upserts.length} 条，删除失效 ${plan.deletes.length} 条，更新格式与时长 ${plan.mediaUpdates.length} 条，has_audio 变化 ${plan.hasAudioChanges.length} 首。已有且仍有效的关联只会更新格式与时长，不会改动指向。`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || syncing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-emerald-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
            重新检查
          </button>
          {changeCount > 0 &&
            (confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={syncing}
                  className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onSync();
                  }}
                  disabled={syncing}
                  className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
                >
                  确认写入 {changeCount} 项变更
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={syncing || refreshing}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 disabled:opacity-50"
              >
                {syncing && <Loader2 size={14} className="animate-spin" />}
                执行同步
              </button>
            ))}
        </div>
      </div>

      <Section
        title="宽松匹配（标题带版本差异，按时长配对，请核对）"
        count={loose.length}
        tone="warn"
        defaultOpen
      >
        {loose.map((u) => (
          <li key={u.song.id}>
            {songLabel(u.song)} → {navLabel(u.nav)}
          </li>
        ))}
      </Section>
      <Section title="精确匹配" count={exact.length}>
        {exact.map((u) => (
          <li key={u.song.id}>
            {songLabel(u.song)} → {navLabel(u.nav)}
          </li>
        ))}
      </Section>
      <Section title="删除失效关联" count={plan.deletes.length}>
        {plan.deletes.map((d) => (
          <li key={d.id}>
            #{d.id}（{d.navid_id}）
          </li>
        ))}
      </Section>
      <Section title="has_audio 变化" count={plan.hasAudioChanges.length}>
        {plan.hasAudioChanges.map((c) => (
          <li key={c.song.id}>
            {songLabel(c.song)} → {c.next ? "有音频" : "无音频"}
          </li>
        ))}
      </Section>
      <Section
        title="需人工处理（不会自动写入，请在下方列表中手动关联）"
        count={plan.review.length}
        tone="warn"
        defaultOpen
      >
        {plan.review.map((r) => (
          <li key={r.song.id}>
            <TriangleAlert size={12} className="mr-1 inline text-amber-500" />
            {songLabel(r.song)} —— {r.reason}
            {r.candidates.map((c) => (
              <div key={c.id} className="ml-5 text-slate-400">
                候选：{navLabel(c)}
              </div>
            ))}
          </li>
        ))}
      </Section>
      <Section title="曲库中未被关联的曲目" count={plan.unusedNav.length}>
        {plan.unusedNav.map((n) => (
          <li key={n.id}>{n.path ?? navLabel(n)}</li>
        ))}
      </Section>
    </section>
  );
}
