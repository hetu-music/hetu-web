"use client";

import {
  AccountBlock,
  SubmitRow,
} from "@/components/profile/account/account-ui";
import FormField from "@/components/shared/FormField";
import { FIELD_CLASS, FIELD_ERROR_CLASS } from "@/components/shared/form-field";
import { addToast } from "@/components/ui/toast";
import { postAuth } from "@/lib/api/auth-api";
import {
  profilePasswordFormSchema,
  type ProfilePasswordFormValues,
} from "@/lib/forms/profile-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

/** 修改密码：核对当前密码；改好后服务端会退出其他设备上的登录 */
export default function PasswordForm() {
  const t = useTranslations("profile.account.password");

  const form = useForm<ProfilePasswordFormValues>({
    resolver: zodResolver(profilePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;

  const handleChange = form.handleSubmit(
    async ({ currentPassword, newPassword }) => {
      const result = await postAuth("/api/auth/change-password", {
        oldPassword: currentPassword,
        newPassword,
      });
      if (result.ok) {
        addToast("success", t("success"));
        form.reset();
      } else {
        addToast("error", result.error ?? t("error"));
      }
    },
  );

  return (
    <AccountBlock title={t("title")} description={t("description")}>
      <form onSubmit={handleChange} noValidate>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <FormField
            label={t("current")}
            error={errors.currentPassword?.message}
          >
            <input
              type="password"
              autoComplete="current-password"
              {...form.register("currentPassword")}
              className={cn(
                FIELD_CLASS,
                errors.currentPassword && FIELD_ERROR_CLASS,
              )}
            />
          </FormField>
          <FormField
            label={t("new")}
            error={errors.newPassword?.message}
            className="sm:col-start-1"
          >
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t("newPlaceholder")}
              {...form.register("newPassword")}
              className={cn(
                FIELD_CLASS,
                errors.newPassword && FIELD_ERROR_CLASS,
              )}
            />
          </FormField>
          <FormField
            label={t("confirm")}
            error={errors.confirmPassword?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t("confirmPlaceholder")}
              {...form.register("confirmPassword")}
              className={cn(
                FIELD_CLASS,
                errors.confirmPassword && FIELD_ERROR_CLASS,
              )}
            />
          </FormField>
        </div>

        <SubmitRow label={t("submit")} pending={isSubmitting} />
      </form>
    </AccountBlock>
  );
}
