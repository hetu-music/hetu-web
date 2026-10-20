"use client";

import AuthShell, { AUTH_LINK_CLASS } from "@/components/auth/AuthShell";
import CaptchaField from "@/components/auth/CaptchaField";
import OtpStep from "@/components/auth/OtpStep";
import FormField from "@/components/shared/FormField";
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
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
  const [captchaKey, setCaptchaKey] = useState(0);

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

  // 登录、注册、找回密码互相切换时带上 next，完事后仍回到原来的页面
  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  const setTurnstileToken = (token: string) =>
    form.setValue("turnstileToken", token, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

  // 人机验证的令牌只能用一次：提交过就要重新挂一个
  const resetCaptcha = () => {
    setTurnstileToken("");
    setCaptchaKey((k) => k + 1);
  };

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

    resetCaptcha();
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
    resetCaptcha();
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
                  href={`/forgot-password${nextQuery}`}
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
            key={captchaKey}
            nonce={nonce}
            onToken={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() =>
              form.setError("root", { message: t("captchaFailed") })
            }
          />

          {formError && (
            <p
              role="alert"
              className="text-sm text-rose-500 dark:text-rose-400"
            >
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(PRIMARY_BUTTON_CLASS, "text-sm")}
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {t(isLogin ? "login.submit" : "register.submit")}
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t(isLogin ? "login.switchPrompt" : "register.switchPrompt")}
              <Link
                href={(isLogin ? "/register" : "/login") + nextQuery}
                className={AUTH_LINK_CLASS}
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
        >
          <p>
            {t("otp.wrongEmail")}
            <button
              type="button"
              onClick={restart}
              className={cn(
                TEXT_BUTTON_CLASS,
                "ml-1.5 text-slate-600 dark:text-slate-300",
              )}
            >
              {t("otp.reset")}
            </button>
          </p>
          {/* 已注册的邮箱再注册，GoTrue 不报错也不发信，只能在这里提醒一句 */}
          {!unconfirmed && (
            <p>
              {t("otp.registered")}
              <Link href={`/login${nextQuery}`} className={AUTH_LINK_CLASS}>
                {t("otp.toLogin")}
              </Link>
              <span aria-hidden className="ml-1.5">
                ·
              </span>
              <Link
                href={`/forgot-password${nextQuery}`}
                className={AUTH_LINK_CLASS}
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
