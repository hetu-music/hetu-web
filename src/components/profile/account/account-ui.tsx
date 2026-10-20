"use client";

import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
import { cn } from "@/lib/utils/utils";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

export type Notice = { ok: boolean; text: string } | null;

/** 提交结果的一行小字，几秒后消失 */
export function useNotice(duration = 3000) {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), duration);
    return () => clearTimeout(timer);
  }, [notice, duration]);
  return [notice, setNotice] as const;
}

export function NoticeText({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <span
      role="status"
      className={cn(
        "text-xs",
        notice.ok ? "text-(--tone)" : "text-rose-500 dark:text-rose-400",
      )}
    >
      {notice.text}
    </span>
  );
}

/** 账户设置里的一组：小字题名、一句说明，下面是表单或操作 */
export function AccountBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {description}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** 表单底部：主操作按钮，右边跟着结果提示或次要操作 */
export function SubmitRow({
  label,
  pending,
  disabled,
  notice,
  children,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  notice?: Notice;
  children?: ReactNode;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
      <button
        type="submit"
        disabled={pending || disabled}
        className={PRIMARY_BUTTON_CLASS}
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {label}
      </button>
      {children}
      {notice !== undefined && <NoticeText notice={notice} />}
    </div>
  );
}
