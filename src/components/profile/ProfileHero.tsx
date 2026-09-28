"use client";

import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { useFavorites } from "@/context/FavoritesContext";
import { useUserContext } from "@/context/UserContext";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/utils";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/** 卷首：身份、名字、简介与几项资料，排成一行行文字 */
export default function ProfileHero() {
  const t = useTranslations("profile.hero");
  const { user, logout, loggingOut } = useUserContext();
  const { favorites } = useFavorites();

  // 页面已在服务端校验过登录，这里只是等 /api/auth/me 返回
  if (!user) return <div className="min-h-40" />;

  const role = user.isSuper ? "super" : user.isAdmin ? "admin" : "user";
  const rows = [
    ...(user.email ? [{ key: "email", value: user.email }] : []),
    { key: "favorites", value: String(favorites.length) },
    {
      key: "benefits",
      value: user.hasBenefits ? t("benefitsOn") : t("benefitsOff"),
    },
  ];

  return (
    <header className="animate-in fade-in duration-700">
      <p className="text-xs tracking-[0.35em] text-(--tone) mb-5">
        {t(`role.${role}`)}
      </p>

      <h2 className="font-serif text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 text-balance wrap-break-word">
        {user.name}
      </h2>

      {user.intro && (
        <p className="mt-6 font-kaiti text-[15px] leading-[2.05] text-slate-700 dark:text-slate-300 whitespace-pre-line wrap-break-word">
          {user.intro}
        </p>
      )}

      <dl className="mt-8 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline gap-4 min-w-0">
            <dt className="w-10 shrink-0 text-xs tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {t(row.key)}
            </dt>
            <dd className="min-w-0 text-slate-800 dark:text-slate-200 wrap-break-word">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex items-center gap-6">
        {user.isAdmin && (
          <Link href="/admin" className={PRIMARY_BUTTON_CLASS}>
            {t("adminPanel")}
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className={cn(TEXT_BUTTON_CLASS, "inline-flex items-center gap-1.5")}
        >
          {loggingOut && <Loader2 size={12} className="animate-spin" />}
          {t("logout")}
        </button>
      </div>
    </header>
  );
}
