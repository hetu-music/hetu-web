"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { COMMENT_BODY_MAX } from "@/lib/utils/utils-comments";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useComments } from "./CommentsContext";

/** 字数接近上限时才显示计数 */
const SHOW_COUNT_FROM = COMMENT_BODY_MAX - 200;

interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  initial?: string;
  /** 顶层批注可选私批；回复与编辑不可 */
  allowPrivate?: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string, isPrivate: boolean) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

/** 批注输入框：一道底线，楷体，不做卡片 */
export default function CommentComposer({
  placeholder,
  submitLabel,
  initial = "",
  allowPrivate = false,
  autoFocus = false,
  onSubmit,
  onCancel,
  className,
}: CommentComposerProps) {
  const t = useTranslations("song.folio.comments");
  const { loggedIn, loginHref } = useComments();
  const [body, setBody] = useState(initial);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 不用原生 autoFocus：旁批刚挂上时还没排到所批的那一行，
  // 聚焦会把页面滚到它的临时位置；这里聚焦但不滚动
  useEffect(() => {
    if (autoFocus && loggedIn)
      textareaRef.current?.focus({ preventScroll: true });
  }, [autoFocus, loggedIn]);

  if (!loggedIn) {
    return (
      // 行高取旁批正文的行高（15px × 1.85），宽屏旁批里才与所批的那一行对齐
      <p
        className={cn(
          "text-xs leading-[27.75px] tracking-wider text-slate-400",
          className,
        )}
      >
        <Link
          href={loginHref}
          className="text-(--tone) hover:underline underline-offset-4"
        >
          {t("login")}
        </Link>
      </p>
    );
  }

  const length = Array.from(body.trim()).length;
  const canSubmit =
    length > 0 && length <= COMMENT_BODY_MAX && body.trim() !== initial.trim();

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(body.trim(), isPrivate);
      setBody("");
      setIsPrivate(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape" && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        rows={2}
        className="block w-full resize-none field-sizing-content min-h-[3.6em] max-h-[16em] bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 focus:border-(--tone) focus:outline-none px-0 py-1.5 font-kaiti text-[15px] leading-[1.8] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
      />
      <div className="mt-2.5 flex items-center gap-4 text-xs">
        {allowPrivate && (
          <label className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-3 accent-(--tone)"
            />
            {t("privateToggle")}
          </label>
        )}
        {length >= SHOW_COUNT_FROM && (
          <span
            className={cn(
              "tabular-nums",
              length > COMMENT_BODY_MAX ? "text-rose-500" : "text-slate-400",
            )}
          >
            {length}/{COMMENT_BODY_MAX}
          </span>
        )}
        <span className="flex-1" />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {t("cancel")}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || saving}
          className="flex items-center gap-1 tracking-widest text-(--tone) disabled:opacity-40 transition-opacity"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
