"use client";

import AuditLogsPanel from "@/components/admin/AuditLogsPanel";
import UserManagePanel from "@/components/admin/UserManagePanel";
import RequestsPanel from "@/components/admin/RequestsPanel";
import FeedbackAndBenefitsPanel from "@/components/profile/FeedbackAndBenefitsPanel";
import ProfileHeaderCard from "@/components/profile/ProfileHeaderCard";
import FavoritesTabContent from "@/components/profile/FavoritesTabContent";
import AnnotationsTabContent from "@/components/profile/AnnotationsTabContent";
import AccountTabContent from "@/components/profile/AccountTabContent";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { useUserContext } from "@/context/UserContext";
import { useCsrfToken } from "@/hooks/utils/useCsrfToken";
import { cn } from "@/lib/utils/utils";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Heart,
  Home,
  Loader2,
  MessageSquare,
  PenLine,
  Settings,
  Users,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useCallback, useEffect } from "react";

type TabType =
  | "favorites"
  | "annotations"
  | "account"
  | "feedback"
  | "users"
  | "logs"
  | "requests";
const PROFILE_TABS = [
  "favorites",
  "annotations",
  "account",
  "feedback",
  "users",
  "logs",
  "requests",
] as const;

function ProfileContent() {
  const router = useRouter();
  const t = useTranslations("profile");
  const tNav = useTranslations("common.nav");
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(PROFILE_TABS).withDefault("favorites").withOptions({
      history: "push",
      shallow: true,
      throttleMs: 300,
    }),
  );

  const { user, loaded: userLoaded } = useUserContext();
  const csrfToken = useCsrfToken();

  const isSuperAdmin = userLoaded && !!user?.isSuper;
  const hasBenefits = userLoaded && !!user?.hasBenefits;

  // Gate: fall back to favorites if accessing a restricted tab without permission
  useEffect(() => {
    if (!userLoaded) return;
    if (activeTab === "users" && !isSuperAdmin) setActiveTab("favorites");
    if (activeTab === "logs" && !isSuperAdmin) setActiveTab("favorites");
    if (activeTab === "requests" && !user?.isAdmin) setActiveTab("favorites");
  }, [userLoaded, activeTab, isSuperAdmin, user, setActiveTab]);

  // Localized scrollbar gutter prevention to avoid layout shift on profile tab switches
  useEffect(() => {
    const htmlEl = document.documentElement;
    const originalGutter = htmlEl.style.scrollbarGutter;
    htmlEl.style.scrollbarGutter = "stable";
    return () => {
      htmlEl.style.scrollbarGutter = originalGutter;
    };
  }, []);

  const handleBack = useCallback(() => {
    const navDepthStr = sessionStorage.getItem("__hetu_web_nav_depth");
    const navDepth = navDepthStr ? parseInt(navDepthStr, 10) : 0;
    if (navDepth > 0) {
      sessionStorage.setItem("__hetu_web_nav_depth", String(navDepth - 1));
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] transition-colors duration-500 font-sans">
      {/* Header Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 -ml-2">
              <button
                onClick={handleBack}
                className="p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 group"
                title={tNav("back") as string}
              >
                <ArrowLeft
                  size={20}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </button>

              <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

              <button
                onClick={() => router.push("/")}
                className="p-2 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 group"
                title={tNav("home") as string}
              >
                <Home
                  size={20}
                  className="transition-transform group-hover:scale-105 group-active:scale-95"
                />
              </button>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-serif tracking-tight">
              {t("title")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-8">
        {/* Profile Stats Header Card */}
        <ProfileHeaderCard />

        {/* Bottom Section: Tabs Grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Navigation Column */}
          <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-24 z-30">
            <div className="p-1 bg-slate-50/50 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex lg:flex-col overflow-x-auto no-scrollbar w-full gap-1 shadow-xs">
              {(
                [
                  "favorites",
                  "annotations",
                  "account",
                  "feedback",
                  ...(user?.isAdmin ? (["requests"] as TabType[]) : []),
                  ...(isSuperAdmin ? (["users", "logs"] as TabType[]) : []),
                ] as TabType[]
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center lg:justify-start gap-2 whitespace-nowrap shrink-0 lg:w-full",
                    activeTab === tab
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/30 dark:hover:bg-slate-800/20",
                  )}
                >
                  {tab === "favorites" && (
                    <Heart
                      size={14}
                      className={cn(activeTab === tab && "fill-current")}
                    />
                  )}
                  {tab === "annotations" && <PenLine size={14} />}
                  {tab === "account" && <Settings size={14} />}
                  {tab === "feedback" && <MessageSquare size={14} />}
                  {tab === "requests" && <ClipboardList size={14} />}
                  {tab === "users" && <Users size={14} />}
                  {tab === "logs" && <ClipboardList size={14} />}
                  {t(`tabs.${tab}`)}
                </button>
              ))}
            </div>
          </aside>

          {/* Content Column */}
          <div className="flex-1 w-full min-w-0">
            <div className="flex-1 flex flex-col">
              {activeTab === "favorites" && <FavoritesTabContent />}

              {activeTab === "annotations" && <AnnotationsTabContent />}

              {activeTab === "account" && <AccountTabContent />}

              {/* Feedback & Benefits Tab — all logged-in users */}
              {activeTab === "feedback" && user && (
                <FeedbackAndBenefitsPanel
                  hasBenefits={hasBenefits}
                  isAdmin={!!user.isAdmin}
                />
              )}

              {/* Requests Management Tab — admin only */}
              {activeTab === "requests" && user?.isAdmin && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6 flex-1">
                    <div className="space-y-1 mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ClipboardList size={18} className="text-blue-500" />
                        {t("sections.requests.title")}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {t("sections.requests.description")}
                      </p>
                    </div>
                    <RequestsPanel
                      csrfToken={csrfToken}
                      isSuper={isSuperAdmin}
                    />
                  </div>
                </div>
              )}

              {/* Users Management Tab — super admin only */}
              {activeTab === "users" && isSuperAdmin && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6 flex-1">
                    <div className="space-y-1 mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t("sections.users.title")}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {t("sections.users.description")}
                      </p>
                    </div>
                    <UserManagePanel csrfToken={csrfToken} />
                  </div>
                </div>
              )}

              {/* Audit Logs Tab — super admin only */}
              {activeTab === "logs" && isSuperAdmin && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 flex flex-col">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6 flex-1">
                    <div className="space-y-1 mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ClipboardList size={18} className="text-blue-500" />
                        {t("sections.logs.title")}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {t("sections.logs.description")}
                      </p>
                    </div>
                    <AuditLogsPanel />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
