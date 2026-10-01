"use client";

import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DURATION_TOLERANCE,
  type DbSong,
  type NavSong,
} from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import { formatDiff, formatDuration, rankCandidates } from "./utils";

/** 为一首歌挑选 Navidrome 曲目 */
export default function TrackPicker({
  song,
  currentNavidId,
  library,
  owners,
  pending,
  onPick,
  onClose,
}: {
  song: DbSong;
  currentNavidId: string | null;
  library: NavSong[];
  /** navid → 已关联它的歌曲 */
  owners: Map<string, DbSong>;
  pending: boolean;
  onPick: (nav: NavSong) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => rankCandidates(song, library, owners, query),
    [song, library, owners, query],
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent variant="admin" className="max-w-2xl">
        <DialogHeader className="flex-col items-start gap-1">
          <div className="flex w-full items-center justify-between gap-4">
            <DialogTitle className="text-lg">
              关联曲目：{song.title}
            </DialogTitle>
            <DialogClose
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              disabled={pending}
            >
              <X size={18} />
            </DialogClose>
          </div>
          <DialogDescription>
            #{song.id} · {song.album ?? "无专辑"} ·{" "}
            {formatDuration(song.length)}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索曲库：标题、专辑、文件路径"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {query
              ? `匹配 ${candidates.length} 首`
              : `标题相近或时长相差 ${DURATION_TOLERANCE} 秒以内的曲目`}
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto px-3 py-3">
          {candidates.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400">
              没有候选曲目，试试搜索
            </li>
          )}
          {candidates.map(({ nav, durationDiff, owner }) => {
            const isCurrent = nav.id === currentNavidId;
            const takenByOther = owner != null && owner.id !== song.id;
            const statusText = isCurrent
              ? "当前关联"
              : takenByOther
                ? `已关联到 #${owner.id} ${owner.title}`
                : null;
            const diffText = formatDiff(durationDiff);
            const diffBad =
              durationDiff != null &&
              Math.abs(durationDiff) > DURATION_TOLERANCE;
            return (
              <li key={nav.id}>
                <button
                  type="button"
                  disabled={pending || isCurrent || takenByOther}
                  onClick={() => onPick(nav)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                    "enabled:hover:bg-emerald-50 dark:enabled:hover:bg-emerald-900/20",
                    "disabled:cursor-not-allowed",
                    statusText && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {nav.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                      {diffText && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5",
                            diffBad
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                          )}
                        >
                          {diffText}
                        </span>
                      )}
                      <span className="text-slate-500">
                        {formatDuration(nav.duration)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">
                    {nav.path ?? nav.album}
                  </div>
                  {statusText && (
                    <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                      {statusText}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {pending && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 py-3 text-sm text-slate-500 dark:border-slate-800">
            <Loader2 size={16} className="animate-spin" />
            保存中…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
