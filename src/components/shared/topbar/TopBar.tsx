"use client";

import {
  InstallButton,
  useInstallAction,
} from "@/components/pwa/useInstallAction";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import {
  Download,
  Home,
  Info,
  type LucideIcon,
  MoreHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React, { useCallback, useId, useState } from "react";
import {
  ScriptMenu,
  ThemeMenu,
  useScriptChoice,
  useThemeChoice,
} from "./choices";
import {
  BottomSheet,
  InlineOptions,
  SheetHostContext,
  useDismiss,
} from "./overlay";
import { BackHome, SiteLogo, UserButton } from "./parts";

// 「关于」只在点开时才用到，单独分包
const About = dynamic(() => import("@/components/library/About"), {
  ssr: false,
});

/**
 * 出口只有两种：入口页放站名（旁边常驻「关于」），内页放「返回 · 回主页」。
 */
export type TopBarExit =
  { kind: "logo"; onClick?: () => void; tooltip?: string } | { kind: "back" };

/** 可收起的本页操作：宽屏平铺在顶栏，窄屏收进「更多」 */
export interface TopBarAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

interface TopBarProps {
  exit: TopBarExit;
  /** 出口右侧的本页导航：题名、目录、板块 */
  nav?: React.ReactNode;
  /** 窄屏也常驻的本页按钮，排在用户前面 */
  pinned?: React.ReactNode;
  actions?: TopBarAction[];
  /** 登录注册页本身就是登录入口，不放用户按钮 */
  user?: boolean;
  install?: boolean;
  /** 简繁切换；后台还没做 i18n，先关掉 */
  script?: boolean;
  /** 顶栏下沿：说明条、阅读进度 */
  children?: React.ReactNode;
}

/**
 * 全站唯一的顶栏。右侧顺序固定：常驻按钮 → 用户 → 本页操作 → 安装 → 文字 → 主题，
 * 窄屏只留常驻按钮与用户，其余收进「更多」。
 */
export default function TopBar({
  exit,
  nav,
  pinned,
  actions = [],
  user = true,
  install = true,
  script = true,
  children,
}: TopBarProps) {
  const tNav = useTranslations("common.nav");
  const [sheetHost, setSheetHost] = useState<HTMLDivElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // 点开过一次才去加载「关于」；之后留着，收起时才放得完退场动画
  const [aboutLoaded, setAboutLoaded] = useState(false);
  const moreScope = useId();
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useDismiss(moreOpen, closeMore, moreScope);

  return (
    <SheetHostContext.Provider value={sheetHost}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            {exit.kind === "logo" ? (
              <SiteLogo onClick={exit.onClick} tooltip={exit.tooltip} />
            ) : (
              <BackHome />
            )}
            {nav}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {exit.kind === "logo" && (
              <button
                type="button"
                onClick={() => {
                  setAboutLoaded(true);
                  setAboutOpen(true);
                }}
                className={NAV_BUTTON_CLASS}
                title={tNav("about")}
                aria-label={tNav("about")}
              >
                <Info size={20} />
              </button>
            )}
            {pinned}
            {user && <UserButton />}

            <div className="hidden md:flex items-center gap-2">
              {actions.map(({ key, icon: Icon, label, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className={NAV_BUTTON_CLASS}
                  title={label}
                  aria-label={label}
                >
                  <Icon size={20} />
                </button>
              ))}
              {install && <InstallButton className={NAV_BUTTON_CLASS} />}
              {script && <ScriptMenu />}
              <ThemeMenu />
            </div>

            <div data-dismiss-scope={moreScope} className="flex md:hidden">
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  NAV_BUTTON_CLASS,
                  moreOpen && "text-(--tone) dark:text-(--tone)",
                )}
                title={tNav("more")}
                aria-label={tNav("more")}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
              >
                <MoreHorizontal size={20} />
              </button>
              <MoreSheet
                open={moreOpen}
                onClose={closeMore}
                scope={moreScope}
                actions={actions}
                home={exit.kind === "back"}
                install={install}
                script={script}
              />
            </div>
          </div>
        </div>
        {children}
      </nav>

      {/* 底部面板挂在顶栏外：顶栏的 backdrop-filter 会把 fixed 元素困住 */}
      <div ref={setSheetHost} />

      {aboutLoaded && <About open={aboutOpen} onOpenChange={setAboutOpen} />}
    </SheetHostContext.Provider>
  );
}

/** 窄屏的「更多」：本页操作一行一项，下面是主题与文字 */
function MoreSheet({
  open,
  onClose,
  scope,
  actions,
  home,
  install,
  script,
}: {
  open: boolean;
  onClose: () => void;
  scope: string;
  actions: TopBarAction[];
  /** 内页窄屏放不下回主页，收在这里 */
  home: boolean;
  install: boolean;
  script: boolean;
}) {
  const tNav = useTranslations("common.nav");
  const router = useRouter();
  const installAction = useInstallAction();
  const theme = useThemeChoice();
  const scriptChoice = useScriptChoice();

  const rows: TopBarAction[] = [
    ...actions,
    ...(home
      ? [
          {
            key: "home",
            icon: Home,
            label: tNav("home"),
            onClick: () => router.push("/"),
          },
        ]
      : []),
    ...(install && installAction.available
      ? [
          {
            key: "install",
            icon: Download,
            label: tNav("install"),
            onClick: installAction.start,
          },
        ]
      : []),
  ];

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={tNav("more")}
        scope={scope}
      >
        {rows.length > 0 && (
          <ul className="mb-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            {rows.map(({ icon: Icon, ...row }) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    row.onClick();
                  }}
                  className="group flex w-full items-center gap-3 py-3 text-left text-sm tracking-widest text-slate-700 dark:text-slate-300 hover:text-(--tone) transition-colors"
                >
                  <Icon
                    size={16}
                    className="shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-(--tone) transition-colors"
                  />
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-8">
          <dt className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
            {tNav("theme")}
          </dt>
          <dd>
            <InlineOptions
              items={theme.items}
              active={theme.active}
              onSelect={theme.select}
            />
          </dd>
          {script && (
            <>
              <dt className="text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500">
                {tNav("script")}
              </dt>
              <dd>
                <InlineOptions
                  items={scriptChoice.items}
                  active={scriptChoice.active}
                  disabled={scriptChoice.pending}
                  onSelect={(id) => {
                    onClose();
                    scriptChoice.select(id);
                  }}
                />
              </dd>
            </>
          )}
        </dl>
      </BottomSheet>
      {/* iOS 的安装说明要在面板收起后仍然留着 */}
      {installAction.prompt}
    </>
  );
}
