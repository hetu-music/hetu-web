"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/ui/useIsDesktop";
import { Link } from "@/i18n/navigation";
import type { MotifDetail } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BracketButton, paletteAt, SectionLabel } from "./cloud";

/** 写法多的母题先列这么多，其余收起 */
const WORDS_FOLDED = 18;

export interface ImageryPanelProps {
  open: boolean;
  side: "left" | "right";
  motif: MotifDetail | null;
  loading: boolean;
  error: boolean;
  /** 只看用这种写法的作品；null 为全部 */
  word: number | null;
  onWord: (id: number | null) => void;
  onClose: () => void;
}

function PanelHeader({
  motif,
  isDesktop,
}: {
  motif: MotifDetail;
  isDesktop: boolean;
}) {
  const t = useTranslations("common.imagery.panel");
  const palette = paletteAt(motif.palette);
  const meta = (
    <div className="space-y-1">
      <p className="font-serif text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {motif.path.join(" · ")}
      </p>
      <p className="font-kaiti text-sm text-slate-600 dark:text-slate-300">
        {t("meta", { songs: motif.songCount, words: motif.words.length })}
      </p>
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="px-8 pt-3 pb-4 border-b border-slate-100/40 dark:border-slate-800/40 shrink-0">
        <h2
          className={`font-calligraphy text-3xl font-normal tracking-[0.2em] mb-1 ${palette.text}`}
        >
          {motif.name}
        </h2>
        {meta}
      </div>
    );
  }

  return (
    <div className="relative shrink-0 px-12 pt-10 pb-7 overflow-hidden border-b border-slate-100/40 dark:border-slate-800/40">
      {/* 背景里一个淡淡的大字 */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -bottom-6 -right-3 font-calligraphy leading-none"
        style={{
          fontSize: "11rem",
          opacity: 0.035,
          color: palette.accent,
          letterSpacing: "-0.05em",
        }}
      >
        {motif.name[0]}
      </span>
      <h2
        className={`font-calligraphy text-[3.2rem] leading-none font-normal tracking-[0.2em] mb-4 ${palette.text}`}
      >
        {motif.name}
      </h2>
      {meta}
      <div
        className="mt-5 h-[1.5px] w-12 rounded-full"
        style={{ backgroundColor: palette.accent, opacity: 0.6 }}
      />
    </div>
  );
}

function PanelBody({
  motif,
  loading,
  error,
  word,
  onWord,
  onClose,
}: Omit<ImageryPanelProps, "open" | "side">) {
  const t = useTranslations("common.imagery");
  const tCommon = useTranslations("common");
  const [unfolded, setUnfolded] = useState(false);
  const wordName = useMemo(
    () => new Map((motif?.words ?? []).map((w) => [w.id, w.name])),
    [motif],
  );

  if (error && !motif) {
    return (
      <p className="text-center font-kaiti text-sm py-16 text-slate-400 dark:text-slate-500">
        {t("panel.loadError")}
      </p>
    );
  }
  if (loading || !motif) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-[1.5px] border-solid border-slate-300 border-r-transparent" />
      </div>
    );
  }

  const palette = paletteAt(motif.palette);
  const works = word
    ? motif.works.filter((w) => w.wordIds.includes(word))
    : motif.works;
  const words = unfolded ? motif.words : motif.words.slice(0, WORDS_FOLDED);
  // 选中的写法收在折叠里时也要露出来
  const shown =
    word !== null && !words.some((w) => w.id === word)
      ? [...words, ...motif.words.filter((w) => w.id === word)]
      : words;

  return (
    <>
      {/* 写法：只有一种时不用筛 */}
      {motif.words.length > 1 && (
        <>
          <SectionLabel
            label={t("panel.words")}
            accent={palette.accent}
            compact
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-2">
            <BracketButton
              label={t("all")}
              size="text-[13px]"
              isActive={word === null}
              onClick={() => onWord(null)}
              accentColor={palette.accent}
            />
            {shown.map((w) => (
              <BracketButton
                key={w.id}
                label={w.name}
                size="text-[13px]"
                isActive={word === w.id}
                onClick={() => onWord(word === w.id ? null : w.id)}
                accentColor={palette.accent}
              />
            ))}
            {motif.words.length > WORDS_FOLDED && (
              <button
                type="button"
                onClick={() => setUnfolded((v) => !v)}
                className="text-[11px] tracking-widest text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors py-1"
              >
                {unfolded
                  ? t("panel.fold")
                  : t("panel.more", {
                      count: motif.words.length - WORDS_FOLDED,
                    })}
              </button>
            )}
          </div>
        </>
      )}

      {/* 作品 */}
      <div className="mt-2">
        <SectionLabel
          label={
            word !== null
              ? t("panel.worksOf", { name: wordName.get(word) ?? "" })
              : t("panel.works")
          }
          accent={palette.accent}
          compact
        />
        <div className="flex flex-col -mx-6 relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {works.map((song, i) => (
              <motion.div
                key={song.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    delay: Math.min(i, 24) * 0.02,
                    duration: 0.5,
                    ease: [0.23, 1, 0.32, 1],
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.2 },
                }}
                className="w-full"
              >
                <Link
                  href={`/song/${song.id}`}
                  onClick={onClose}
                  className="flex items-center justify-between py-4 px-6 border-b border-slate-100/80 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                >
                  <div className="min-w-0 pr-4">
                    <div className="font-serif text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate tracking-wide">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate tracking-wide">
                      {[
                        song.year,
                        song.lyricist?.join("  ·  ") || tCommon("unknown"),
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-all duration-300 transform group-hover:translate-x-0.5"
                  />
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

/** 点中一个意象后的面板：桌面从侧边滑出，手机是底部抽屉 */
export default function ImageryPanel(props: ImageryPanelProps) {
  const { open, side, motif, onClose } = props;
  const t = useTranslations("common.imagery");
  const isDesktop = useIsDesktop();
  const title = motif?.name ?? t("title");
  const description = motif
    ? t("panel.meta", { songs: motif.songCount, words: motif.words.length })
    : t("title");
  // 换母题时重置写法的折叠
  const body = <PanelBody key={motif?.id} {...props} />;

  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent
          // 意象页独有的半透明毛玻璃面板（DESIGN.md 第四节）
          className="h-[65dvh] bg-[#FAFAFA]/96 dark:bg-[#0B0F19]/96 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-700/50"
          contentClassName="flex flex-col overflow-hidden px-0 pb-0"
          transparentBackdrop
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
          {motif && <PanelHeader motif={motif} isDesktop={false} />}
          <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-4 pb-[env(safe-area-inset-bottom,1rem)]">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={side}
        className={`top-(--nav-h) h-[calc(100dvh-var(--nav-h))] w-[min(440px,42vw)] ${
          side === "right"
            ? "border-l border-slate-200/50 dark:border-white/5"
            : "border-r border-slate-200/50 dark:border-white/5"
        }`}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{description}</SheetDescription>
        {motif && <PanelHeader motif={motif} isDesktop />}
        <div className="flex-1 overflow-y-auto no-scrollbar px-12 pb-10">
          {body}
        </div>
      </SheetContent>
    </Sheet>
  );
}
