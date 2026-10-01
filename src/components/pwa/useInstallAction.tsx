"use client";

import IOSInstallPrompt from "@/components/pwa/IOSInstallPrompt";
import { usePWAInstall } from "@/components/pwa/PWARegistration";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import React, { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/**
 * 安装为 PWA 的入口：浏览器可安装时直接弹出安装，iOS 改为弹出手动安装说明。
 * `prompt` 是 iOS 说明面板，须渲染在入口之外、不会随菜单收起而卸载的地方。
 */
export function useInstallAction() {
  const { isInstallable, install, isIOS, isStandalone } = usePWAInstall();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  // 服务端不知道是否可安装，挂载后再显示入口，免得水合不一致
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return {
    available: mounted && (isInstallable || (isIOS && !isStandalone)),
    start: () => {
      if (isIOS) setShowIOSPrompt(true);
      else void install();
    },
    // 说明面板一直挂着，收起时才有退场动画
    prompt: mounted ? (
      <IOSInstallPrompt open={showIOSPrompt} onOpenChange={setShowIOSPrompt} />
    ) : null,
  };
}

/** 宽屏顶栏里的安装按钮，不可安装时不显示 */
export function InstallButton({ className }: { className?: string }) {
  const { available, start, prompt } = useInstallAction();
  const tNav = useTranslations("common.nav");
  if (!available) return prompt;
  return (
    <>
      <button
        type="button"
        onClick={start}
        className={className}
        title={tNav("install")}
        aria-label={tNav("install")}
      >
        <Download size={20} />
      </button>
      {prompt}
    </>
  );
}
