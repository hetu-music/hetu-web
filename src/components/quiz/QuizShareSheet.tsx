"use client";

import {
  PRIMARY_BUTTON_CLASS,
  TEXT_BUTTON_CLASS,
} from "@/components/shared/text-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { getPathname } from "@/i18n/navigation";
import {
  renderShareCard,
  type ShareCardInput,
  type ShareCardTheme,
} from "@/lib/quiz/share-card";
import type { QuizResultView } from "@/lib/quiz/views";
import { copyPageLink } from "@/lib/utils/share";
import { getCoverUrl } from "@/lib/utils/utils-song";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: QuizResultView;
}

type Card = {
  /** 预览用 data URL：微信内置浏览器长按识别、保存 blob: 地址的图片不可靠 */
  src: string;
  file: File;
  /** 系统分享面板能否直接收图片（iOS / Android 的浏览器可以，桌面和微信多半不行） */
  shareable: boolean;
};

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("导出图片失败"))),
      "image/png",
    ),
  );
}

export default function QuizShareSheet({ open, onOpenChange, result }: Props) {
  const t = useTranslations("quiz");
  const tSite = useTranslations("common.site");
  const locale = useLocale();
  const isDesktop = useIsDesktop();
  const { resolvedTheme } = useTheme();
  const theme: ShareCardTheme = resolvedTheme === "dark" ? "dark" : "light";

  // 深浅两种各画一次就留着，来回切主题不用重画
  const [cards, setCards] = useState<
    Partial<Record<ShareCardTheme, Card | "error">>
  >({});
  const [copied, setCopied] = useState(false);
  const card = cards[theme];

  useEffect(() => {
    if (!open || cards[theme]) return;
    let cancelled = false;

    const path = getPathname({ href: "/quiz", locale });
    const host = window.location.host.replace(/^www\./, "");
    const input: ShareCardInput = {
      eyebrow: t("result.eyebrow"),
      motto: result.persona.motto,
      secondary: result.secondary
        ? t("result.secondary", { motto: result.secondary.motto })
        : null,
      description: result.persona.description,
      imageryLabel: t("result.imagery"),
      imagery: result.imagery,
      matchesLabel: t("result.matches"),
      matchLabel: t("result.match"),
      matches: result.matches.slice(0, 3).map((m) => ({
        title: m.song.title,
        meta: [m.song.artist?.join(" / "), m.song.album]
          .filter(Boolean)
          .join(" · "),
        percent: m.percent,
        coverUrl: getCoverUrl(m.song),
        lyric: m.lines[0] ?? null,
      })),
      siteName: tSite("name"),
      scanHint: t("card.scan"),
      qrUrl: `${window.location.origin}${path}`,
      displayUrl: `${host}${path}`,
    };

    renderShareCard(input, theme)
      .then(async (canvas) => {
        const blob = await canvasToBlob(canvas);
        const file = new File([blob], `hetu-quiz-${result.code}.png`, {
          type: "image/png",
        });
        const shareable = navigator.canShare?.({ files: [file] }) ?? false;
        return { src: canvas.toDataURL("image/png"), file, shareable };
      })
      .catch((e) => {
        console.error("[QuizShareSheet] 生成分享图失败", e);
        return "error" as const;
      })
      .then((next) => {
        if (!cancelled) setCards((prev) => ({ ...prev, [theme]: next }));
      });

    return () => {
      cancelled = true;
    };
  }, [open, theme, cards, locale, result, t, tSite]);

  const download = useCallback(() => {
    if (!card || card === "error") return;
    const url = URL.createObjectURL(card.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = card.file.name;
    a.click();
    URL.revokeObjectURL(url);
  }, [card]);

  const shareImage = useCallback(async () => {
    if (!card || card === "error") return;
    try {
      await navigator.share({ files: [card.file] });
    } catch {
      // 用户关掉分享面板也会走到这里，不当作出错
    }
  }, [card]);

  const copyLink = useCallback(async () => {
    if ((await copyPageLink()) !== "copied") return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const ready = card && card !== "error" ? card : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("card.title")}
      className="max-w-md"
      footer={
        <>
          <button onClick={copyLink} className={TEXT_BUTTON_CLASS}>
            {copied ? t("result.copied") : t("card.copyLink")}
          </button>
          <button
            onClick={download}
            disabled={!ready}
            className={
              ready?.shareable ? TEXT_BUTTON_CLASS : PRIMARY_BUTTON_CLASS
            }
          >
            {t("card.save")}
          </button>
          {ready?.shareable && (
            <button onClick={shareImage} className={PRIMARY_BUTTON_CLASS}>
              {t("card.share")}
            </button>
          )}
        </>
      }
    >
      <div className="flex min-h-[40dvh] flex-col items-center justify-center">
        {ready ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL，交给 next/image 没有意义 */}
            <img
              src={ready.src}
              alt={t("card.alt", { motto: result.persona.motto })}
              className="max-h-[55dvh] w-auto rounded-md ring-1 ring-slate-900/5 dark:ring-white/10"
            />
            {!isDesktop && (
              <p className="mt-4 font-kaiti text-sm text-slate-400">
                {t("card.hint")}
              </p>
            )}
          </>
        ) : (
          <p className="font-kaiti text-slate-400">
            {card === "error" ? t("card.failed") : t("card.generating")}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
