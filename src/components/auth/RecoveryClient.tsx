"use client";

import AuthShell from "@/components/auth/AuthShell";
import CaptchaField, { useFormCaptcha } from "@/components/auth/CaptchaField";
import OtpStep from "@/components/auth/OtpStep";
import FormField, {
  FormError,
  SubmitButton,
} from "@/components/shared/FormField";
import { FIELD_CLASS, FIELD_ERROR_CLASS } from "@/components/shared/form-field";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { Link, useRouter } from "@/i18n/navigation";
import { postAuth } from "@/lib/api/auth-api";
import type { GallerySong } from "@/lib/auth-gallery-shared";
import {
  newPasswordFormSchema,
  recoveryEmailFormSchema,
  type NewPasswordFormValues,
  type RecoveryEmailFormValues,
} from "@/lib/forms/auth-form";
import { authPathFor } from "@/lib/utils/safe-next";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

type Step = "email" | "otp" | "password" | "done";

/**
 * 找回密码：填邮箱 → 填验证码 → 设新密码。
 *
 * 验证码在这一步只是记下，到最后一步与新密码一起交给服务端，在同一个请求里
 * 验码、改密（为什么不拆开，见 /api/auth/recovery/reset）。码错了就退回填码那一步。
 */
export default function RecoveryClient({
  nonce,
  next,
  gallery,
}: {
  nonce?: string;
  next: string;
  gallery: GallerySong[];
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  /** 验证码在最后一步被判错，退回填码时显示 */
  const [codeError, setCodeError] = useState<string>();
  /** 每进一次填码步骤换一个 key：清空格子，重新开始倒数 */
  const [otpKey, setOtpKey] = useState(0);

  const sendCode = async (address: string, turnstileToken?: string) => {
    const result = await postAuth("/api/auth/recovery", {
      email: address,
      turnstileToken,
    });
    return result.ok ? null : (result.error ?? t("network"));
  };

  const finish = async (password: string) => {
    const result = await postAuth("/api/auth/recovery/reset", {
      email,
      otp: code,
      password,
    });
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setStep("done");
      setTimeout(() => router.replace(next), 1500);
      return null;
    }
    if (result.code === "otp_expired") {
      setCodeError(result.error);
      setOtpKey((k) => k + 1);
      setStep("otp");
      return null;
    }
    return result.error ?? t("network");
  };

  const heading = {
    email: t("recovery.title"),
    otp: t("otp.title"),
    password: t("recovery.passwordTitle"),
    done: t("recovery.done"),
  }[step];
  const subtitle = {
    email: t("recovery.subtitle"),
    otp: t("recovery.sent"),
    password: t("recovery.passwordSubtitle"),
    done: t("otp.redirecting"),
  }[step];

  return (
    <AuthShell
      gallery={gallery}
      heading={heading}
      subtitle={subtitle}
      email={step === "email" ? undefined : email}
    >
      {step === "email" && (
        <EmailStep
          nonce={nonce}
          defaultEmail={email}
          onSend={sendCode}
          onSent={(address) => {
            setEmail(address);
            setCodeError(undefined);
            setOtpKey((k) => k + 1);
            setStep("otp");
          }}
          loginHref={authPathFor("/login", next)}
        />
      )}

      {step === "otp" && (
        <OtpStep
          key={otpKey}
          onSubmit={async (value) => {
            setCode(value);
            setStep("password");
            return null;
          }}
          submitLabel={t("recovery.next")}
          onResend={(token) => sendCode(email, token)}
          resendCaptcha
          nonce={nonce}
          initialError={codeError}
          onRestart={() => setStep("email")}
        />
      )}

      {step === "password" && (
        <PasswordStep onSubmit={finish} onBack={() => setStep("otp")} />
      )}
    </AuthShell>
  );
}

function EmailStep({
  nonce,
  defaultEmail,
  onSend,
  onSent,
  loginHref,
}: {
  nonce?: string;
  defaultEmail: string;
  onSend: (email: string, turnstileToken: string) => Promise<string | null>;
  onSent: (email: string) => void;
  loginHref: string;
}) {
  const t = useTranslations("auth");
  const form = useForm<RecoveryEmailFormValues>({
    resolver: zodResolver(recoveryEmailFormSchema),
    defaultValues: { email: defaultEmail, turnstileToken: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;
  const captcha = useFormCaptcha(form);

  const submit = form.handleSubmit(async ({ email, turnstileToken }) => {
    form.clearErrors("root");
    const error = await onSend(email, turnstileToken);
    if (!error) {
      onSent(email);
      return;
    }
    captcha.reset();
    form.setError("root", { message: error });
  });

  const formError = errors.root?.message ?? errors.turnstileToken?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <FormField label={t("email")} error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          {...form.register("email")}
          className={cn(FIELD_CLASS, errors.email && FIELD_ERROR_CLASS)}
        />
      </FormField>

      <CaptchaField
        key={captcha.key}
        nonce={nonce}
        onToken={captcha.setToken}
        onError={() => form.setError("root", { message: t("captchaFailed") })}
      />

      <FormError message={formError} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 pt-2">
        <SubmitButton pending={isSubmitting} className="text-sm">
          {t("recovery.submit")}
        </SubmitButton>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t("recovery.rememberPrompt")}
          <Link href={loginHref} className={cn(PRIMARY_BUTTON_CLASS, "ml-1.5")}>
            {t("register.switchLink")}
          </Link>
        </p>
      </div>
    </form>
  );
}

function PasswordStep({
  onSubmit,
  onBack,
}: {
  onSubmit: (password: string) => Promise<string | null>;
  onBack: () => void;
}) {
  const t = useTranslations("auth");
  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ newPassword }) => {
    form.clearErrors("root");
    const error = await onSubmit(newPassword);
    if (error) form.setError("root", { message: error });
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <FormField
        label={t("recovery.newPassword")}
        error={errors.newPassword?.message}
      >
        <input
          type="password"
          autoComplete="new-password"
          autoFocus
          placeholder={t("register.passwordPlaceholder")}
          {...form.register("newPassword")}
          className={cn(FIELD_CLASS, errors.newPassword && FIELD_ERROR_CLASS)}
        />
      </FormField>
      <FormField
        label={t("recovery.confirmPassword")}
        error={errors.confirmPassword?.message}
      >
        <input
          type="password"
          autoComplete="new-password"
          {...form.register("confirmPassword")}
          className={cn(
            FIELD_CLASS,
            errors.confirmPassword && FIELD_ERROR_CLASS,
          )}
        />
      </FormField>

      <FormError message={errors.root?.message} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 pt-2">
        <SubmitButton pending={isSubmitting} className="text-sm">
          {t("recovery.finish")}
        </SubmitButton>
        <button type="button" onClick={onBack} className={TEXT_BUTTON_CLASS}>
          {t("recovery.back")}
        </button>
      </div>
    </form>
  );
}
