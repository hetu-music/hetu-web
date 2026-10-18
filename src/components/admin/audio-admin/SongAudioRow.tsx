"use client";

import { Loader2 } from "lucide-react";
import { DURATION_TOLERANCE } from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import { ConfirmButton } from "../kit/parts";
import { TEXT_PRIMARY_CLASS, WARN_TEXT_CLASS } from "../kit/styles";
import {
  formatDiff,
  formatDuration,
  needsAttention,
  type SongRow,
} from "./utils";

/** 一首歌与它关联的 Navidrome 曲目。showSong 为 false 时只列曲目（歌曲工作台里用） */
export default function SongAudioRow({
  row,
  busy,
  onPick,
  onUnlink,
  showSong = true,
}: {
  row: SongRow;
  busy: boolean;
  onPick: () => void;
  onUnlink: () => void;
  showSong?: boolean;
}) {
  const { song, nav, navidId, durationDiff } = row;
  const attention = needsAttention(row);
  const diffText = formatDiff(durationDiff);
  const diffBad =
    durationDiff != null && Math.abs(durationDiff) > DURATION_TOLERANCE;
  const hasAudioMismatch = Boolean(song.has_audio) !== Boolean(nav);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-l-2 border-b-slate-200/70 py-3 pl-3 md:flex-row md:items-center md:gap-6 dark:border-b-slate-800",
        attention ? "border-l-amber-400" : "border-l-transparent",
      )}
    >
      {showSong && (
        <div className="min-w-0 md:w-2/5">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
              {song.id}
            </span>
            <span className="truncate text-slate-900 dark:text-slate-100">
              {song.title}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {song.album ?? "无专辑"} · {formatDuration(song.length)}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 text-sm">
        {nav ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="truncate text-slate-700 dark:text-slate-200">
                {nav.title}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                {formatDuration(nav.duration)}
              </span>
              {diffText && (
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    diffBad ? WARN_TEXT_CLASS : "text-slate-400",
                  )}
                >
                  {diffText}
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
              {nav.path ?? nav.album}
            </div>
          </>
        ) : navidId ? (
          <span className={WARN_TEXT_CLASS}>关联的曲目已不在曲库中</span>
        ) : (
          <span className="text-slate-400">未关联</span>
        )}
        {hasAudioMismatch && (
          <div className={cn("mt-0.5 text-xs", WARN_TEXT_CLASS)}>
            has_audio 为 {String(Boolean(song.has_audio))}，与关联状态不一致
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4 md:justify-end">
        {busy ? (
          <Loader2 size={14} className="animate-spin text-slate-400" />
        ) : (
          <>
            <button
              type="button"
              onClick={onPick}
              className={TEXT_PRIMARY_CLASS}
            >
              {navidId ? "更换" : "关联"}
            </button>
            {(navidId || song.has_audio) && (
              <ConfirmButton
                onConfirm={onUnlink}
                label="解除"
                confirmLabel="确认解除"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
