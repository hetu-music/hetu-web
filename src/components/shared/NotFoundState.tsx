"use client";

import StatusPage, {
  STATUS_ACTION_CLASS,
} from "@/components/shared/StatusPage";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";

/** 语言路由内的 404：返回上页、回到主页 */
export default function NotFoundState() {
  const router = useRouter();
  const t = useTranslations("common.notFound");

  // 直接打开的链接没有上一页可回，就回主页
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <StatusPage mark="404" title={t("title")} description={t("description")}>
      <Link href="/" className={cn(PRIMARY_BUTTON_CLASS, STATUS_ACTION_CLASS)}>
        {t("home")}
      </Link>
      <button
        type="button"
        onClick={goBack}
        className={cn(TEXT_BUTTON_CLASS, STATUS_ACTION_CLASS)}
      >
        {t("back")}
      </button>
    </StatusPage>
  );
}
