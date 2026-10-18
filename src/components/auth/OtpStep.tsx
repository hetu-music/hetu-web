"use client";

import { OTPField } from "@base-ui/react/otp-field";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { getCsrfToken } from "@/lib/api/csrf";
import {
  createOtpFormValues,
  otpFormSchema,
  type OtpFormValues,
} from "@/lib/forms/auth-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

const OTP_LENGTH = 6;

/**
 * 注册第二步：六位邮箱验证码，每位一道底线；填满即自动提交。
 * 格子之间的跳转、退格、粘贴整串、只收数字、one-time-code 自动填充都交给 Base UI 的 OTPField。
 */
export default function OtpStep({
  email,
  onVerified,
  onRestart,
}: {
  email: string;
  onVerified: () => void;
  /** 没收到邮件或邮箱填错：回到第一步 */
  onRestart: () => void;
}) {
  const t = useTranslations("auth.otp");
  const tAuth = useTranslations("auth");
  const firstInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpFormSchema) as Resolver<OtpFormValues>,
    defaultValues: createOtpFormValues(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const digits = useWatch({ control: form.control, name: "otp" });
  const verifying = form.formState.isSubmitting;
  const { errors } = form.formState;

  const verify = useCallback(
    async ({ otp }: OtpFormValues) => {
      form.clearErrors("root");
      try {
        const csrfToken = await getCsrfToken();
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ email, otp: otp.join("") }),
          cache: "no-store",
        });
        const result = await res.json();
        if (!res.ok) {
          form.setError("root", { message: result.error || t("failed") });
          return;
        }
        onVerified();
      } catch (err: unknown) {
        form.setError("root", {
          message: err instanceof Error ? err.message : tAuth("network"),
        });
      }
    },
    [email, form, onVerified, t, tAuth],
  );
  const submit = form.handleSubmit(verify);

  useEffect(() => {
    const id = window.setTimeout(() => firstInputRef.current?.focus(), 100);
    return () => window.clearTimeout(id);
  }, []);

  const code = digits.join("");
  const complete = code.length === OTP_LENGTH;

  // 表单里仍按六位数组存，与校验规则一致
  const setCode = (value: string) =>
    form.setValue(
      "otp",
      Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? ""),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: value.length === OTP_LENGTH,
      },
    );

  // 六位填满就提交，不必再点按钮。同一组数字只自动提交一次：
  // 验证码错了，改动其中一位后才会再提交；再粘贴一遍同样的错码也不会重复请求
  const autoSubmittedRef = useRef<string | null>(null);
  const handleComplete = (value: string) => {
    if (verifying || autoSubmittedRef.current === value) return;
    autoSubmittedRef.current = value;
    setCode(value);
    void submit();
  };

  const error = errors.root?.message ?? errors.otp?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-10">
      <OTPField.Root
        length={OTP_LENGTH}
        value={code}
        onValueChange={setCode}
        onValueComplete={handleComplete}
        disabled={verifying}
        className="flex gap-3 sm:gap-4"
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <OTPField.Input
            key={index}
            ref={index === 0 ? firstInputRef : undefined}
            aria-label={t("digit", { n: index + 1 })}
            className="w-10 sm:w-11 pb-1.5 bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 focus:border-(--tone) focus:outline-none text-center font-serif text-3xl tabular-nums text-slate-900 dark:text-slate-50 transition-colors disabled:opacity-50"
          />
        ))}
      </OTPField.Root>

      {error && (
        <p role="alert" className="text-sm text-rose-500 dark:text-rose-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={verifying || !complete}
        className={cn(PRIMARY_BUTTON_CLASS, "text-sm")}
      >
        {verifying && <Loader2 size={14} className="animate-spin" />}
        {t("submit")}
      </button>

      <p className="pt-6 text-xs text-slate-400 dark:text-slate-500">
        {t("resendPrompt")}
        <button
          type="button"
          onClick={onRestart}
          className={cn(
            TEXT_BUTTON_CLASS,
            "ml-1.5 text-slate-600 dark:text-slate-300",
          )}
        >
          {t("reset")}
        </button>
      </p>
    </form>
  );
}
