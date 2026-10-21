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
import type { GallerySong } from "@/lib/auth-gallery";
import {
  createAuthFormSchema,
  createAuthFormValues,
  type AuthFormValues,
} from "@/lib/forms/auth-form";
import { authPathFor } from "@/lib/utils/safe-next";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

type Step = "credentials" | "otp" | "verified";

interface AuthClientProps {
  nonce?: string;
  mode: "login" | "register";
  /** 登录、注册后跳回的站内路径，已在服务端校验 */
  next: string;
  gallery: GallerySong[];
}

/**
 * 登录与注册。注册多一步邮箱验证码；注册后没填验证码就走了的账号，
 * 登录时也转到这一步（服务端已顺手重发了一封）。
 */
export default function AuthClient({
  nonce,
  mode,
  next,
  gallery,
}: AuthClientProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("credentials");
  /** 为什么要填验证码：刚注册，还是登录时发现邮箱没验证过 */
  const [unconfirmed, setUnconfirmed] = useState(false);

  const isLogin = mode === "login";
  const authSchema = useMemo(() => createAuthFormSchema(mode), [mode]);
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema) as Resolver<AuthFormValues>,
    defaultValues: createAuthFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;
  // 填验证码时用的是第一步提交过的邮箱；第一步之后表单不再变
  const email = form.getValues("email");

  const captcha = useFormCaptcha(form);

  const signedIn = async () => {
    // 顶栏的用户状态缓存了「未登录」，不刷掉的话跳过去还显示访客
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    const result = await postAuth(
      isLogin ? "/api/auth/login" : "/api/auth/register",
      values,
    );

    if (result.ok) {
      if (isLogin) {
        await signedIn();
        router.replace(next);
        return;
      }
      setUnconfirmed(false);
      setStep("otp");
      return;
    }

    captcha.reset();
    if (result.code === "email_not_confirmed") {
      setUnconfirmed(true);
      setStep("otp");
      return;
    }
    form.setError("root", {
      message:
        result.error ??
        (result.status === 0
          ? t("network")
          : t(isLogin ? "login.failed" : "register.failed")),
    });
  });

  const verify = async (otp: string) => {
    const result = await postAuth("/api/auth/verify-otp", { email, otp });
    if (!result.ok) return result.error ?? t("otp.failed");
    await signedIn();
    setStep("verified");
    setTimeout(() => router.replace(next), 1500);
  };

  const resend = async (turnstileToken?: string) => {
    const result = await postAuth("/api/auth/resend", {
      email,
      turnstileToken,
    });
    return result.ok ? null : (result.error ?? t("network"));
  };

  // 回到第一步重填
  const restart = () => {
    setStep("credentials");
    form.clearErrors("root");
    captcha.reset();
  };

  const heading =
    step === "otp"
      ? t("otp.title")
      : step === "verified"
        ? t("otp.verified")
        : t(isLogin ? "login.title" : "register.title");
  const subtitle =
    step === "otp"
      ? t(unconfirmed ? "otp.unconfirmed" : "otp.sent")
      : step === "verified"
        ? t("otp.redirecting")
        : t(isLogin ? "login.subtitle" : "register.subtitle");
  const formError = errors.root?.message ?? errors.turnstileToken?.message;

  return (
    <AuthShell
      gallery={gallery}
      heading={heading}
      subtitle={subtitle}
      email={step === "credentials" ? undefined : email}
    >
      {step === "credentials" && (
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

          <FormField
            label={t("password")}
            error={errors.password?.message}
            aside={
              isLogin && (
                <Link
                  href={authPathFor("/forgot-password", next)}
                  className={TEXT_BUTTON_CLASS}
                >
                  {t("login.forgot")}
                </Link>
              )
            }
          >
            <input
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={
                isLogin ? undefined : t("register.passwordPlaceholder")
              }
              {...form.register("password")}
              className={cn(FIELD_CLASS, errors.password && FIELD_ERROR_CLASS)}
            />
          </FormField>

          <CaptchaField
            key={captcha.key}
            nonce={nonce}
            onToken={captcha.setToken}
            onError={() =>
              form.setError("root", { message: t("captchaFailed") })
            }
          />

          <FormError message={formError} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 pt-2">
            <SubmitButton pending={isSubmitting} className="text-sm">
              {t(isLogin ? "login.submit" : "register.submit")}
            </SubmitButton>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t(isLogin ? "login.switchPrompt" : "register.switchPrompt")}
              <Link
                href={authPathFor(isLogin ? "/register" : "/login", next)}
                className={cn(PRIMARY_BUTTON_CLASS, "ml-1.5")}
              >
                {t(isLogin ? "login.switchLink" : "register.switchLink")}
              </Link>
            </p>
          </div>
        </form>
      )}

      {step === "otp" && (
        <OtpStep
          onSubmit={verify}
          submitLabel={t("otp.submit")}
          onResend={resend}
          resendCaptcha
          nonce={nonce}
          onRestart={restart}
        >
          {/* 已注册的邮箱再注册，GoTrue 不报错也不发信，只能在这里提醒一句 */}
          {!unconfirmed && (
            <p>
              {t("otp.registered")}
              <Link
                href={authPathFor("/login", next)}
                className={cn(PRIMARY_BUTTON_CLASS, "ml-1.5")}
              >
                {t("otp.toLogin")}
              </Link>
              <span aria-hidden className="ml-1.5">
                ·
              </span>
              <Link
                href={authPathFor("/forgot-password", next)}
                className={cn(PRIMARY_BUTTON_CLASS, "ml-1.5")}
              >
                {t("otp.toRecovery")}
              </Link>
            </p>
          )}
        </OtpStep>
      )}
    </AuthShell>
  );
}
