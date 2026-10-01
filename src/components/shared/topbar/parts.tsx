"use client";

import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { useUserContext } from "@/context/UserContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { ArrowLeft, ChevronDown, Home, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { useCallback, useState } from "react";
import { MenuList, type MenuItem } from "./menu";

/** 站内导航深度：进入内页前递增，返回时据此判断有没有站内历史可退 */
const NAV_DEPTH_KEY = "__hetu_web_nav_depth";

function readDepth() {
  return parseInt(sessionStorage.getItem(NAV_DEPTH_KEY) || "0", 10);
}

/** 入口页的出口：站名。中间的竖线是站标的一部分，固定用蓝色，不随 --tone 变 */
export function SiteLogo({
  onClick,
  tooltip,
}: {
  /** 默认回主页 */
  onClick?: () => void;
  tooltip?: string;
}) {
  const router = useRouter();
  const tNav = useTranslations("common.nav");
  const tLogo = useTranslations("common.site.logo");

  return (
    <button
      type="button"
      onClick={onClick ?? (() => router.push("/"))}
      className="flex min-w-0 cursor-pointer items-center gap-1 whitespace-nowrap font-serif text-2xl font-bold tracking-tight text-slate-900 transition-colors hover:text-(--tone) dark:text-white dark:hover:text-(--tone)"
      title={tooltip ?? tNav("backToHome")}
    >
      {tLogo("part1")}
      <span className="mx-2 h-5 w-0.5 translate-y-[1.5px] rounded-full bg-blue-600" />
      {tLogo("part2")}
    </button>
  );
}

/** 内页的出口：返回 · 回主页。窄屏放不下回主页，由 TopBar 收进「更多」 */
export function BackHome() {
  const router = useRouter();
  const tNav = useTranslations("common.nav");
  // 返回要等路由切换，先把按钮按下去，免得看起来没反应
  const [pressed, setPressed] = useState(false);

  const handleBack = () => {
    setPressed(true);
    const depth = readDepth();
    if (depth > 0) {
      sessionStorage.setItem(NAV_DEPTH_KEY, String(depth - 1));
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex items-center gap-1 -ml-2 shrink-0">
      <button
        type="button"
        onClick={handleBack}
        className={cn(
          NAV_BUTTON_CLASS,
          "group",
          pressed && "bg-slate-200/50 dark:bg-slate-800",
        )}
        title={tNav("back")}
        aria-label={tNav("back")}
      >
        <ArrowLeft
          size={20}
          className={cn(
            "transition-transform",
            pressed ? "-translate-x-0.5" : "group-hover:-translate-x-0.5",
          )}
        />
      </button>
      <div className="hidden md:block w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
      <button
        type="button"
        onClick={() => router.push("/")}
        className={cn(NAV_BUTTON_CLASS, "group hidden md:inline-flex")}
        title={tNav("home")}
        aria-label={tNav("home")}
      >
        <Home
          size={20}
          className="transition-transform group-hover:scale-105 group-active:scale-95"
        />
      </button>
    </div>
  );
}

/** 用户：未登录去登录页并带上回跳地址，已登录去个人中心 */
export function UserButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loaded } = useUserContext();
  const tNav = useTranslations("common.nav");

  const open = useCallback(() => {
    // 登录状态尚未同步完成，忽略点击，避免误跳转到登录页
    if (!loaded) return;
    if (!user) {
      const next = encodeURIComponent(pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    }
    sessionStorage.setItem(NAV_DEPTH_KEY, String(readDepth() + 1));
    router.push("/profile?tab=favorites");
  }, [router, pathname, user, loaded]);

  const label = !loaded ? tNav("loading") : user ? user.name : tNav("login");
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        NAV_BUTTON_CLASS,
        "disabled:opacity-50 disabled:cursor-wait",
      )}
      title={label}
      aria-label={label}
      disabled={!loaded}
    >
      <User size={20} className={user ? "text-(--tone)" : ""} />
    </button>
  );
}

/**
 * 内页的「题名 / 当前项 ▾」：歌曲页的目录、后台的板块都用它。
 * 宽屏常驻题名，点开在下方展开；窄屏只放得下当前项，点开从底部拉出。
 */
export function PlaceNav({
  title,
  label,
  items,
  active,
  onSelect,
  menuTitle,
}: {
  title: string;
  /** 窄屏显示的文字，默认是当前项 */
  label?: string;
  items: readonly MenuItem[];
  active: string;
  onSelect: (id: string) => void;
  /** 底部面板的题头，也作为按钮的无障碍名称 */
  menuTitle: string;
}) {
  const [open, setOpen] = useState(false);

  const activeLabel = items.find((i) => i.id === active)?.label;
  const select = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  const trigger = (
    <button
      type="button"
      aria-label={menuTitle}
      className="group flex min-w-0 max-w-full items-baseline gap-2 px-2 py-1.5"
    >
      <span className="hidden sm:block min-w-0 truncate font-serif text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </span>
      <span
        aria-hidden
        className="hidden sm:block text-slate-300 dark:text-slate-600"
      >
        ·
      </span>
      {/* 当前项与三角标自成一组居中对齐；整组再按基线与题名对齐 */}
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap font-serif text-sm tracking-wider transition-colors",
          open
            ? "text-slate-900 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100",
        )}
      >
        <span className="hidden sm:inline">{activeLabel}</span>
        <span className="sm:hidden">{label ?? activeLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </span>
    </button>
  );

  return (
    <div className="min-w-0">
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title={menuTitle}
        trigger={trigger}
        popoverClassName="w-52"
      >
        {(layout) => (
          <MenuList
            items={items}
            active={active}
            size={layout === "popover" ? "sm" : "lg"}
            onSelect={select}
          />
        )}
      </ResponsivePanel>
    </div>
  );
}
