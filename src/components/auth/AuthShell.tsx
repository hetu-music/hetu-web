"use client";

import {
  CoverStrip,
  CoverWall,
  GalleryQuote,
  useQuoteCycle,
} from "@/components/auth/AuthGallery";
import SiteMark from "@/components/shared/SiteMark";
import TopBar from "@/components/shared/topbar/TopBar";
import type { GallerySong } from "@/lib/auth-gallery";
import { cn } from "@/lib/utils/utils";
import { INK_TONE } from "@/lib/utils/utils-tone";
import { useTranslations } from "next-intl";
import React from "react";

/**
 * 登录、注册、找回密码共用的版式：宽屏左半边是缓缓漂移的封面墙，墙下轮换一句歌词，
 * 轮到哪首，墙上那张封面就恢复原色；右半边是题名与表单。
 * 窄屏封面收成顶部两行相向滚动的小图。
 */
export default function AuthShell({
  gallery,
  heading,
  subtitle,
  email,
  children,
}: {
  /** 封面墙与轮换摘句；取不到时为空，页面只剩表单 */
  gallery: GallerySong[];
  heading: string;
  subtitle: string;
  /** 填验证码等步骤里，副题下面写出验证码发到的邮箱 */
  email?: string;
  children: React.ReactNode;
}) {
  const tSite = useTranslations("common.site");
  const quote = useQuoteCycle(gallery);
  const hasGallery = gallery.length > 0;

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
      <TopBar exit={{ kind: "logo" }} user={false} />

      <div
        className={cn(
          "lg:grid lg:min-h-screen",
          hasGallery && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
        )}
      >
        {/* 宽屏左半边：封面墙，墙脚一句歌词；随页面固定，不跟着表单滚 */}
        {hasGallery && (
          <aside className="relative hidden lg:block lg:sticky lg:top-0 lg:h-screen">
            <CoverWall songs={gallery} activeId={quote?.id ?? null} />
            <div className="absolute inset-x-0 bottom-0 px-12 pb-16 xl:px-16">
              <GalleryQuote song={quote} size="lg" />
            </div>
          </aside>
        )}

        <div className="flex min-h-screen flex-col">
          {/* 窄屏：顶部两行封面，下面一句歌词 */}
          {hasGallery && (
            <div className="lg:hidden pt-24 animate-in fade-in duration-700">
              <CoverStrip songs={gallery} activeId={quote?.id ?? null} />
              <div className="px-6 pt-6">
                <GalleryQuote song={quote} size="sm" />
              </div>
            </div>
          )}

          <main
            className={cn(
              "flex flex-1 items-start lg:items-center px-6 pb-16 sm:px-10 animate-in fade-in slide-in-from-bottom-4 duration-700",
              hasGallery
                ? "pt-10 lg:px-16 lg:pt-28 xl:px-24"
                : "pt-32 md:pt-40 lg:justify-center",
            )}
          >
            <div className="w-full max-w-104">
              <header>
                <p className="text-xs tracking-[0.35em] text-(--tone) mb-5">
                  {tSite("name")}
                </p>
                <h1 className="font-serif text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50">
                  {heading}
                </h1>
                <p className="mt-5 font-kaiti text-[15px] leading-[2.05] text-slate-600 dark:text-slate-400">
                  {subtitle}
                </p>
                {email && (
                  <p className="mt-1 font-serif text-base text-slate-900 dark:text-slate-100 wrap-break-word">
                    {email}
                  </p>
                )}
              </header>

              <div className="mt-12">{children}</div>
            </div>
          </main>

          <footer
            className={cn(
              "px-6 pb-10 sm:px-10",
              hasGallery ? "lg:px-16 xl:px-24" : "lg:text-center",
            )}
          >
            <SiteMark />
          </footer>
        </div>
      </div>
    </div>
  );
}
