"use client";

import { useMounted } from "@/hooks/ui/useMounted";
import { cn } from "@/lib/utils/utils";
import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";

/**
 * 人机验证。是第三方小窗，改不了样式；主题跟随站点而不是系统。
 * 站点主题只在浏览器里读得到，挂载后再渲染，否则水合不一致。
 *
 * 令牌只能用一次：要重新验证时由调用方换一个 key 重新挂载。
 * appearance="interaction-only" 用在「重新发送」上：多数时候看不见，
 * 只有 Cloudflare 判断需要点一下时才弹出来，所以也不必预留高度。
 */
export default function CaptchaField({
  nonce,
  onToken,
  onExpire,
  onError,
  appearance = "always",
}: {
  nonce?: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
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
          onExpire={onExpire}
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
