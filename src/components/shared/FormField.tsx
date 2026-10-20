import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
import { cn } from "@/lib/utils/utils";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * 表单里的一栏：小字标签、输入框与校验提示。登录注册与个人中心共用。
 * aside 放在标签同一行的右端，如密码栏的「忘记密码」。
 */
export default function FormField({
  label,
  error,
  aside,
  className,
  children,
}: {
  label: string;
  error?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const field = (
    <>
      <span className="mt-2 block">{children}</span>
      {error && (
        <span className="mt-1.5 block text-xs text-rose-500">{error}</span>
      )}
    </>
  );

  // 标签行里有链接时，label 不能包住它（点链接会先聚焦输入框）：
  // 看得见的标签与链接排在一行，读屏用的标签另放进 label 里
  if (aside) {
    return (
      <div className={className}>
        <div className="flex items-baseline justify-between gap-4">
          <span aria-hidden className={FIELD_LABEL_CLASS}>
            {label}
          </span>
          {aside}
        </div>
        <label className="block">
          <span className="sr-only">{label}</span>
          {field}
        </label>
      </div>
    );
  }

  return (
    <label className={cn("block", className)}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {field}
    </label>
  );
}

/** 整张表单的错误（服务端回的、人机验证失败等），不属于某一栏 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-rose-500 dark:text-rose-400">
      {message}
    </p>
  );
}

/** 表单的主操作：强调色文字按钮，提交中转圈并禁用。转圈图标随字号缩放 */
export function SubmitButton({
  pending,
  disabled,
  className,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(PRIMARY_BUTTON_CLASS, className)}
    >
      {pending && <Loader2 className="size-[1em] animate-spin" />}
      {children}
    </button>
  );
}
