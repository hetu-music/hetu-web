"use client";

import ProfileSectionHeading from "@/components/profile/ProfileSectionHeading";
import {
  FIELD_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LABEL_CLASS,
  TEXTAREA_CLASS,
} from "@/components/profile/profile-ui";
import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
import { useUserContext } from "@/context/UserContext";
import { useAutoGrow } from "@/hooks/ui";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import {
  profileAccountFormSchema,
  profilePasswordFormSchema,
  type ProfileAccountFormValues,
  type ProfilePasswordFormValues,
} from "@/lib/forms/profile-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type Notice = { ok: boolean; text: string } | null;

/** 账户设置：公开资料与修改密码，两组表单 */
export default function AccountSection() {
  const t = useTranslations("profile");
  const { user, loaded } = useUserContext();

  return (
    <section>
      <ProfileSectionHeading label={t("tabs.account")} />
      {!loaded || !user ? (
        <Loader2 size={20} className="mt-12 animate-spin text-slate-400" />
      ) : (
        <div className="mt-8 lg:mt-12 max-w-[40em] space-y-16">
          <AccountForm />
          <PasswordForm />
        </div>
      )}
    </section>
  );
}

/** 字段：标签、输入与校验提示 */
function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <span className="mt-2 block">{children}</span>
      {error && (
        <span className="mt-1.5 block text-xs text-rose-500">{error}</span>
      )}
    </label>
  );
}

/** 提交结果：一行小字，几秒后消失 */
function NoticeText({ notice }: { notice: Notice }) {
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

function AccountForm() {
  const t = useTranslations("profile.account");
  const { user, refetch } = useUserContext();
  const csrfToken = useCsrfToken();
  const [notice, setNotice] = useState<Notice>(null);
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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSave = form.handleSubmit(
    async ({ displayName, intro, display }) => {
      setNotice(null);
      if (!csrfToken) {
        setNotice({ ok: false, text: t("saveError") });
        return;
      }
      try {
        const res = await fetch("/api/auth/account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            displayName,
            intro,
            ...(user?.isAdmin ? { display } : {}),
          }),
        });
        if (res.ok) {
          setNotice({ ok: true, text: t("saved") });
          await refetch();
        } else {
          const d = await res.json();
          setNotice({ ok: false, text: d.error || t("saveError") });
        }
      } catch {
        setNotice({ ok: false, text: t("saveError") });
      }
    },
  );

  const introField = form.register("intro");

  return (
    <form onSubmit={handleSave} noValidate>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("description")}
      </p>

      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        <Field label={t("displayName")} error={errors.displayName?.message}>
          <input
            type="text"
            maxLength={30}
            {...form.register("displayName")}
            className={cn(FIELD_CLASS, errors.displayName && FIELD_ERROR_CLASS)}
          />
        </Field>

        {/* 邮箱不能改，照原样写出来，不做成灰掉的输入框 */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("email")}</span>
          <p className="mt-2 py-1.5 text-[15px] text-slate-500 dark:text-slate-400 wrap-break-word">
            {user?.email}
          </p>
        </div>

        <Field
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
        </Field>

        {/* 公开展示：仅管理员可设 */}
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

      <div className="mt-10 flex items-center gap-5">
        <button
          type="submit"
          disabled={isSubmitting || !csrfToken}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting && <Loader2 size={12} className="animate-spin" />}
          {t("save")}
        </button>
        <NoticeText notice={notice} />
      </div>
    </form>
  );
}

function PasswordForm() {
  const t = useTranslations("profile.account.password");
  const csrfToken = useCsrfToken();
  const [notice, setNotice] = useState<Notice>(null);

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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleChange = form.handleSubmit(
    async ({ currentPassword, newPassword }) => {
      setNotice(null);
      if (!csrfToken) {
        setNotice({ ok: false, text: t("error") });
        return;
      }
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
        });
        if (res.ok) {
          setNotice({ ok: true, text: t("success") });
          form.reset();
        } else {
          const d = await res.json();
          setNotice({ ok: false, text: d.error || t("error") });
        }
      } catch {
        setNotice({ ok: false, text: t("error") });
      }
    },
  );

  return (
    <form onSubmit={handleChange} noValidate>
      <h3 className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
        {t("title")}
      </h3>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        {t("description")}
      </p>

      <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        <Field label={t("current")} error={errors.currentPassword?.message}>
          <input
            type="password"
            autoComplete="current-password"
            {...form.register("currentPassword")}
            className={cn(
              FIELD_CLASS,
              errors.currentPassword && FIELD_ERROR_CLASS,
            )}
          />
        </Field>
        <Field
          label={t("new")}
          error={errors.newPassword?.message}
          className="sm:col-start-1"
        >
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t("newPlaceholder")}
            {...form.register("newPassword")}
            className={cn(FIELD_CLASS, errors.newPassword && FIELD_ERROR_CLASS)}
          />
        </Field>
        <Field label={t("confirm")} error={errors.confirmPassword?.message}>
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
        </Field>
      </div>

      <div className="mt-10 flex items-center gap-5">
        <button
          type="submit"
          disabled={isSubmitting || !csrfToken}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting && <Loader2 size={12} className="animate-spin" />}
          {t("submit")}
        </button>
        <NoticeText notice={notice} />
      </div>
    </form>
  );
}
