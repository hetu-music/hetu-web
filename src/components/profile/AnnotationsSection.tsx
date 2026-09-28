"use client";

import ProfileSectionHeading from "@/components/profile/ProfileSectionHeading";
import { bumpNavDepth, formatDate } from "@/components/profile/profile-ui";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { useUserContext } from "@/context/UserContext";
import { useTwoStepConfirm } from "@/hooks/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { getCsrfToken } from "@/lib/api/csrf";
import type { CommentAnchor, MyComment, MyCommentGroup } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useMemo, useState } from "react";

type Filter = "all" | "public" | "private";
const FILTERS: Filter[] = ["all", "public", "private"];

/** 批注所在的位置对应详情页的章节 */
const SECTION_HASH: Record<CommentAnchor, string> = {
  song: "comments",
  lyrics: "lyrics",
  notes: "notes",
  score: "score",
};

/** 我的批评：自己写过的批注、评点、私批与回复，按歌分组 */
export default function AnnotationsSection() {
  const t = useTranslations("profile");
  const router = useRouter();
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: groups, isPending } = useQuery({
    queryKey: ["my-comments", user?.id ?? null],
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
    bumpNavDepth();
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

  const hasAny = !!groups && groups.length > 0;

  return (
    <section>
      <ProfileSectionHeading label={t("tabs.annotations")}>
        {hasAny && (
          <div className="flex items-center gap-4">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  TEXT_BUTTON_CLASS,
                  filter === f && "text-(--tone) dark:text-(--tone)",
                )}
              >
                {t(`annotations.filter.${f}`)}
              </button>
            ))}
          </div>
        )}
      </ProfileSectionHeading>

      {isPending ? (
        <Loader2 size={20} className="mt-12 animate-spin text-slate-400" />
      ) : !hasAny ? (
        <div className="mt-12 font-kaiti text-[15px] leading-[1.85] text-slate-400 dark:text-slate-500">
          <p>{t("annotations.empty")}</p>
          <p>{t("annotations.emptyHint")}</p>
        </div>
      ) : (
        <>
          <p className="mt-8 lg:mt-12 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {t("annotations.summary", { count: total, songs: groups.length })}
          </p>

          {filtered.length === 0 ? (
            <p className="mt-10 font-kaiti text-[15px] text-slate-400 dark:text-slate-500">
              {t("annotations.emptyFiltered")}
            </p>
          ) : (
            <div className="mt-10 space-y-14">
              {filtered.map((group) => (
                <article key={group.song.id}>
                  <Link
                    href={`/song/${group.song.id}#comments`}
                    onClick={bumpNavDepth}
                    className="group flex items-center gap-4"
                  >
                    <span className="shrink-0 size-10 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10">
                      <Image
                        src={getCoverUrl(group.song)}
                        alt=""
                        width={40}
                        height={40}
                        className="w-full h-full object-cover grayscale-35 transition duration-700 group-hover:grayscale-0 group-hover:scale-[1.04]"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-base text-slate-900 dark:text-slate-100 truncate group-hover:text-(--tone) transition-colors">
                        {group.song.title}
                      </span>
                      {group.song.artist && group.song.artist.length > 0 && (
                        <span className="block mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                          {group.song.artist.join(" / ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {t("annotations.count", {
                        count: group.comments.length,
                      })}
                    </span>
                  </Link>

                  <ul className="mt-6 space-y-7 sm:pl-14">
                    {group.comments.map((comment) => (
                      <AnnotationRow
                        key={comment.id}
                        comment={comment}
                        onOpen={() => open(group.song.id, comment.anchor)}
                        onDelete={() => remove(comment.id)}
                      />
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
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
  const del = useTwoStepConfirm();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!del.request()) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <li className={cn("transition-opacity", deleting && "opacity-40")}>
      {/* 批在哪里：章节，以及所批的原文或所回复的批注 */}
      <p className="flex items-baseline gap-2.5 text-xs text-slate-400 dark:text-slate-500 min-w-0">
        <span className="shrink-0 tracking-[0.2em] text-(--tone)">
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

      <p className="mt-2 font-kaiti text-[15px] leading-[1.85] text-slate-700 dark:text-slate-300 whitespace-pre-line wrap-break-word">
        {comment.body}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
        <time dateTime={comment.createdAt} className="tabular-nums">
          {formatDate(comment.createdAt)}
          {comment.editedAt && ` · ${t("edited")}`}
        </time>
        {comment.private && <span>{t("private")}</span>}
        {comment.pending && (
          <span className="text-amber-600 dark:text-amber-400">
            {t("pending")}
          </span>
        )}
        {comment.likeCount > 0 && (
          <span>{t("likes", { count: comment.likeCount })}</span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onOpen} className={TEXT_BUTTON_CLASS}>
          {t("open")}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            TEXT_BUTTON_CLASS,
            del.confirming
              ? "text-rose-500 dark:text-rose-400"
              : "hover:text-rose-500 dark:hover:text-rose-400",
          )}
        >
          {del.confirming ? t("confirmDelete") : t("delete")}
        </button>
      </div>
    </li>
  );
}
