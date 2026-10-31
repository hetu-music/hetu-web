"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  apiDeleteUnusedMotifs,
  apiGetUnusedMotifs,
} from "@/lib/api/client-api";
import type {
  UnusedMotif,
  UnusedMotifWord,
} from "@/lib/server/service-imagery";
import { EmptyState, ErrorState, LoadingState } from "../kit/parts";
import {
  META_CLASS,
  SOLID_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "../kit/styles";
import { notify, notifyError } from "../kit/toast";

const ROLE_LABEL: Record<UnusedMotifWord["role"], string> = {
  primary: "通常算作它",
  alternative: "有时也指它",
  part: "同时算进它",
};

/** 「汗」通常算作它，删后改为通常算作 身躯 */
function describeWord(word: UnusedMotifWord): string {
  const base = `「${word.name}」${ROLE_LABEL[word.role]}`;
  if (word.role !== "primary") return `${base}，删后去掉这一项`;
  return word.promoteTo
    ? `${base}，删后改为通常算作 ${word.promoteTo.name}`
    : `${base}，删后没有别的可选，需要另选「通常算作」`;
}

/**
 * 整理分类：列出没有标注的母题，勾选后删掉。
 * 默认全选；新建了还没来得及标注的母题可以取消勾选留下。
 * 登记了这些母题的词一并列出：登记随母题删掉，默认母题被删的词改用别的候选。
 */
export function CleanupMotifsDialog({
  open,
  onClose,
  getCategoryPath,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  getCategoryPath: (categoryId: number) => string;
  onDeleted: (ids: number[]) => void;
}) {
  const unused = useQuery({
    queryKey: ["admin", "imagery", "unused-motifs"],
    queryFn: apiGetUnusedMotifs,
    // 每次打开都按当下的数据重查
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const groups = useMemo(() => {
    const byParent = new Map<number | null, UnusedMotif[]>();
    for (const motif of unused.data ?? []) {
      const list = byParent.get(motif.parent_id) ?? [];
      list.push(motif);
      byParent.set(motif.parent_id, list);
    }
    return [...byParent]
      .map(([parentId, motifs]) => ({
        path: parentId === null ? "（无上级）" : getCategoryPath(parentId),
        motifs: motifs.sort((a, b) => a.name.localeCompare(b.name, "zh")),
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "zh"));
  }, [getCategoryPath, unused.data]);

  const selected = (unused.data ?? [])
    .map((m) => m.id)
    .filter((id) => !skipped.has(id));

  const close = () => {
    setSkipped(new Set());
    onClose();
  };

  const toggle = (id: number) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const remove = async () => {
    if (selected.length === 0 || deleting) return;
    setDeleting(true);
    try {
      const { deleted, promoted } = await apiDeleteUnusedMotifs(selected);
      if (deleted.length > 0) onDeleted(deleted);
      const kept = selected.length - deleted.length;
      // 词登记在删母题之前就改了：母题没删成时也要说清楚
      const changed = promoted.map((p) => `「${p.word}」→ ${p.motif}`);
      if (deleted.length === 0) {
        notify({
          type: "error",
          text: [
            "母题一个都没删掉：可能刚有了标注，或数据库没给管理员删除权限",
            changed.length > 0
              ? `词已经改了，通常算作：${changed.join("、")}`
              : "",
          ]
            .filter(Boolean)
            .join("；"),
        });
      } else {
        notify({
          type: "success",
          text: [
            kept > 0
              ? `已删除 ${deleted.length} 个母题，另有 ${kept} 个刚有了标注或没删成，已保留`
              : `已删除 ${deleted.length} 个母题`,
            changed.length > 0 ? `改为通常算作：${changed.join("、")}` : "",
          ]
            .filter(Boolean)
            .join("；"),
        });
      }
      close();
    } catch (error) {
      notifyError(error, "删除空母题失败");
    } finally {
      setDeleting(false);
    }
  };

  const ready = unused.isSuccess && unused.data.length > 0;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title="整理母题"
      footer={
        <>
          <button type="button" onClick={close} className={TEXT_BUTTON_CLASS}>
            {ready ? "取消" : "关闭"}
          </button>
          {ready && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={selected.length === 0 || deleting}
              className={SOLID_BUTTON_CLASS}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              删除 {selected.length} 个
            </button>
          )}
        </>
      }
    >
      {unused.isPending ? (
        <LoadingState text="查找中…" />
      ) : unused.isError ? (
        <ErrorState
          message={unused.error.message}
          onRetry={() => void unused.refetch()}
        />
      ) : unused.data.length === 0 ? (
        <EmptyState>每个母题都挂着词，没有要整理的</EmptyState>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            以下 {unused.data.length}{" "}
            个母题没有任何标注，可以删掉。只列母题，门类与类别不动。通常算作它的词，改为它其余可选母题里标注最多的那个。
          </p>

          {groups.map((group) => (
            <section key={group.path}>
              <h3 className={META_CLASS}>{group.path}</h3>
              <ul className="mt-2 space-y-1.5">
                {group.motifs.map((motif) => (
                  <li key={motif.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={!skipped.has(motif.id)}
                        onChange={() => toggle(motif.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-(--tone)"
                      />
                      <span className="min-w-0">
                        <span className="text-slate-800 dark:text-slate-200">
                          {motif.name}
                        </span>
                        {motif.description && (
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                            {motif.description}
                          </span>
                        )}
                        {motif.words.length > 0 && (
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                            {motif.words.map(describeWord).join("；")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ResponsiveDialog>
  );
}
