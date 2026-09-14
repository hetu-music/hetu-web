"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import { getCsrfToken } from "@/lib/api/csrf";
import {
  createAuthFormSchema,
  createAuthFormValues,
  createOtpFormValues,
  otpFormSchema,
  type AuthFormValues,
  type OtpFormValues,
} from "@/lib/forms/auth-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

interface AuthClientProps {
  nonce?: string;
  mode: "login" | "register";
}

export default function AuthClient({ nonce, mode }: AuthClientProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/";

    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/";
  });
  const [turnstileInstanceKey, setTurnstileInstanceKey] = useState(0);
  const router = useRouter();
  const queryClient = useQueryClient();

  const isLogin = mode === "login";
  const authSchema = useMemo(() => createAuthFormSchema(mode), [mode]);
  const authForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema) as Resolver<AuthFormValues>,
    defaultValues: createAuthFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpFormSchema) as Resolver<OtpFormValues>,
    defaultValues: createOtpFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const otpValues = useWatch({
    control: otpForm.control,
    name: "otp",
  });
  const verifying = otpForm.formState.isSubmitting;

  const submitAuth = authForm.handleSubmit(async (values) => {
    authForm.clearErrors("root");

    try {
      const csrfToken = await getCsrfToken();

      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(values),
        cache: "no-store",
      });

      const result = await res.json();
      if (!res.ok) {
        authForm.setError("root", {
          message:
            result.error ||
            (isLogin ? "登录失败，请检查邮箱或密码" : "注册失败，请稍后重试"),
        });
        return;
      }

      if (isLogin) {
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        router.replace(nextPath || "/admin");
        return;
      }

      setOtpSent(true);
      otpForm.reset(createOtpFormValues());
    } catch (err: unknown) {
      authForm.setError("root", {
        message:
          err instanceof Error ? err.message : "网络连接异常，请稍后重试",
      });
    }
  });

  const handleVerifyOtp = useCallback(
    async ({ otp }: OtpFormValues) => {
      otpForm.clearErrors("root");

      try {
        const csrfToken = await getCsrfToken();

        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            email: authForm.getValues("email"),
            otp: otp.join(""),
          }),
          cache: "no-store",
        });

        const result = await res.json();
        if (!res.ok) {
          otpForm.setError("root", {
            message: result.error || "验证失败，请重试",
          });
          return;
        }

        setVerified(true);
        setTimeout(() => {
          router.replace(nextPath || "/");
        }, 1500);
      } catch (err: unknown) {
        otpForm.setError("root", {
          message:
            err instanceof Error ? err.message : "网络连接异常，请稍后重试",
        });
      }
    },
    [authForm, nextPath, otpForm, router],
  );
  const submitOtp = otpForm.handleSubmit(handleVerifyOtp);

  useEffect(() => {
    if (!otpSent || verified) return;

    const timeoutId = window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('input[data-otp-index="0"]')
        ?.focus();
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [otpSent, verified]);

  useEffect(() => {
    if (
      otpSent &&
      otpValues?.length === 6 &&
      otpValues.every((value) => /^\d$/.test(value)) &&
      !verifying &&
      !verified
    ) {
      void submitOtp();
    }
  }, [otpSent, otpValues, submitOtp, verified, verifying]);

  const handleOtpChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = Number(e.currentTarget.dataset.otpIndex);
      const value = e.currentTarget.value;

      if (value && !/^\d$/.test(value)) return;

      otpForm.setValue(`otp.${index}`, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: value.length === 1,
      });

      if (value && index < 5) {
        const nextInput =
          e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
            `input[data-otp-index="${index + 1}"]`,
          );
        nextInput?.focus();
      }
    },
    [otpForm],
  );

  const handleOtpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const index = Number(e.currentTarget.dataset.otpIndex);

      if (
        e.key === "Backspace" &&
        !otpForm.getValues(`otp.${index}`) &&
        index > 0
      ) {
        const prevInput =
          e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
            `input[data-otp-index="${index - 1}"]`,
          );
        prevInput?.focus();
      }
    },
    [otpForm],
  );

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");
      if (pastedData.length === 6) {
        const nextValues = pastedData.split("");
        otpForm.setValue("otp", nextValues, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        e.currentTarget
          .querySelector<HTMLInputElement>('input[data-otp-index="5"]')
          ?.focus();
      }
    },
    [otpForm],
  );

  const handleResetFlow = () => {
    setOtpSent(false);
    setVerified(false);
    otpForm.reset(createOtpFormValues());
    otpForm.clearErrors();
    authForm.setValue("turnstileToken", "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    authForm.clearErrors("root");
    setTurnstileInstanceKey((current) => current + 1);
  };

  const renderOtpView = () => {
    if (verified) {
      return (
        <div className="px-8 pb-12 space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <CheckCircle2
              size={40}
              className="text-emerald-500"
              strokeWidth={1.5}
            />
            <div className="space-y-1">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                验证成功
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                正在为您跳转...
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-8 pb-12 space-y-8">
        <div className="text-center">
          <div className="space-y-3">
            <p className="text-sm font-light text-slate-500 dark:text-slate-400">
              我们已向以下邮箱发送了 6 位验证码
            </p>
            <div className="inline-flex items-center rounded-full border border-blue-100/50 bg-blue-50 px-4 py-1.5 text-sm font-medium tracking-wide text-blue-600 dark:border-blue-800/30 dark:bg-blue-900/10 dark:text-blue-400">
              {authForm.getValues("email")}
            </div>
          </div>
        </div>

        <form onSubmit={submitOtp} className="space-y-8">
          <div
            className="flex justify-center gap-2 sm:gap-3"
            onPaste={handleOtpPaste}
          >
            {otpValues.map((value, index) => (
              <input
                key={index}
                data-otp-index={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={value}
                onChange={handleOtpChange}
                onKeyDown={handleOtpKeyDown}
                className="h-13 w-11 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-xl font-semibold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:h-14 sm:w-12"
                disabled={verifying}
              />
            ))}
          </div>

          {(otpForm.formState.errors.otp?.message ||
            otpForm.formState.errors.root?.message) && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-relaxed text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>
                {otpForm.formState.errors.root?.message ??
                  otpForm.formState.errors.otp?.message}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || otpValues.some((v) => v === "")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/30 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {verifying ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span>验证并登录</span>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-4 pt-8">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            没收到邮件或邮箱填写错误？
          </p>
          <button
            type="button"
            onClick={handleResetFlow}
            className="group inline-flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-6 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-blue-900/30 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            <ArrowLeft
              size={14}
              className="transition-transform group-hover:-translate-x-0.5"
            />
            <span>重新填写</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAFAFA] p-4 transition-colors duration-500 dark:bg-[#0B0F19]">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/50">
          <div className="absolute right-4 top-4 z-10">
            <ThemeToggle />
          </div>

          <div className="space-y-4 px-8 pb-8 pt-12 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800">
              <ShieldCheck size={32} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white">
              {otpSent
                ? "邮箱验证"
                : isLogin
                  ? "Welcome Back"
                  : "Create Account"}
            </h1>
            {!otpSent && (
              <p className="text-sm font-light text-slate-500 dark:text-slate-400">
                {isLogin
                  ? "请输入邮箱和密码登录"
                  : "请设置您的邮箱和密码进行注册"}
              </p>
            )}
          </div>

          {!isLogin && otpSent ? (
            renderOtpView()
          ) : (
            <form onSubmit={submitAuth} className="space-y-6 px-8 pb-12">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Email
                  </label>
                  <div className="group relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      {...authForm.register("email")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  {authForm.formState.errors.email && (
                    <p className="ml-1 text-xs text-red-500">
                      {authForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Password
                  </label>
                  <div className="group relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      placeholder={
                        isLogin ? "••••••••" : "至少8位，包含字母和数字"
                      }
                      {...authForm.register("password")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  {authForm.formState.errors.password && (
                    <p className="ml-1 text-xs text-red-500">
                      {authForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Turnstile
                  key={turnstileInstanceKey}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                  onSuccess={(token) => {
                    authForm.setValue("turnstileToken", token, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  onError={() =>
                    authForm.setError("root", {
                      message: "Captcha failed to load",
                    })
                  }
                  onExpire={() => {
                    authForm.setValue("turnstileToken", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  scriptOptions={{ nonce }}
                  options={{ theme: "auto", size: "flexible" }}
                  className="w-full"
                />
              </div>

              {(authForm.formState.errors.turnstileToken?.message ||
                authForm.formState.errors.root?.message) && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-relaxed text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    {authForm.formState.errors.root?.message ??
                      authForm.formState.errors.turnstileToken?.message}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={authForm.formState.isSubmitting}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/30 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {authForm.formState.isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <span>{isLogin ? "登录" : "注册"}</span>
                    {isLogin ? (
                      <LogIn
                        size={16}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    ) : (
                      <UserPlus
                        size={16}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    )}
                  </>
                )}
              </button>

              <div className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {isLogin ? (
                  <p>
                    还没有账号？{" "}
                    <Link
                      href={
                        "/register" +
                        (nextPath !== "/"
                          ? "?next=" + encodeURIComponent(nextPath)
                          : "")
                      }
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      立即注册
                    </Link>
                  </p>
                ) : (
                  <p>
                    已有账号？{" "}
                    <Link
                      href={
                        "/login" +
                        (nextPath !== "/"
                          ? "?next=" + encodeURIComponent(nextPath)
                          : "")
                      }
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      返回登录
                    </Link>
                  </p>
                )}
              </div>
            </form>
          )}

          <div className="border-t border-slate-100 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft size={16} />
              <span>返回主页</span>
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="font-mono text-xs text-slate-400 dark:text-slate-600">
            &copy; {new Date().getFullYear()} 河图作品勘鉴
          </p>
        </div>
      </div>
    </div>
  );
}
