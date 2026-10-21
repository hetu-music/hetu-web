"use client";

import {
  AccountBlock,
  SubmitRow,
} from "@/components/profile/account/account-ui";
import FormField from "@/components/shared/FormField";
import {
  FIELD_CLASS,
  FIELD_ERROR_CLASS,
  TEXTAREA_CLASS,
} from "@/components/shared/form-field";
import { addToast } from "@/components/ui/toast";
import { useUserContext } from "@/context/UserContext";
import { useAutoGrow } from "@/hooks/ui";
import { postAuth } from "@/lib/api/auth-api";
import {
  profileAccountFormSchema,
  type ProfileAccountFormValues,
} from "@/lib/forms/profile-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

/** 公开资料：用户名、简介；管理员另有「公开展示」 */
export default function ProfileForm() {
  const t = useTranslations("profile.account");
  const { user, refetch } = useUserContext();
  const introRef = useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<ProfileAccountFormValues>({
    resolver: zodResolver(profileAccountFormSchema),
    defaultValues: { displayName: "", intro: "", display: false },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;
  const intro = useWatch({ control: form.control, name: "intro" }) ?? "";
  useAutoGrow(introRef, intro);

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.name ?? "",
        intro: user.intro ?? "",
        display: user.display ?? false,
      });
    }
  }, [form, user]);

  const handleSave = form.handleSubmit(
    async ({ displayName, intro, display }) => {
      const result = await postAuth("/api/auth/account", {
        displayName,
        intro,
        ...(user?.isAdmin ? { display } : {}),
      });
      if (result.ok) {
        addToast("success", t("saved"));
        await refetch();
      } else {
        addToast("error", result.error ?? t("saveError"));
      }
    },
  );

  const introField = form.register("intro");

  return (
    <AccountBlock title={t("profileTitle")} description={t("description")}>
      <form onSubmit={handleSave} noValidate>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <FormField
            label={t("displayName")}
            error={errors.displayName?.message}
          >
            <input
              type="text"
              maxLength={30}
              {...form.register("displayName")}
              className={cn(
                FIELD_CLASS,
                errors.displayName && FIELD_ERROR_CLASS,
              )}
            />
          </FormField>

          <FormField
            label={t("intro")}
            error={errors.intro?.message}
            className="sm:col-span-2"
          >
            <textarea
              maxLength={200}
              rows={1}
              {...introField}
              ref={(el) => {
                introField.ref(el);
                introRef.current = el;
              }}
              className={cn(TEXTAREA_CLASS, errors.intro && FIELD_ERROR_CLASS)}
            />
          </FormField>

          {/* 公开展示：仅管理员可设（接口也只认管理员的） */}
          {user?.isAdmin && (
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...form.register("display")}
                  className="size-3.5 accent-(--tone)"
                />
                {t("display")}
              </label>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                {t("displayHint")}
              </p>
            </div>
          )}
        </div>

        <SubmitRow label={t("save")} pending={isSubmitting} />
      </form>
    </AccountBlock>
  );
}
