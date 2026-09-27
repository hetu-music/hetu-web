"use client";

import type { CommentSlot } from "@/lib/utils/utils-comments";
import { useTranslations } from "next-intl";
import CommentComposer from "./CommentComposer";
import CommentThread from "./CommentThread";
import { useComments } from "./CommentsContext";

/** 某一处的全部批注，末尾是新批注的输入框 */
export default function SlotPanel({
  slot,
  autoFocus = false,
  composerFirst = false,
  onCancel,
}: {
  slot: CommentSlot;
  autoFocus?: boolean;
  /** 输入框放在最前（总评列表可能很长） */
  composerFirst?: boolean;
  onCancel?: () => void;
}) {
  const t = useTranslations("song.folio.comments");
  const { threads, create } = useComments();
  const list = threads.get(slot.key) ?? [];

  const composer = (
    <CommentComposer
      placeholder={t(`placeholder.${slot.section}`)}
      submitLabel={t("submit")}
      allowPrivate
      autoFocus={autoFocus}
      onSubmit={(body, isPrivate) => create(slot, body, isPrivate)}
      onCancel={onCancel}
      className={composerFirst && list.length > 0 ? "pb-4" : undefined}
    />
  );

  return (
    <div className="space-y-6">
      {composerFirst && composer}
      {list.map((thread) => (
        <CommentThread key={thread.comment.id} thread={thread} />
      ))}
      {!composerFirst && composer}
    </div>
  );
}
