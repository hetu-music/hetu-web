"use client";

import StatusPage, {
  STATUS_ACTION_CLASS,
} from "@/components/shared/StatusPage";
import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { cn } from "@/lib/utils/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 根目录级的 not-found：语言路由下没有匹配的页面时也走这里
// 根 layout 不输出 html/body，这里须自带；也不在 next-intl 之内，文案直接写
export default function NotFoundFallback() {
  const router = useRouter();

  // 直接打开的链接没有上一页可回，就回主页
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <StatusPage
          mark="404"
          title="页面未找到"
          description="抱歉，您访问的页面不存在或已被移除。"
        >
          {/* 「/」由 next.config 转到 /zh-CN */}
          <Link
            href="/"
            className={cn(PRIMARY_BUTTON_CLASS, STATUS_ACTION_CLASS)}
          >
            返回主页
          </Link>
          <button
            type="button"
            onClick={goBack}
            className={cn(TEXT_BUTTON_CLASS, STATUS_ACTION_CLASS)}
          >
            返回上页
          </button>
        </StatusPage>
      </body>
    </html>
  );
}
