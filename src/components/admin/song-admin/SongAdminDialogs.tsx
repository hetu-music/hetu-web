import { CheckCircle2, Globe, X, XCircle } from "lucide-react";
import type { SearchResultItem } from "@/lib/api/api-auto-complete";
import { cn } from "@/lib/utils/utils";
import type { OperationMessage } from "./types";

/** 自动补全的搜索结果选择弹窗 */
export function SearchResultsModal({
  results,
  onSelect,
  onClose,
}: {
  results: SearchResultItem[];
  onSelect: (result: SearchResultItem) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151921] w-full max-w-lg max-h-[70vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200/50 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-[#151921]/50 backdrop-blur-md">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            选择歌曲
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => onSelect(result)}
              className={cn(
                "w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                "border-b border-slate-100 dark:border-slate-800 last:border-b-0",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-medium shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">
                    {result.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {result.artists.join(", ") || "未知艺术家"}
                  </div>
                  {result.album && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      专辑: {result.album}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921]">
          <p className="text-xs text-slate-400 text-center">
            共找到 {results.length} 个结果，点击选择要补全的歌曲
          </p>
        </div>
      </div>
    </div>
  );
}

/** 发布前的二次确认 */
export function PublishConfirmDialog({
  songTitle,
  isPublishing,
  onConfirm,
  onCancel,
}: {
  songTitle?: string;
  isPublishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151921] w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Globe size={20} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              确认发布歌曲
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              请确认《{songTitle || "这首歌曲"}
              》已经编辑完成。发布后数据将对所有用户实时可见。
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPublishing}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5 text-sm"
          >
            确认发布
          </button>
        </div>
      </div>
    </div>
  );
}

/** 操作结果吐司 */
export function OperationToast({ message }: { message: OperationMessage }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div
        className={cn(
          "px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border backdrop-blur-md",
          message.type === "success"
            ? "bg-emerald-50/90 text-emerald-800 border-emerald-200 dark:bg-emerald-900/90 dark:text-emerald-100 dark:border-emerald-800"
            : "bg-red-50/90 text-red-800 border-red-200 dark:bg-red-900/90 dark:text-red-100 dark:border-red-800",
        )}
      >
        {message.type === "success" ? (
          <CheckCircle2 size={18} />
        ) : (
          <XCircle size={18} />
        )}
        <span className="font-medium">{message.text}</span>
      </div>
    </div>
  );
}
