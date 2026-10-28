"use client";

import React, { useRef } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV_BUTTON_CLASS } from "@/components/shared/nav-button";
import { useFavorites } from "@/context/FavoritesContext";
import { useGoToLogin } from "@/hooks/ui/useGoToLogin";
import { cn } from "@/lib/utils/utils";

interface FavoriteButtonProps {
  songId: number;
  /** "nav" = 顶栏图标按钮，"inline" = 内联小按钮 */
  variant?: "nav" | "inline";
  /**
   * 未登录时也显示，点击去登录，登录后回到当前页。
   * 只在测验结果页用：访客在那里对具体的歌有了兴趣，是引导登录的时机；
   * 其他页面未登录时仍不显示
   */
  showForGuest?: boolean;
  className?: string;
}

const INLINE_IDLE_CLASS =
  "text-slate-400 dark:text-slate-500 hover:text-rose-400 dark:hover:text-rose-400";

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  songId,
  variant = "nav",
  showForGuest = false,
  className = "",
}) => {
  const t = useTranslations("common.favorite");
  const { isFavorite, toggleFavorite, loaded, isLoggedIn } = useFavorites();
  const goToLogin = useGoToLogin();
  const isProcessing = useRef(false);

  if (!loaded) return null;

  if (!isLoggedIn) {
    if (!showForGuest) return null;
    const label = t("login");
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goToLogin();
        }}
        aria-label={label}
        title={label}
        className={cn(
          variant === "inline"
            ? cn(
                "flex items-center justify-center transition-all duration-200",
                INLINE_IDLE_CLASS,
              )
            : cn(
                NAV_BUTTON_CLASS,
                "hover:text-rose-500 dark:hover:text-rose-400",
              ),
          className,
        )}
      >
        <Heart size={variant === "inline" ? 16 : 20} />
      </button>
    );
  }

  const active = isFavorite(songId);
  const label = active ? t("remove") : t("add");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 防抖/节流：防止短时间内重复点击
    if (isProcessing.current) return;

    isProcessing.current = true;
    toggleFavorite(songId);

    setTimeout(() => {
      isProcessing.current = false;
    }, 500); // 500ms 冷却时间
  };

  if (variant === "inline") {
    return (
      <button
        onClick={handleClick}
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cn(
          "flex items-center justify-center transition-all duration-200",
          active ? "text-rose-500 dark:text-rose-400" : INLINE_IDLE_CLASS,
          className,
        )}
      >
        <Heart size={16} className={active ? "fill-current" : ""} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        NAV_BUTTON_CLASS,
        active
          ? "text-rose-500 dark:text-rose-400"
          : "hover:text-rose-500 dark:hover:text-rose-400",
        className,
      )}
    >
      <Heart size={20} className={active ? "fill-current" : ""} />
    </button>
  );
};

export default FavoriteButton;
