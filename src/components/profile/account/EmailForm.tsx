"use client";

import OtpStep from "@/components/auth/OtpStep";
import {
  AccountBlock,
  NoticeText,
  SubmitRow,
  useNotice,
} from "@/components/profile/account/account-ui";
import FormField from "@/components/shared/FormField";
import {
  FIELD_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LABEL_CLASS,
} from "@/components/shared/form-field";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { useUserContext } from "@/context/UserContext";
import { postAuth } from "@/lib/api/auth-api";
import {
  profileEmailFormSchema,
  type ProfileEmailFormValues,
} from "@/lib/forms/profile-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";

/** view：只显示邮箱；edit：填新邮箱与密码；new / current：填发到新、原邮箱的验证码 */
type Step = "view" | "edit" | "new" | "current";

/**
 * 登录邮箱：更改要核对密码，再填验证码。
 * GoTrue 开了「安全改邮箱」时新旧两个邮箱各收到一个码，先填新邮箱的，
 * 服务端回 done: false 再接着填原邮箱的；没开就只有新邮箱一个码。
 */
export default function EmailForm() {
  const t = useTranslations("profile.account.emailChange");
  const { user, refetch } = useUserContext();
  const [step, setStep] = useState<Step>("view");
  /** 每回到填新邮箱验证码这一步换一个 key：清空格子、重新倒数 */
  const [otpKey, setOtpKey] = useState(0);
  const [notice, setNotice] = useNotice(4000);

  const email = user?.email ?? "";
  const pendingEmail = user?.pendingEmail ?? "";

  const toNewCode = () => {
    setOtpKey((k) => k + 1);
    setStep("new");
  };

  const verify = (target: "new" | "current") => async (otp: string) => {
    const result = await postAuth<{ done: boolean }>("/api/auth/email/verify", {
      target,
      otp,
    });
    if (!result.ok) return result.error ?? t("error");
    if (!result.data.done) {
      setStep("current");
      return null;
    }
    const changedTo = pendingEmail;
    await refetch();
    setStep("view");
    setNotice({ ok: true, text: t("done", { email: changedTo }) });
    return null;
  };

  // GoTrue 重发时两个码都换新，已验过的原邮箱码也作废：回到第一个码重填
  const resend = async () => {
    const result = await postAuth("/api/auth/email/resend");
    if (!result.ok) return result.error ?? t("error");
    if (step === "current") toNewCode();
    return null;
  };

  const cancel = (
    <button
      type="button"
      onClick={() => setStep("view")}
      className={TEXT_BUTTON_CLASS}
    >
      {t("cancel")}
    </button>
  );

  return (
    <AccountBlock title={t("title")} description={t("description")}>
      {step === "view" && (
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("current")}</span>
          <p className="mt-2 py-1.5 text-[15px] text-slate-800 dark:text-slate-200 wrap-break-word">
            {email}
          </p>
          {pendingEmail && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500 wrap-break-word">
              {t("pending", { email: pendingEmail })}
              <button
                type="button"
                onClick={toNewCode}
                className={cn(TEXT_BUTTON_CLASS, "ml-1.5 text-(--tone)")}
              >
                {t("continue")}
              </button>
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => setStep("edit")}
              className={cn(TEXT_BUTTON_CLASS, "text-(--tone)")}
            >
              {t("change")}
            </button>
            <NoticeText notice={notice} />
          </div>
        </div>
      )}

      {step === "edit" && (
        <RequestForm
          onSent={async () => {
            await refetch();
            toNewCode();
          }}
          cancel={cancel}
        />
      )}

      {(step === "new" || step === "current") && (
        <div>
          <p className="mb-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400 wrap-break-word">
            {step === "new"
              ? t("sentNew", { email: pendingEmail })
              : t("sentCurrent", { email })}
          </p>
          <OtpStep
            key={`${step}-${otpKey}`}
            onSubmit={verify(step)}
            submitLabel={t("verify")}
            onResend={resend}
          >
            <p>{cancel}</p>
          </OtpStep>
        </div>
      )}
    </AccountBlock>
  );
}

function RequestForm({
  onSent,
  cancel,
}: {
  onSent: () => Promise<void>;
  cancel: ReactNode;
}) {
  const t = useTranslations("profile.account.emailChange");
  const [notice, setNotice] = useNotice(4000);
  const form = useForm<ProfileEmailFormValues>({
    resolver: zodResolver(profileEmailFormSchema),
    defaultValues: { email: "", currentPassword: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ email, currentPassword }) => {
    setNotice(null);
    const result = await postAuth("/api/auth/email", {
      email,
      password: currentPassword,
    });
    if (result.ok) {
      await onSent();
    } else {
      setNotice({ ok: false, text: result.error ?? t("error") });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        <FormField label={t("new")} error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            {...form.register("email")}
            className={cn(FIELD_CLASS, errors.email && FIELD_ERROR_CLASS)}
          />
        </FormField>
        <FormField
          label={t("password")}
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
      </div>

      <SubmitRow label={t("send")} pending={isSubmitting} notice={notice}>
        {cancel}
      </SubmitRow>
    </form>
  );
}
