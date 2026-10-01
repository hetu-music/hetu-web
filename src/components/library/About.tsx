"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { TYPE_ORDER } from "@/lib/constants";
import { Award, Mail, User, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import React, { useLayoutEffect, useRef, useState } from "react";

/** Smoothly animates height changes when children resize (e.g. tab switching). */
function AnimatedHeight({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        height: height ?? "auto",
        overflow: "hidden",
        transition: "height 350ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* small min-height only guards against momentary 0-height during unmount */}
      <div ref={innerRef} style={{ minHeight: 60 }}>
        {children}
      </div>
    </div>
  );
}

interface Contributor {
  name?: string;
  display?: boolean;
  intro?: string;
  sort_order?: number;
}

const typeColors: Record<
  string,
  { border: string; hoverBorder: string; bg: string; text: string }
> = {
  原创: {
    border: "border-l-purple-500 dark:border-l-purple-400",
    hoverBorder: "hover:border-purple-300 dark:hover:border-purple-500/50",
    bg: "from-purple-50/50 dark:from-purple-500/5",
    text: "text-purple-600 dark:text-purple-400",
  },
  合作: {
    border: "border-l-amber-500 dark:border-l-amber-400",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-500/50",
    bg: "from-amber-50/50 dark:from-amber-500/5",
    text: "text-amber-600 dark:text-amber-400",
  },
  文宣: {
    border: "border-l-emerald-500 dark:border-l-emerald-400",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-500/50",
    bg: "from-emerald-50/50 dark:from-emerald-500/5",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  商业: {
    border: "border-l-orange-500 dark:border-l-orange-400",
    hoverBorder: "hover:border-orange-300 dark:hover:border-orange-500/50",
    bg: "from-orange-50/50 dark:from-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
  },
  墨宝: {
    border: "border-l-rose-500 dark:border-l-rose-400",
    hoverBorder: "hover:border-rose-300 dark:hover:border-rose-500/50",
    bg: "from-rose-50/50 dark:from-rose-500/5",
    text: "text-rose-600 dark:text-rose-400",
  },
  翻唱: {
    border: "border-l-blue-500 dark:border-l-blue-400",
    hoverBorder: "hover:border-blue-300 dark:hover:border-blue-500/50",
    bg: "from-blue-50/50 dark:from-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
  },
  参与: {
    border: "border-l-fuchsia-500 dark:border-l-fuchsia-400",
    hoverBorder: "hover:border-fuchsia-300 dark:hover:border-fuchsia-500/50",
    bg: "from-fuchsia-50/50 dark:from-fuchsia-500/5",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
  },
};

const fallbackColors = {
  border: "border-l-slate-500 dark:border-l-slate-400",
  hoverBorder: "hover:border-slate-300 dark:hover:border-slate-500/50",
  bg: "from-slate-50/50 dark:from-slate-500/5",
  text: "text-slate-600 dark:text-slate-400",
};

const WeiboIcon = ({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    role="img"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Sina Weibo</title>
    <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z" />
  </svg>
);

const About = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useTranslations("common.about");
  // 宽屏是居中弹窗，窄屏是底部面板（DESIGN.md「浮层」）
  const isDesktop = useIsDesktop();
  // 切到「维护者」页签才去拉，之后留在缓存里
  const [wantContributors, setWantContributors] = useState(false);
  const {
    data: contributors = [],
    isLoading: contributorsLoading,
    isError: contributorsFailed,
  } = useQuery({
    queryKey: ["public", "contributors"],
    queryFn: async (): Promise<Contributor[]> => {
      const res = await fetch("/api/public/contributors");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return Array.isArray(data.contributors) ? data.contributors : [];
    },
    enabled: wantContributors,
  });
  const contributorsError = contributorsFailed
    ? t("maintainersSection.loadError")
    : null;

  const mainContributor = contributors.find((c) => c.sort_order === 2);

  const body = (
    <Tabs
      defaultValue="about"
      className="flex flex-col"
      onValueChange={(value) => {
        if (value === "maintainer") setWantContributors(true);
      }}
    >
      <TabsList className="px-6">
        <TabsTrigger value="about">{t("tabs.intro")}</TabsTrigger>
        <TabsTrigger value="types">{t("tabs.types")}</TabsTrigger>
        <TabsTrigger value="maintainer">{t("tabs.maintainers")}</TabsTrigger>
      </TabsList>

      <AnimatedHeight>
        {/* About Tab */}
        <TabsContent value="about" className="max-h-[65vh]">
          <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t("introSection.title")}
              </h3>
              <p>{t("introSection.content")}</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {t("feedbackSection.title")}
              </h3>
              <p>{t("feedbackSection.content")}</p>
              <div className="flex flex-col gap-2 mt-2">
                <a
                  href="mailto:feedback@hetu-music.com"
                  className="w-fit inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-(--tone) hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <Mail size={16} />
                  <span>feedback@hetu-music.com</span>
                </a>
                <a
                  href="https://weibo.com/u/3509434894"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-[#e6162d] dark:text-[#ff4d4f] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <WeiboIcon size={18} />
                  <span>{t("feedbackSection.weibo")}</span>
                </a>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/20 text-sm">
              <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-500 font-bold">
                <Award size={18} />
                <span>{t("thanksSection.title")}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {t.rich("thanksSection.content", {
                  name: mainContributor?.name || "顾大一",
                  highlight: (chunks) => (
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {chunks}
                    </span>
                  ),
                })}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="max-h-[65vh] px-6 py-4">
          <div className="grid grid-cols-1 gap-3">
            {TYPE_ORDER.map((type, idx) => {
              const colors = typeColors[type] ?? fallbackColors;
              return (
                <div
                  key={type}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`
                        animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both
                        relative overflow-hidden rounded-xl
                        border-l-[3px] ${colors.border}
                        bg-linear-to-r ${colors.bg} to-transparent
                        border border-slate-100 dark:border-slate-800/50
                        ${colors.hoverBorder}
                        transition-colors duration-200
                      `}
                >
                  <div className="px-4 py-3">
                    <div
                      className={`text-sm font-semibold ${colors.text} mb-1`}
                    >
                      {type}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(`typeDescriptions.${type}`)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Maintainer Tab */}
        <TabsContent value="maintainer" className="max-h-[65vh]">
          <div className="space-y-4">
            {contributorsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">
                  {t("maintainersSection.loading")}
                </span>
              </div>
            ) : contributorsError ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-500 gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{contributorsError}</span>
              </div>
            ) : contributors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <User size={32} className="opacity-20" />
                <span className="text-sm">{t("maintainersSection.empty")}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {[...contributors]
                  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                  .map((contributor, idx) => (
                    <div
                      key={idx}
                      style={{ animationDelay: `${idx * 40}ms` }}
                      className="animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both flex items-start gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:border-(--tone)/30 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-bold shrink-0">
                        {contributor.name?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">
                          {contributor.name ?? t("maintainersSection.unknown")}
                        </div>
                        {contributor.intro && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {contributor.intro}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>
      </AnimatedHeight>
    </Tabs>
  );

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          title={t("title")}
          description={t("description")}
          contentClassName="flex flex-col overflow-hidden px-0 pb-[env(safe-area-inset-bottom)]"
        >
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="classic" className="overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogClose className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </DialogClose>
        </DialogHeader>

        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>

        {body}
      </DialogContent>
    </Dialog>
  );
};

export default About;
