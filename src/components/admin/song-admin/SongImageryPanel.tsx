"use client";

import { Link } from "@/i18n/navigation";
import { MIN_OCCURRENCES } from "@/lib/quiz/pool";
import SuggestionReview from "../imagery-suggest/SuggestionReview";
import { useImagerySuggestions } from "../imagery-suggest/useImagerySuggestions";

/** 歌曲管理展开行中的意象标注区：已有标注一览 + 从歌词生成候选并审核保存 */
export default function SongImageryPanel({
  songId,
  csrfToken,
}: {
  songId: number;
  csrfToken: string;
}) {
  const imagery = useImagerySuggestions(songId, csrfToken);
  const { existing } = imagery;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          意象标注
        </h4>
        {existing && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            已标注 {existing.length} 个
          </span>
        )}
        {existing && existing.length < MIN_OCCURRENCES && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            少于 {MIN_OCCURRENCES} 个不会进入寻曲测验
          </span>
        )}
        <Link
          href="/admin/imagery"
          className="ml-auto text-xs text-slate-400 hover:text-blue-600"
        >
          对照编辑已有标注
        </Link>
      </div>

      {existing && existing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existing.map((o) => (
            <span
              key={o.id}
              title={o.category_name}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {o.imagery_name ?? `#${o.imagery_id}`}
            </span>
          ))}
        </div>
      )}

      <SuggestionReview imagery={imagery} songId={songId} />
    </section>
  );
}
