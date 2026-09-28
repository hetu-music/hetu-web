"use client";

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
import React, { useCallback, useEffect, useRef } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

/** 注册第二步：六位邮箱验证码，每位一道底线；填满即自动提交 */
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
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

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
    const id = window.setTimeout(() => inputsRef.current[0]?.focus(), 100);
    return () => window.clearTimeout(id);
  }, []);

  // 六位填满就提交，不必再点按钮。同一组数字只自动提交一次：
  // 验证码错了，改动其中一位后才会再提交，不会拿错码反复请求
  const complete = digits.every((d) => /^\d$/.test(d));
  const code = digits.join("");
  const autoSubmittedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!complete || verifying || autoSubmittedRef.current === code) return;
    autoSubmittedRef.current = code;
    void submit();
  }, [complete, code, verifying, submit]);

  const setDigit = (index: number, value: string) =>
    form.setValue(`otp.${index}`, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: value.length === 1,
    });

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    setDigit(index, value);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !form.getValues(`otp.${index}`) && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pasted.length !== 6) return;
    e.preventDefault();
    form.setValue("otp", pasted.split(""), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    inputsRef.current[5]?.focus();
  };

  const error = errors.root?.message ?? errors.otp?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-10">
      <div className="flex gap-3 sm:gap-4" onPaste={handlePaste}>
        {digits.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={value}
            onChange={(e) => handleChange(index, e.currentTarget.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={verifying}
            aria-label={t("digit", { n: index + 1 })}
            className="w-10 sm:w-11 pb-1.5 bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 focus:border-(--tone) focus:outline-none text-center font-serif text-3xl tabular-nums text-slate-900 dark:text-slate-50 transition-colors disabled:opacity-50"
          />
        ))}
      </div>

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
