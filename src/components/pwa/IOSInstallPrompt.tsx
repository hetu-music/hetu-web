"use client";

import { Drawer, DrawerClose, DrawerContent } from "@/components/ui/drawer";
import { type LucideIcon, PlusSquare, Share } from "lucide-react";
import { useTranslations } from "next-intl";

const NUMERALS = ["一", "二", "三"];

/**
 * iOS 不支持网页直接发起安装，只能教用户自己从浏览器菜单里添加。
 * 引号里的词照搬系统界面上的原词（简体系统叫「共享」，繁体叫「分享」），
 * 用户对着屏幕找得到；旁边的图标也照系统按钮的样子画。
 */
export default function IOSInstallPrompt({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common.installGuide");

  const steps: { text: string; hint?: string; icon?: LucideIcon }[] = [
    { text: t("step1"), hint: t("hint1"), icon: Share },
    { text: t("step2"), hint: t("hint2"), icon: PlusSquare },
    { text: t("step3") },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={t("title")} className="mx-auto max-w-md">
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {t("intro")}
        </p>

        <ol className="mt-5 space-y-4">
          {steps.map(({ text, hint, icon: Icon }, i) => (
            <li key={i} className="flex gap-4">
              <span className="w-4 shrink-0 font-serif text-sm leading-6 text-(--tone)">
                {NUMERALS[i]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm leading-6 text-slate-800 dark:text-slate-200">
                  {text}
                  {Icon && (
                    <Icon
                      size={16}
                      aria-hidden
                      className="shrink-0 text-slate-400 dark:text-slate-500"
                    />
                  )}
                </p>
                {hint && (
                  <p className="mt-0.5 text-xs leading-5 text-slate-400 dark:text-slate-500">
                    {hint}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex justify-end">
          <DrawerClose className="py-2 text-xs tracking-widest text-(--tone) transition-opacity hover:opacity-70">
            {t("done")}
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
