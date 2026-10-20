import { FIELD_LABEL_CLASS } from "@/components/shared/form-field";
import { cn } from "@/lib/utils/utils";
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
