"use client";

import { useMounted } from "@/hooks/ui/useMounted";
import { cn } from "@/lib/utils/utils";
import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";
import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

/**
 * 人机验证。是第三方小窗，改不了样式；主题跟随站点而不是系统。
 * 站点主题只在浏览器里读得到，挂载后再渲染，否则水合不一致。
 *
 * 令牌过期时按「没有令牌」交给 onToken("")。
 * appearance="interaction-only" 用在「重新发送」上：多数时候看不见，
 * 只有 Cloudflare 判断需要点一下时才弹出来，所以也不必预留高度。
 */
export default function CaptchaField({
  nonce,
  onToken,
  onError,
  appearance = "always",
}: {
  nonce?: string;
  onToken: (token: string) => void;
  onError: () => void;
  appearance?: "always" | "interaction-only";
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div className={cn(appearance === "always" && "min-h-16.25")}>
      {mounted && (
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
          onSuccess={onToken}
          onError={onError}
          onExpire={() => onToken("")}
          scriptOptions={{ nonce }}
          options={{
            theme: resolvedTheme === "dark" ? "dark" : "light",
            size: "flexible",
            appearance,
          }}
          className="w-full"
        />
      )}
    </div>
  );
}

type WithCaptcha = { turnstileToken: string };

/**
 * 把人机验证的令牌接进表单的 turnstileToken 字段。
 * 令牌只能用一次：提交失败、回到上一步时调 reset()，换一个 key 让小窗重新挂载。
 *
 *   const captcha = useFormCaptcha(form);
 *   <CaptchaField key={captcha.key} onToken={captcha.setToken} … />
 */
export function useFormCaptcha<T extends WithCaptcha>(form: UseFormReturn<T>) {
  const [key, setKey] = useState(0);
  // react-hook-form 的字段路径类型推不过泛型，这里收窄成只有这一个字段的表单
  const { setValue } = form as unknown as UseFormReturn<WithCaptcha>;

  const setToken = useCallback(
    (token: string) =>
      setValue("turnstileToken", token, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      }),
    [setValue],
  );

  const reset = useCallback(() => {
    setToken("");
    setKey((k) => k + 1);
  }, [setToken]);

  return { key, setToken, reset };
}
