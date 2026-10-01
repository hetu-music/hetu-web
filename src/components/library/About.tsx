"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { TYPE_ORDER } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import React, { useState } from "react";

interface Contributor {
  name?: string;
  display?: boolean;
  intro?: string;
  sort_order?: number;
}

// 凡例的类型配色只在这里用，按原设计保留
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

/** 节内的小标签：一行灰色小字 */
const LABEL_CLASS =
  "text-xs tracking-[0.3em] text-slate-400 dark:text-slate-500";
/** 人写的话用楷体 */
const PROSE_CLASS =
  "font-kaiti text-[0.95rem] leading-[2.05] text-slate-700 dark:text-slate-300";
const NOTE_CLASS = "font-kaiti text-sm text-slate-400 dark:text-slate-500";
const LINK_CLASS =
  "text-(--tone) underline-offset-4 decoration-(--tone)/40 hover:underline";

function AboutBody() {
  const t = useTranslations("common.about");
  const [tab, setTab] = useState("intro");
  // 切到「致谢」才去拉名录，之后留在缓存里
  const [thanksSeen, setThanksSeen] = useState(false);
  const contributorsQuery = useContributors(thanksSeen);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(String(value));
        if (value === "thanks") setThanksSeen(true);
      }}
    >
      {/* 页签吸在顶上，内容在下面滚 */}
      <TabsList className="sticky top-0 z-10 bg-[#FAFAFA] dark:bg-[#0B0F19]">
        <TabsTrigger value="intro">{t("tabs.intro")}</TabsTrigger>
        <TabsTrigger value="types">{t("tabs.types")}</TabsTrigger>
        <TabsTrigger value="thanks">{t("tabs.thanks")}</TabsTrigger>
      </TabsList>

      <TabsContent value="intro" className="pt-6 space-y-8">
        <p className={PROSE_CLASS}>{t("introSection.content")}</p>
        <div className="space-y-3">
          <p className={LABEL_CLASS}>{t("feedbackSection.title")}</p>
          <p className={PROSE_CLASS}>{t("feedbackSection.content")}</p>
          <p className="text-sm tracking-wider">
            <a href="mailto:feedback@hetu-music.com" className={LINK_CLASS}>
              feedback@hetu-music.com
            </a>
            <span
              aria-hidden
              className="mx-3 text-slate-300 dark:text-slate-600"
            >
              ·
            </span>
            <a
              href="https://weibo.com/u/3509434894"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {t("feedbackSection.weibo")}
            </a>
          </p>
        </div>
      </TabsContent>

      <TabsContent value="types" className="pt-6">
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
                  <div className={`text-sm font-semibold ${colors.text} mb-1`}>
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

      <TabsContent value="thanks" className="pt-6 space-y-8">
        <div className="space-y-3">
          <p className={LABEL_CLASS}>{t("thanksSection.title")}</p>
          <p className={PROSE_CLASS}>
            {t.rich("thanksSection.content", {
              highlight: (chunks) => (
                <span className="font-serif text-slate-900 dark:text-slate-50">
                  {chunks}
                </span>
              ),
            })}
          </p>
        </div>
        <div className="space-y-3">
          <p className={LABEL_CLASS}>{t("maintainersSection.title")}</p>
          <ContributorList query={contributorsQuery} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function useContributors(enabled: boolean) {
  return useQuery({
    queryKey: ["public", "contributors"],
    queryFn: async (): Promise<Contributor[]> => {
      const res = await fetch("/api/public/contributors");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return Array.isArray(data.contributors) ? data.contributors : [];
    },
    enabled,
  });
}

function ContributorList({
  query,
}: {
  query: ReturnType<typeof useContributors>;
}) {
  const t = useTranslations("common.about.maintainersSection");
  if (query.isLoading) return <p className={NOTE_CLASS}>{t("loading")}</p>;
  if (query.isError) return <p className={NOTE_CLASS}>{t("loadError")}</p>;
  const contributors = [...(query.data ?? [])].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
  );
  if (contributors.length === 0)
    return <p className={NOTE_CLASS}>{t("empty")}</p>;

  return (
    <dl className="space-y-4">
      {contributors.map((contributor, idx) => (
        <div key={idx}>
          <dt className="font-serif text-slate-800 dark:text-slate-200">
            {contributor.name ?? t("unknown")}
          </dt>
          {contributor.intro && (
            <dd className="mt-1 font-kaiti text-sm leading-[1.85] text-slate-500 dark:text-slate-400">
              {contributor.intro}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** 「关于」：宽屏是居中弹窗，窄屏是可以往下拖收起的底部面板，内容同一份 */
export default function About({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common.about");
  const isDesktop = useIsDesktop();
  const body = <AboutBody />;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={t("title")} description={t("description")}>
          <div className="h-[min(30rem,70dvh)] overflow-y-auto overscroll-contain px-6 pb-6">
            {body}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("title")}
        description={t("description")}
        className="h-[80dvh]"
      >
        {body}
      </DrawerContent>
    </Drawer>
  );
}
