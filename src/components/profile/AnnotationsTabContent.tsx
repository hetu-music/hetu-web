"use client";

import { useUserContext } from "@/context/UserContext";
import { useRouter } from "@/i18n/navigation";
import { getCsrfToken } from "@/lib/api/csrf";
import type { CommentAnchor, MyComment, MyCommentGroup } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Filter = "all" | "public" | "private";

/** 批注所在的位置对应详情页的章节 */
const SECTION_HASH: Record<CommentAnchor, string> = {
  song: "comments",
  lyrics: "lyrics",
  notes: "notes",
  score: "score",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 个人页「我的批注」：自己写过的批注、私批与回复，按歌分组 */
export default function AnnotationsTabContent() {
  const t = useTranslations("profile.annotations");
  const router = useRouter();
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const queryKey = ["my-comments", user?.id ?? null];
  const { data: groups, isPending } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async (): Promise<MyCommentGroup[]> => {
      const res = await fetch("/api/public/comments/mine");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).groups;
    },
  });

  const filtered = useMemo(() => {
    if (!groups) return [];
    if (filter === "all") return groups;
    return groups
      .map((g) => ({
        ...g,
        comments: g.comments.filter((c) =>
          filter === "private" ? c.private : !c.private,
        ),
      }))
      .filter((g) => g.comments.length > 0);
  }, [groups, filter]);

  const total = groups?.reduce((n, g) => n + g.comments.length, 0) ?? 0;

  const open = (songId: number, anchor: CommentAnchor) => {
    const d = parseInt(
      sessionStorage.getItem("__hetu_web_nav_depth") || "0",
      10,
    );
    sessionStorage.setItem("__hetu_web_nav_depth", String(d + 1));
    router.push(`/song/${songId}#${SECTION_HASH[anchor]}`);
  };

  const remove = async (id: number) => {
    const csrf = await getCsrfToken();
    const res = await fetch(`/api/public/comments/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await queryClient.invalidateQueries({ queryKey: ["my-comments"] });
    // 详情页的批注缓存也作废，回到歌曲页时不显示已删的批注
    queryClient.invalidateQueries({ queryKey: ["song-comments"] });
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-320px)]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-320px)] bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 p-6 text-center shadow-xs">
        <PenLine
          size={32}
          className="text-slate-200 dark:text-slate-800 mb-3"
        />
        <p className="text-slate-500 text-xs sm:text-sm">{t("empty")}</p>
        <p className="mt-1.5 text-slate-400 text-xs">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-4 px-1">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
          {t("summary", { count: total, songs: groups.length })}
        </span>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/60">
          {(["all", "public", "private"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                filter === f
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {t(`filter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-xs text-slate-400">
          {t("emptyFiltered")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-8">
          {filtered.map((group) => (
            <section
              key={group.song.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-xs"
            >
              <button
                type="button"
                onClick={() => open(group.song.id, "song")}
                className="w-full flex items-center gap-3.5 p-3.5 text-left group"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-slate-900/5 dark:ring-white/10">
                  <Image
                    src={getCoverUrl(group.song)}
                    alt={group.song.title}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {group.song.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {group.song.artist?.join(" / ")}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {t("count", { count: group.comments.length })}
                </span>
              </button>

              <ul className="border-t border-slate-100 dark:border-slate-800/60 divide-y divide-slate-100 dark:divide-slate-800/60">
                {group.comments.map((comment) => (
                  <AnnotationRow
                    key={comment.id}
                    comment={comment}
                    onOpen={() => open(group.song.id, comment.anchor)}
                    onDelete={() => remove(comment.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnotationRow({
  comment,
  onOpen,
  onDelete,
}: {
  comment: MyComment;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations("profile.annotations");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 「删除」点一下变成「确认删除」，几秒内不确认就复原
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className={cn("px-4 py-3.5", deleting && "opacity-40")}>
      {/* 批在哪里：章节，以及所批的原文或所回复的批注 */}
      <p className="flex items-baseline gap-2 text-xs text-slate-400 dark:text-slate-500 min-w-0">
        <span className="shrink-0 text-blue-500/80 dark:text-blue-400/80">
          {comment.isReply ? t("reply") : t(`anchor.${comment.anchor}`)}
        </span>
        {comment.isReply ? (
          <span className="truncate">
            {comment.replyTo
              ? `${comment.replyTo.author || t("anonymous")}：${comment.replyTo.body}`
              : t("replyToDeleted")}
          </span>
        ) : (
          comment.anchorQuote && (
            <span className="truncate font-serif">
              {comment.anchorQuote.replace(/\s*\n\s*/g, " ")}
            </span>
          )
        )}
      </p>

      <p className="mt-1.5 font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 whitespace-pre-line wrap-break-word">
        {comment.body}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
        <time dateTime={comment.createdAt} className="tabular-nums">
          {formatDate(comment.createdAt)}
          {comment.editedAt && ` · ${t("edited")}`}
        </time>
        {comment.private && (
          <span className="px-1 rounded-sm ring-1 ring-current leading-4">
            {t("private")}
          </span>
        )}
        {comment.pending && (
          <span className="px-1 rounded-sm ring-1 ring-current leading-4">
            {t("pending")}
          </span>
        )}
        {comment.likeCount > 0 && (
          <span>{t("likes", { count: comment.likeCount })}</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onOpen}
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("open")}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "transition-colors",
            confirming ? "text-rose-500" : "hover:text-rose-500",
          )}
        >
          {confirming ? t("confirmDelete") : t("delete")}
        </button>
      </div>
    </li>
  );
}
