"use client";

import ErrorState from "@/components/shared/Error";

// 页面渲染出错时的兜底；在 [locale]/layout 之内，文案与主题都可用
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState error={error} onRetry={retry} />;
}
