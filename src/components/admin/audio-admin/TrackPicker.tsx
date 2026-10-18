"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  DURATION_TOLERANCE,
  type DbSong,
  type NavSong,
} from "@/lib/navidrome/sync";
import { cn } from "@/lib/utils/utils";
import { SearchInput } from "../kit/parts";
import { META_CLASS, WARN_TEXT_CLASS } from "../kit/styles";
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
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && !pending && onClose()}
      title={`关联曲目 · ${song.title}`}
      description={`#${song.id} · ${song.album ?? "无专辑"} · ${formatDuration(song.length)}`}
      className="max-w-2xl"
    >
      <p className={cn(META_CLASS, "mb-3")}>
        #{song.id} · {song.album ?? "无专辑"} · {formatDuration(song.length)}
      </p>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="搜索曲库：标题、专辑、文件路径"
        className="md:w-full"
      />
      <p className="mt-2 text-xs text-slate-400">
        {pending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            保存中…
          </span>
        ) : query ? (
          `匹配 ${candidates.length} 首`
        ) : (
          `标题相近或时长相差 ${DURATION_TOLERANCE} 秒以内的曲目`
        )}
      </p>

      <ul className="-mx-2 mt-3">
        {candidates.length === 0 && (
          <li className="py-10 text-center font-kaiti text-base text-slate-400">
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
            durationDiff != null && Math.abs(durationDiff) > DURATION_TOLERANCE;
          return (
            <li key={nav.id}>
              <button
                type="button"
                disabled={pending || isCurrent || takenByOther}
                onClick={() => onPick(nav)}
                className={cn(
                  "w-full rounded-md px-2 py-2.5 text-left transition-colors",
                  "enabled:hover:bg-slate-100/70 dark:enabled:hover:bg-slate-900",
                  "disabled:cursor-not-allowed",
                  statusText && "opacity-60",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-slate-800 dark:text-slate-100">
                    {nav.title}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 text-xs tabular-nums">
                    {diffText && (
                      <span
                        className={diffBad ? WARN_TEXT_CLASS : "text-slate-400"}
                      >
                        {diffText}
                      </span>
                    )}
                    <span className="text-slate-500">
                      {formatDuration(nav.duration)}
                    </span>
                  </span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400">
                  {nav.path ?? nav.album}
                </span>
                {statusText && (
                  <span className="mt-1 block text-xs text-(--tone)">
                    {statusText}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ResponsiveDialog>
  );
}
