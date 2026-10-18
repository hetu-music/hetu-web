import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import type { SearchResultItem } from "@/lib/api/api-auto-complete";

/** 自动补全的搜索结果：选一首拿它的资料补空字段 */
export function SearchResultsDialog({
  open,
  results,
  onSelect,
  onClose,
}: {
  open: boolean;
  results: SearchResultItem[];
  onSelect: (result: SearchResultItem) => void;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="选择要补全的歌曲"
      description={`共找到 ${results.length} 个结果`}
    >
      <ol className="-mx-2">
        {results.map((result) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => onSelect(result)}
              className="w-full rounded-md px-2 py-2.5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-900"
            >
              <span className="block truncate text-slate-900 dark:text-slate-100">
                {result.name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {[result.artists.join("、") || "未知艺术家", result.album]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </ResponsiveDialog>
  );
}
