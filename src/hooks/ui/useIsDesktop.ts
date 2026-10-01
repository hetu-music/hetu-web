import { useMediaQuery } from "./useMediaQuery";

/** 视口不窄于 768px（md 断点）；服务端渲染时视为窄屏 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
