"use client";

import OtpStep from "@/components/auth/OtpStep";
import {
  FIELD_CLASS,
  FIELD_ERROR_CLASS,
  FIELD_LABEL_CLASS,
} from "@/components/shared/form-field";
import PageTopBar from "@/components/shared/PageTopBar";
import { PRIMARY_BUTTON_CLASS } from "@/components/shared/text-button";
import { Link, useRouter } from "@/i18n/navigation";
import { getCsrfToken } from "@/lib/api/csrf";
import {
  createAuthFormSchema,
  createAuthFormValues,
  type AuthFormValues,
} from "@/lib/forms/auth-form";
import { cn } from "@/lib/utils/utils";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";

type Step = "credentials" | "otp" | "verified";

interface AuthClientProps {
  nonce?: string;
  mode: "login" | "register";
  /** 登录、注册后跳回的站内路径，已在服务端校验 */
  next: string;
}

/**
 * 登录与注册：宽屏左栏卷首（站名、题名、一句说明），右栏表单。
 * 注册多一步邮箱验证码；输入框只有一道底线，按钮都是文字按钮。
 */
export default function AuthClient({ nonce, mode, next }: AuthClientProps) {
  const t = useTranslations("auth");
  const tSite = useTranslations("common.site");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [step, setStep] = useState<Step>("credentials");
  const [turnstileInstanceKey, setTurnstileInstanceKey] = useState(0);

  const isLogin = mode === "login";
  const authSchema = useMemo(() => createAuthFormSchema(mode), [mode]);
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema) as Resolver<AuthFormValues>,
    defaultValues: createAuthFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;

  // 登录与注册互相切换时带上 next，登录后仍回到原来的页面
  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(
        isLogin ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify(values),
          cache: "no-store",
        },
      );
      const result = await res.json();
      if (!res.ok) {
        form.setError("root", {
          message:
            result.error || t(isLogin ? "login.failed" : "register.failed"),
        });
        return;
      }

      if (isLogin) {
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        router.replace(next);
        return;
      }
      setStep("otp");
    } catch (err: unknown) {
      form.setError("root", {
        message: err instanceof Error ? err.message : t("network"),
      });
    }
  });

  const setTurnstileToken = (token: string) =>
    form.setValue("turnstileToken", token, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

  // 回到第一步重填：人机验证的令牌只能用一次，要重新挂一个
  const restart = () => {
    setStep("credentials");
    setTurnstileToken("");
    form.clearErrors("root");
    setTurnstileInstanceKey((k) => k + 1);
  };

  const email = form.getValues("email");
  const heading =
    step === "otp"
      ? t("otp.title")
      : step === "verified"
        ? t("otp.verified")
        : t(isLogin ? "login.title" : "register.title");
  const subtitle =
    step === "otp"
      ? t("otp.sent")
      : step === "verified"
        ? t("otp.redirecting")
        : t(isLogin ? "login.subtitle" : "register.subtitle");
  const formError = errors.root?.message ?? errors.turnstileToken?.message;

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": INK_TONE.light,
          "--tone-dark": INK_TONE.dark,
        } as React.CSSProperties
      }
    >
      <PageTopBar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-32 md:pt-40 pb-16 grid gap-12 content-start lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* 卷首 */}
        <header className="min-w-0">
          <p className="text-xs tracking-[0.35em] text-(--tone) mb-5">
            {tSite("name")}
          </p>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50">
            {heading}
          </h1>
          <p className="mt-6 font-kaiti text-[15px] leading-[2.05] text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
          {step !== "credentials" && (
            <p className="mt-1 font-serif text-base text-slate-900 dark:text-slate-100 wrap-break-word">
              {email}
            </p>
          )}
        </header>

        <div className="min-w-0 max-w-[26rem] lg:pt-2">
          {step === "credentials" && (
            <form onSubmit={submit} noValidate className="space-y-8">
              <label className="block">
                <span className={FIELD_LABEL_CLASS}>{t("email")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  {...form.register("email")}
                  className={cn(
                    FIELD_CLASS,
                    "mt-2",
                    errors.email && FIELD_ERROR_CLASS,
                  )}
                />
                {errors.email && (
                  <span className="mt-1.5 block text-xs text-rose-500">
                    {errors.email.message}
                  </span>
                )}
              </label>

              <label className="block">
                <span className={FIELD_LABEL_CLASS}>{t("password")}</span>
                <input
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder={
                    isLogin ? undefined : t("register.passwordPlaceholder")
                  }
                  {...form.register("password")}
                  className={cn(
                    FIELD_CLASS,
                    "mt-2",
                    errors.password && FIELD_ERROR_CLASS,
                  )}
                />
                {errors.password && (
                  <span className="mt-1.5 block text-xs text-rose-500">
                    {errors.password.message}
                  </span>
                )}
              </label>

              {/* 人机验证是第三方小窗，改不了样式；主题跟随站点而不是系统。
                  resolvedTheme 挂载后才有值，等它就绪再挂，免得换主题时令牌被重置 */}
              <div className="min-h-[65px]">
                {resolvedTheme && (
                  <Turnstile
                    key={turnstileInstanceKey}
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                    onSuccess={setTurnstileToken}
                    onError={() =>
                      form.setError("root", { message: t("captchaFailed") })
                    }
                    onExpire={() => setTurnstileToken("")}
                    scriptOptions={{ nonce }}
                    options={{
                      theme: resolvedTheme === "dark" ? "dark" : "light",
                      size: "flexible",
                    }}
                    className="w-full"
                  />
                )}
              </div>

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
                  {isSubmitting && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {t(isLogin ? "login.submit" : "register.submit")}
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t(isLogin ? "login.switchPrompt" : "register.switchPrompt")}
                  <Link
                    href={(isLogin ? "/register" : "/login") + nextQuery}
                    className="ml-1.5 tracking-widest text-(--tone) hover:opacity-75 transition-opacity"
                  >
                    {t(isLogin ? "login.switchLink" : "register.switchLink")}
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === "otp" && (
            <OtpStep
              email={email}
              onVerified={() => {
                setStep("verified");
                setTimeout(() => router.replace(next), 1500);
              }}
              onRestart={restart}
            />
          )}
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 pb-10">
        <p className="text-xs tracking-[0.2em] text-slate-400 dark:text-slate-600">
          {t("copyright", {
            year: new Date().getFullYear(),
            name: tSite("name"),
          })}
        </p>
      </footer>
    </div>
  );
}
