"use client";

import type { SongComment } from "@/lib/types";
import { cn } from "@/lib/utils/utils";
import type { CommentThread as Thread } from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import CommentComposer from "./CommentComposer";
import { useComments } from "./CommentsContext";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 一则批注或回复：正文楷体，下面一行小字落款与操作 */
function CommentItem({
  comment,
  isReply,
  onReply,
}: {
  comment: SongComment;
  isReply: boolean;
  onReply?: () => void;
}) {
  const t = useTranslations("song.folio.comments");
  const { loggedIn, edit, remove, like } = useComments();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 「删除」点一下变成「确认删除」，几秒内不确认就复原
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  if (comment.deleted) {
    return (
      <p className="font-kaiti text-sm text-slate-400 dark:text-slate-600">
        {t("deleted")}
      </p>
    );
  }

  if (editing) {
    return (
      <CommentComposer
        initial={comment.body}
        placeholder=""
        submitLabel={t("save")}
        autoFocus
        onSubmit={async (body) => {
          await edit(comment.id, body);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const action =
    "hover:text-slate-700 dark:hover:text-slate-200 transition-colors";

  return (
    <article>
      <p
        className={cn(
          "font-kaiti text-[15px] leading-[1.85] whitespace-pre-line wrap-break-word",
          comment.private || comment.pending
            ? "text-slate-500 dark:text-slate-400"
            : "text-slate-700 dark:text-slate-300",
        )}
      >
        {comment.body}
      </p>
      <footer className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
        <span>
          <span className="text-slate-500 dark:text-slate-400">
            {comment.author || t("anonymous")}
          </span>
          <span className="ml-1 text-(--tone)">
            {isReply ? t("replyVerb") : t("verb")}
          </span>
        </span>
        {comment.private && (
          <span className="px-1 rounded-sm ring-1 ring-current text-[10px] leading-4">
            {t("private")}
          </span>
        )}
        {comment.pending && (
          <span className="px-1 rounded-sm ring-1 ring-current text-[10px] leading-4">
            {t("pending")}
          </span>
        )}
        <time dateTime={comment.createdAt} className="tabular-nums">
          {formatDate(comment.createdAt)}
          {comment.editedAt && ` · ${t("edited")}`}
        </time>
        {!comment.private && (
          <button
            type="button"
            disabled={!loggedIn}
            onClick={() => like(comment.id, !comment.liked)}
            aria-pressed={comment.liked}
            className={cn(
              "tabular-nums disabled:cursor-default",
              comment.liked ? "text-(--tone)" : loggedIn && action,
            )}
          >
            {t("like")}
            {comment.likeCount > 0 && ` ${comment.likeCount}`}
          </button>
        )}
        {onReply && loggedIn && (
          <button type="button" onClick={onReply} className={action}>
            {t("reply")}
          </button>
        )}
        {comment.mine && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={action}
            >
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() =>
                confirmDelete ? remove(comment.id) : setConfirmDelete(true)
              }
              className={confirmDelete ? "text-rose-500" : action}
            >
              {confirmDelete ? t("confirmDelete") : t("delete")}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

/** 一则批注连同回复；回复缩进，左侧一道细线 */
export default function CommentThread({ thread }: { thread: Thread }) {
  const t = useTranslations("song.folio.comments");
  const { reply } = useComments();
  const [replying, setReplying] = useState(false);
  const { comment, replies, orphanQuote } = thread;
  // 私批与已删的批注不能回复
  const canReply = !comment.private && !comment.deleted && !comment.pending;

  return (
    <div>
      {orphanQuote && (
        <blockquote className="mb-2 pl-3 border-l border-slate-300 dark:border-slate-700 font-serif text-xs leading-relaxed text-slate-400 dark:text-slate-500 line-clamp-2">
          <span className="mr-1.5">{t("orphan")}</span>
          {orphanQuote}
        </blockquote>
      )}
      <CommentItem
        comment={comment}
        isReply={false}
        onReply={canReply ? () => setReplying((v) => !v) : undefined}
      />
      {(replies.length > 0 || replying) && (
        <div className="mt-3 ml-1 pl-4 border-l border-(--tone)/30 space-y-3">
          {replies.map((r) => (
            <CommentItem key={r.id} comment={r} isReply />
          ))}
          {replying && (
            <CommentComposer
              placeholder={t("placeholder.reply")}
              submitLabel={t("submitReply")}
              autoFocus
              onSubmit={async (body) => {
                await reply(comment.id, body);
                setReplying(false);
              }}
              onCancel={() => setReplying(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
