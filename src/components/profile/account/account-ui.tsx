import { GroupHeading } from "@/components/profile/ProfileSectionHeading";
import { SubmitButton } from "@/components/shared/FormField";
import type { ReactNode } from "react";

/** 账户设置里的一组：题头、一句说明，下面是表单或操作 */
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
      <GroupHeading label={title} />
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {description}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}

/**
 * 表单底部：主操作按钮，右边可跟次要操作（如「取消」）。
 * 提交结果走全站的提示条（addToast），不在这里另写一行定时消失的小字。
 */
export function SubmitRow({
  label,
  pending,
  children,
}: {
  label: string;
  pending: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
      <SubmitButton pending={pending}>{label}</SubmitButton>
      {children}
    </div>
  );
}
