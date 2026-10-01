"use client";

import { createContext, useContext } from "react";

/**
 * 浮层挂载的位置。顶栏的 backdrop-filter 会把其中的 fixed 元素困住，
 * 所以浮层要挂到顶栏外；又不能直接挂到 body 上，否则拿不到页面根容器上的
 * 封面取色 --tone。TopBar 在自己旁边放一个挂载点，经由这里传下去；
 * 不在 TopBar 里的浮层拿到 null，退回挂到 body。
 */
export const OverlayHostContext = createContext<HTMLElement | null>(null);

export function useOverlayHost() {
  return useContext(OverlayHostContext);
}
