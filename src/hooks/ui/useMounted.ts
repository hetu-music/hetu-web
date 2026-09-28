import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/**
 * 是否已在浏览器里挂载：服务端与水合时为 false，之后为 true。
 * 只在客户端才有的东西（第三方小窗、读 localStorage 的主题）等它再渲染，
 * 否则两端渲染结果不一致会导致水合失败（见 DESIGN.md 第九节）。
 */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
