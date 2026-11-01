"use client";

/**
 * 首次绘制前就要跑的内联脚本（Next 文档 preventing-flash-before-hydration 的写法）。
 * 只在整页加载时跑：服务端输出 text/javascript；客户端渲染（软导航）时是 text/plain，
 * 浏览器不执行，React 也不会因为渲染出 <script> 报警告。类型两端不同，靠 suppressHydrationWarning。
 * 公开页面的 CSP 允许内联脚本（proxy.ts）；登录、注册页是严格 CSP，不能用。
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
