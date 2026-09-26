import { AlertCircle, Edit, Eye, EyeOff } from "lucide-react";
import React from "react";
import { songFields, typeColorMap } from "@/lib/constants";
import type { SongDetail } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { formatField } from "@/lib/utils/utils-common";
import { AdminCoverArt } from "./shared";
import SongImageryPanel from "./SongImageryPanel";
import { getMissingFields, isCriticalField, isFieldEmpty } from "./utils";

/** 展开后的完整字段一览与意象标注 */
function ExpandedContent({
  song,
  csrfToken,
}: {
  song: SongDetail;
  csrfToken: string;
}) {
  const missing = getMissingFields(song);

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
              信息待完善
            </h4>
            <div className="flex flex-wrap gap-2">
              {missing.map((field) => (
                <span
                  key={field}
                  className="px-2 py-0.5 text-xs bg-white dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-md text-amber-800 dark:text-amber-300"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {songFields.map((field) => {
          const shouldHighlight =
            isCriticalField(field.key) && isFieldEmpty(song, field);

          return (
            <div
              key={field.key}
              className={cn(
                "p-3 rounded-lg border text-sm transition-colors",
                shouldHighlight
                  ? "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
                  : "bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700",
              )}
            >
              <div className="flex justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    shouldHighlight
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {field.label}
                </span>
                {shouldHighlight && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </div>

              <div
                className={cn(
                  "font-medium truncate",
                  shouldHighlight
                    ? "text-red-700 dark:text-red-300"
                    : "text-slate-700 dark:text-slate-200",
                )}
              >
                {field.key === "hascover" ? (
                  song.hascover === true ? (
                    <span className="text-green-600 dark:text-green-400">
                      定制封面
                    </span>
                  ) : song.hascover === false ? (
                    <span className="text-purple-600 dark:text-purple-400">
                      初号机
                    </span>
                  ) : (
                    <span className="text-slate-400">默认</span>
                  )
                ) : field.key === "nmn_status" ? (
                  song.nmn_status === true ? (
                    <span className="text-green-600 dark:text-green-400">
                      ✓ 有乐谱
                    </span>
                  ) : (
                    <span className="text-slate-400">无乐谱</span>
                  )
                ) : (
                  formatField(song[field.key], field.type) || "-"
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 歌曲保存或发布后 updated_at 变化，重置候选（歌词和发布状态可能已变） */}
      <SongImageryPanel
        key={song.updated_at}
        songId={song.id}
        csrfToken={csrfToken}
      />
    </div>
  );
}

const SongListRow = React.memo(function SongListRow({
  song,
  idx,
  isExpanded,
  toggleRowExpansion,
  handleEdit,
  csrfToken,
}: {
  song: SongDetail;
  idx: number;
  isExpanded: boolean;
  toggleRowExpansion: (id: number) => void;
  handleEdit: (song: SongDetail) => void;
  csrfToken: string;
}) {
  const missingFields = getMissingFields(song);
  const visibleMissingFields = missingFields.slice(0, 4);
  const hiddenMissingCount = missingFields.length - visibleMissingFields.length;

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/30">
      {/* Main Row Content */}
      <div
        className={cn(
          "flex items-center gap-4 p-4 cursor-pointer transition-colors",
          isExpanded ? "bg-slate-50 dark:bg-slate-800/80" : "",
        )}
        onClick={() => toggleRowExpansion(song.id)}
      >
        {/* Index */}
        <div className="w-8 shrink-0 text-center font-mono text-sm text-slate-400">
          {idx}
        </div>

        {/* Cover */}
        <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden border border-slate-100 dark:border-slate-700">
          <AdminCoverArt song={song} />
        </div>

        {/* Title & Status */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="max-w-full font-medium text-slate-900 dark:text-slate-100 truncate">
              {song.title}
            </h3>
            {visibleMissingFields.map((field) => (
              <span
                key={field}
                className="shrink-0 inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {field}
              </span>
            ))}
            {hiddenMissingCount > 0 && (
              <span className="shrink-0 inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                +{hiddenMissingCount}项
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span>{song.album || "未归档"}</span>
            <span className="opacity-40">/</span>
            <span>
              {Array.isArray(song.lyricist)
                ? song.lyricist.join(", ")
                : song.lyricist || "-"}
            </span>
          </div>
        </div>

        {/* Meta Info (Desktop) */}
        <div className="hidden lg:flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400 shrink-0 mr-4">
          <div className="w-32 text-right truncate">
            {Array.isArray(song.composer)
              ? song.composer.join(", ")
              : song.composer || "-"}
          </div>
          <div className="w-24 text-center">
            {Array.isArray(song.type) && song.type[0] ? (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs border",
                  typeColorMap[song.type[0]]
                    ?.replace("bg-", "border-")
                    .replace("text-", "text-") || "border-slate-200",
                )}
              >
                {song.type[0]}
              </span>
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-2 shrink-0 ml-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(song);
            }}
            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors"
            title="编辑"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRowExpansion(song.id);
            }}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isExpanded
                ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20"
                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {isExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 p-6 animate-in slide-in-from-top-2 duration-200">
          <ExpandedContent song={song} csrfToken={csrfToken} />
        </div>
      )}
    </div>
  );
});

export default SongListRow;
