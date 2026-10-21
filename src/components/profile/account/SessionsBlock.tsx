"use client";

import { AccountBlock } from "@/components/profile/account/account-ui";
import { TEXT_BUTTON_CLASS } from "@/components/shared/text-button";
import { addToast } from "@/components/ui/toast";
import { useTwoStepConfirm } from "@/hooks/ui";
import { postAuth } from "@/lib/api/auth-api";
import { cn } from "@/lib/utils/utils";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** 登录设备：一键退出其他设备上的登录，当前设备保留 */
export default function SessionsBlock() {
  const t = useTranslations("profile.account.sessions");
  const confirm = useTwoStepConfirm();
  const [pending, setPending] = useState(false);

  const signOutOthers = async () => {
    if (!confirm.request()) return;
    setPending(true);
    const result = await postAuth("/api/auth/logout", { scope: "others" });
    setPending(false);
    if (result.ok) addToast("success", t("done"));
    else addToast("error", result.error ?? t("error"));
  };

  return (
    <AccountBlock title={t("title")} description={t("description")}>
      <button
        type="button"
        onClick={signOutOthers}
        disabled={pending}
        className={cn(
          TEXT_BUTTON_CLASS,
          "inline-flex items-center gap-1.5",
          confirm.confirming &&
            "text-rose-500 dark:text-rose-400 hover:text-rose-600",
        )}
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {confirm.confirming ? t("confirm") : t("signOutOthers")}
      </button>
    </AccountBlock>
  );
}
