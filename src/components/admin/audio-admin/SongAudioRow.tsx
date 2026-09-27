"use client";

import { Link2, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { useState } from "react";
import { DURATION_TOLERANCE } from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import {
  formatDiff,
  formatDuration,
  needsAttention,
  type SongRow,
} from "./utils";

export default function SongAudioRow({
  row,
  busy,
  onPick,
  onUnlink,
}: {
  row: SongRow;
  busy: boolean;
  onPick: () => void;
  onUnlink: () => void;
}) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const { song, nav, navidId, durationDiff } = row;
  const attention = needsAttention(row);
  const diffText = formatDiff(durationDiff);
  const diffBad =
    durationDiff != null && Math.abs(durationDiff) > DURATION_TOLERANCE;
  const hasAudioMismatch = Boolean(song.has_audio) !== Boolean(nav);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white px-4 py-3 transition-colors md:flex-row md:items-center dark:bg-slate-900/60",
        attention
          ? "border-amber-200 dark:border-amber-900/60"
          : "border-slate-100 dark:border-slate-800",
      )}
    >
      {/* 歌曲 */}
      <div className="min-w-0 md:w-2/5">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            #{song.id}
          </span>
          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
            {song.title}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">
          {song.album ?? "无专辑"} · {formatDuration(song.length)}
        </div>
      </div>

      {/* 关联的曲目 */}
      <div className="min-w-0 flex-1 text-sm">
        {nav ? (
          <>
            <div className="flex items-center gap-2">
              <span className="truncate text-slate-700 dark:text-slate-200">
                {nav.title}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                {formatDuration(nav.duration)}
              </span>
              {diffText && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    diffBad
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {diffText}
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-400">
              {nav.path ?? nav.album}
            </div>
          </>
        ) : navidId ? (
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <TriangleAlert size={14} />
            关联的曲目已不在曲库中
          </span>
        ) : (
          <span className="text-slate-400">未关联</span>
        )}
        {hasAudioMismatch && (
          <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            has_audio 为 {String(Boolean(song.has_audio))}，与关联状态不一致
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="flex shrink-0 items-center gap-1.5 md:justify-end">
        {busy ? (
          <Loader2 size={16} className="m-2 animate-spin text-slate-400" />
        ) : confirmUnlink ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmUnlink(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmUnlink(false);
                onUnlink();
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
            >
              确认解除
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onPick}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
            >
              <Link2 size={14} />
              {navidId ? "更换" : "关联"}
            </button>
            {(navidId || song.has_audio) && (
              <button
                type="button"
                onClick={() => setConfirmUnlink(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Unlink size={14} />
                解除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
