"use client";

import { useEffect, useState, useCallback } from "react";

// 定义事件类型
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// 模块级变量（用于跨组件共享安装事件）
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * PWA 注册组件 (放置在 layout.tsx 或根组件中)
 * 负责：
 * 1. 静默注册 Service Worker
 * 2. 捕获浏览器原本的安装弹窗事件，存起来供自定义按钮使用
 */
export function PWARegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // 1. 注册 Service Worker
    const registerSW = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // 每次都检查 sw.js 是否有变化
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    // 当新 SW 接管控制权时，自动刷新页面以显示最新内容。
    // 只在替换旧 SW 时刷新：首次访问时页面本没有 controller，SW 预缓存完
    // （字体图标约 30MB，移动网络要几十秒）后 clientsClaim 也会触发
    // controllerchange，此时刷新会打断用户正在做的事（如测验做到一半被重置）
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    registerSW();

    // 2. 监听安装事件 (为了自定义安装按钮)
    const handleBeforeInstallPrompt = (e: Event) => {
      // 阻止浏览器默认的底部横条弹窗
      e.preventDefault();
      // 保存事件，供后续使用
      deferredPrompt = e as BeforeInstallPromptEvent;
      // 派发自定义事件通知 UI
      window.dispatchEvent(new Event("pwa-installable"));
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      window.dispatchEvent(new Event("pwa-installed"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}

/**
 * Hook: 供你的“安装按钮”组件使用
 */
// 扩展 Navigator 类型以支持 iOS Safari 的 standalone 属性
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

export function usePWAInstall() {
  // 使用函数初始化以避免在 useEffect 中同步调用 setState
  const [isInstallable, setIsInstallable] = useState(() => !!deferredPrompt);

  // 在初始化时检测 iOS，避免在 useEffect 中同步调用 setState
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  });

  // 在初始化时检测 Standalone 模式
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as NavigatorStandalone).standalone === true
    );
  });

  useEffect(() => {
    const handleInstallable = () => setIsInstallable(true);
    const handleInstalled = () => setIsInstallable(false);

    window.addEventListener("pwa-installable", handleInstallable);
    window.addEventListener("pwa-installed", handleInstalled);

    return () => {
      window.removeEventListener("pwa-installable", handleInstallable);
      window.removeEventListener("pwa-installed", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      setIsInstallable(false);
      return outcome === "accepted";
    } catch {
      return false;
    }
  }, []);

  return { isInstallable, install, isIOS, isStandalone };
}
