"use client";

import AccountSection from "@/components/profile/AccountSection";
import AnnotationsSection from "@/components/profile/AnnotationsSection";
import FavoritesSection from "@/components/profile/FavoritesSection";
import FeedbackSection from "@/components/profile/FeedbackSection";
import ProfileHero from "@/components/profile/ProfileHero";
import { PROFILE_TABS, type ProfileTab } from "@/components/profile/profile-ui";
import FloatingActionButtons from "@/components/shared/FloatingActionButtons";
import TopBar from "@/components/shared/topbar/TopBar";
import { useScrollTop } from "@/hooks/ui/useScrollTop";
import { cn } from "@/lib/utils/utils";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import React from "react";

/** 个人中心：左栏卷首与目录，右栏为当前一节 */
export default function ProfileClient() {
  const t = useTranslations("profile");
  const { showScrollTop, scrollToTop } = useScrollTop();
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(PROFILE_TABS).withDefault("favorites").withOptions({
      history: "push",
      shallow: true,
      throttleMs: 300,
    }),
  );

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 [--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]"
      style={
        {
          "--tone-light": INK_TONE.light,
          "--tone-dark": INK_TONE.dark,
        } as React.CSSProperties
      }
    >
      <TopBar
        exit={{ kind: "back" }}
        nav={
          <h1 className="px-2 min-w-0 truncate font-serif text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("title")}
          </h1>
        }
      />

      <main className="relative pt-32 md:pt-40 pb-32 max-w-6xl mx-auto px-6">
        <div className="grid gap-y-14 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16">
          <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
            <ProfileHero />
            <Catalog
              active={activeTab}
              onSelect={setActiveTab}
              className="hidden lg:block mt-14 pt-8 border-t border-slate-200/70 dark:border-slate-800"
            />
          </aside>

          <div className="min-w-0">
            <Catalog
              active={activeTab}
              onSelect={setActiveTab}
              horizontal
              className="lg:hidden mb-10"
            />
            <div
              key={activeTab}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              {activeTab === "favorites" && <FavoritesSection />}
              {activeTab === "annotations" && <AnnotationsSection />}
              {activeTab === "feedback" && <FeedbackSection />}
              {activeTab === "account" && <AccountSection />}
            </div>
          </div>
        </div>
      </main>

      <FloatingActionButtons
        showScrollTop={showScrollTop}
        onScrollToTop={scrollToTop}
      />
    </div>
  );
}

/**
 * 四节的目录：宽屏在左栏竖排，当前项左侧一道强调色短线（同歌曲页目录）；
 * 窄屏在正文上方横排，当前项下方一道短线。
 */
function Catalog({
  active,
  onSelect,
  horizontal = false,
  className,
}: {
  active: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  horizontal?: boolean;
  className?: string;
}) {
  const t = useTranslations("profile");

  return (
    <nav aria-label={t("title")} className={className}>
      <ol
        className={cn(
          horizontal &&
            "flex gap-7 overflow-x-auto no-scrollbar border-b border-slate-200/70 dark:border-slate-800",
        )}
      >
        {PROFILE_TABS.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(tab)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative font-serif tracking-wider whitespace-nowrap transition-colors",
                  horizontal
                    ? "pb-3 text-[15px]"
                    : "w-full py-2.5 pl-4 text-left text-base",
                  current
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute rounded-full bg-(--tone) transition-opacity",
                    horizontal
                      ? "left-0 right-0 -bottom-px h-0.5"
                      : "left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5",
                    current ? "opacity-100" : "opacity-0",
                  )}
                />
                {t(`tabs.${tab}`)}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
