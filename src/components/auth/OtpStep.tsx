"use client";

import { OTPField } from "@base-ui/react/otp-field";
import CaptchaField from "@/components/auth/CaptchaField";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import {
  createOtpFormValues,
  otpFormSchema,
  type OtpFormValues,
} from "@/lib/forms/auth-form";
import { cn } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";

const OTP_LENGTH = 6;
/** 与 GoTrue 同一邮箱两封信的最短间隔（SMTP_MAX_FREQUENCY 默认 60 秒）一致 */
const RESEND_COOLDOWN = 60;

/** 返回要显示的错误提示；成功时返回空 */
type Action = () => Promise<string | null | undefined>;

/**
 * 填邮箱验证码的一步：注册、找回密码、改邮箱共用。
 * 六位，每位一道底线；填满即自动提交。格子之间的跳转、退格、粘贴整串、
 * 只收数字、one-time-code 自动填充都交给 Base UI 的 OTPField。
 *
 * 「重新发送」：进来时信刚发出，先倒数一分钟再让点。未登录的流程重发前要过
 * 人机验证（resendCaptcha），否则这个按钮能被拿去给任意邮箱刷信。
 */
export default function OtpStep({
  onSubmit,
  submitLabel,
  onResend,
  resendCaptcha = false,
  nonce,
  initialError,
  children,
}: {
  onSubmit: (code: string) => ReturnType<Action>;
  submitLabel: string;
  onResend?: (captchaToken?: string) => ReturnType<Action>;
  resendCaptcha?: boolean;
  nonce?: string;
  /** 进来时就要显示的错误，如找回密码时验证码在最后一步才被判错、退回这里 */
  initialError?: string;
  /** 按钮下方的小字提示行，如「邮箱填错了？重新填写」 */
  children?: ReactNode;
}) {
  const t = useTranslations("auth.otp");
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

  useEffect(() => {
    if (initialError) form.setError("root", { message: initialError });
  }, [form, initialError]);

  const submit = form.handleSubmit(async ({ otp }) => {
    form.clearErrors("root");
    const error = await onSubmit(otp.join(""));
    if (error) form.setError("root", { message: error });
  });

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
        {submitLabel}
      </button>

      {(onResend || children) && (
        <div className="space-y-2 pt-6 text-xs text-slate-400 dark:text-slate-500">
          {onResend && (
            <ResendLine
              onResend={onResend}
              captcha={resendCaptcha}
              nonce={nonce}
            />
          )}
          {children}
        </div>
      )}
    </form>
  );
}

type ResendPhase = "idle" | "captcha" | "sending";

function ResendLine({
  onResend,
  captcha,
  nonce,
}: {
  onResend: (captchaToken?: string) => ReturnType<Action>;
  captcha: boolean;
  nonce?: string;
}) {
  const t = useTranslations("auth.otp");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [phase, setPhase] = useState<ResendPhase>("idle");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = async (captchaToken?: string) => {
    setPhase("sending");
    setResult(null);
    const error = await onResend(captchaToken);
    setPhase("idle");
    if (error) {
      setResult({ ok: false, text: error });
    } else {
      setResult({ ok: true, text: t("resent") });
      setCooldown(RESEND_COOLDOWN);
    }
  };

  const start = () => {
    if (captcha) {
      setResult(null);
      setPhase("captcha");
    } else {
      void send();
    }
  };

  return (
    <>
      <p>
        {t("resendPrompt")}
        <button
          type="button"
          onClick={start}
          disabled={cooldown > 0 || phase !== "idle"}
          className={cn(
            TEXT_BUTTON_CLASS,
            "ml-1.5 inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300",
          )}
        >
          {phase !== "idle" && <Loader2 size={12} className="animate-spin" />}
          {cooldown > 0 ? t("resendIn", { s: cooldown }) : t("resend")}
        </button>
        {result && (
          <span
            role="status"
            className={cn(
              "ml-3",
              result.ok ? "text-(--tone)" : "text-rose-500 dark:text-rose-400",
            )}
          >
            {result.text}
          </span>
        )}
      </p>
      {phase === "captcha" && (
        <CaptchaField
          nonce={nonce}
          appearance="interaction-only"
          onToken={(token) => void send(token)}
          onError={() => {
            setPhase("idle");
            setResult({ ok: false, text: t("captchaFailed") });
          }}
        />
      )}
    </>
  );
}
