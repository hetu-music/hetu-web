"use client";

import StatusPage, {
  STATUS_ACTION_CLASS,
} from "@/components/shared/StatusPage";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import React from "react";

/**
 * 出错时的整页提示。onRetry 由错误边界传入（重新渲染出错的那一段）；
 * 不传则整页刷新。
 */
export default function ErrorState({
  error,
  onRetry,
}: {
  error: Error | string;
  onRetry?: () => void;
}) {
  const t = useTranslations("common.error");

  // 只记到控制台，不把错误详情给读者看
  React.useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return (
    <StatusPage title={t("title")} description={t("description")}>
      <button
        type="button"
        onClick={() => (onRetry ? onRetry() : window.location.reload())}
        className={cn(PRIMARY_BUTTON_CLASS, STATUS_ACTION_CLASS)}
      >
        {t("refresh")}
      </button>
      <Link href="/" className={cn(TEXT_BUTTON_CLASS, STATUS_ACTION_CLASS)}>
        {t("backToHome")}
      </Link>
    </StatusPage>
  );
}
