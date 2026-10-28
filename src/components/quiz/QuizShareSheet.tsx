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
  filename: string;
  blob: Blob | null;
  /** File / Web Share 不可用时仍能预览和保存图片。 */
  file: File | null;
  /** 系统分享面板能否直接收图片（iOS / Android 的浏览器可以，桌面和微信多半不行） */
  shareable: boolean;
};

function exportCard(canvas: HTMLCanvasElement, filename: string): Card {
  // 预览本来就需要 data URL；只编码一次，也不依赖部分 WebView 的 toBlob。
  const src = canvas.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  if (!src.startsWith(prefix) || src.length === prefix.length) {
    throw new Error("PNG 导出为空");
  }

  let blob: Blob | null = null;
  let file: File | null = null;
  let shareable = false;
  try {
    const binary = atob(src.slice(prefix.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: "image/png" });
    if (typeof File === "function") {
      file = new File([blob], filename, { type: "image/png" });
    }
  } catch (error) {
    console.warn("[QuizShareSheet] 文件封装不可用，保留图片预览", error);
  }
  if (file && typeof navigator.share === "function") {
    try {
      shareable = navigator.canShare?.({ files: [file] }) ?? false;
    } catch (error) {
      console.warn("[QuizShareSheet] 系统分享不可用，保留保存图片", error);
    }
  }
  return { src, filename, blob, file, shareable };
}

type CachedCard = {
  result: QuizResultView;
  locale: string;
  value: Card | "error";
};

export default function QuizShareSheet({ open, onOpenChange, result }: Props) {
  const t = useTranslations("quiz");
  const tSite = useTranslations("common.site");
  const locale = useLocale();
  const isDesktop = useIsDesktop();
  const { resolvedTheme } = useTheme();
  const theme: ShareCardTheme = resolvedTheme === "dark" ? "dark" : "light";

  // 深浅两种各画一次就留着，来回切主题不用重画
  const [cards, setCards] = useState<
    Partial<Record<ShareCardTheme, CachedCard>>
  >({});
  const [copied, setCopied] = useState(false);
  const cached = cards[theme];
  const card =
    cached?.result === result && cached.locale === locale
      ? cached.value
      : undefined;

  useEffect(() => {
    if (!open || card) return;
    let cancelled = false;
    let stage: "render" | "export" = "render";
    let size: { width: number; height: number } | undefined;

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
      profileLabel: t("result.profile"),
      dimensions: result.profile.map(({ label, z }) => ({ label, z })),
      imagery: result.imagery,
      matchesLabel: t("result.matches"),
      matchLabel: t("result.match"),
      matches: result.matches.map((m) => ({
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
      .then((canvas) => {
        stage = "export";
        size = { width: canvas.width, height: canvas.height };
        try {
          if (cancelled) return null;
          return exportCard(canvas, `hetu-quiz-${result.slug}.png`);
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(
            "[QuizShareSheet] 生成分享图失败",
            { stage, ...size },
            e,
          );
        }
        return "error" as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setCards((prev) => ({
            ...prev,
            [theme]: { result, locale, value: next },
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, theme, card, locale, result, t, tSite]);

  const download = useCallback(() => {
    if (!card || card === "error") return;
    let url: string | null = null;
    try {
      if (card.blob && typeof URL.createObjectURL === "function") {
        url = URL.createObjectURL(card.blob);
      }
    } catch (error) {
      console.warn("[QuizShareSheet] 下载改用图片地址", error);
    }
    const a = document.createElement("a");
    a.href = url ?? card.src;
    a.download = card.filename;
    a.style.display = "none";
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      // 先让浏览器接手下载，避免点击后同步撤销导致 WebView 读不到文件。
      if (url) {
        const objectUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      }
    }
  }, [card]);

  const shareImage = useCallback(async () => {
    if (!card || card === "error" || !card.file || !card.shareable) return;
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
