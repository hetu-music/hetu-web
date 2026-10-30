"use client";

import CommentGutter from "@/components/detail/comments/CommentGutter";
import { useComments } from "@/components/detail/comments/CommentsContext";
import SectionHeading from "@/components/detail/SectionHeading";
import { NAV_HEIGHT } from "@/components/shared/nav-button";
import type { SongDetail } from "@/lib/types";
import { countThreads, SCORE_SLOT } from "@/lib/utils/utils-comments";
import { getNmnUrl } from "@/lib/utils/utils-song";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";

const SLOTS = [SCORE_SLOT];

/**
 * 默认只露出上半截，展开与否记在 localStorage 里，各首歌共用：
 * 看谱的人展开一次，之后每首都是全谱，不用每回再点
 */
const EXPANDED_KEY = "__hetu_web_score_expanded";
const listeners = new Set<() => void>();

function subscribeExpanded(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readExpanded() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeExpanded(expanded: boolean) {
  try {
    if (expanded) localStorage.setItem(EXPANDED_KEY, "1");
    else localStorage.removeItem(EXPANDED_KEY);
  } catch {
    // 存不下就只管这一次
  }
  listeners.forEach((l) => l());
}

/** 乐谱：批注挂在乐谱整体上，宽屏写在左栏，窄屏从题头打开 */
export default function ScoreSection({
  song,
  onOpen,
}: {
  song: SongDetail;
  onOpen: () => void;
}) {
  const t = useTranslations("song");
  const [failed, setFailed] = useState(false);
  const { threads, setOpenSlot, setSheetSlot } = useComments();
  const bodyRef = useRef<HTMLDivElement>(null);
  const count = countThreads(threads.get(SCORE_SLOT.key));
  // 服务端与水合时一律按收起渲染，挂载后再按记下的偏好展开
  const expanded = useSyncExternalStore(
    subscribeExpanded,
    readExpanded,
    () => false,
  );

  const collapse = () => {
    writeExpanded(false);
    // 读到谱子下半截时收起，后文会整段上移；把乐谱顶端拉回顶栏下面，免得跳到别处
    const el = bodyRef.current;
    if (el && el.getBoundingClientRect().top < NAV_HEIGHT) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT,
      });
    }
  };

  return (
    <section id="score" className="py-16 md:py-20">
      <SectionHeading label={t("sections.score")}>
        <button
          type="button"
          onClick={() => setSheetSlot(SCORE_SLOT)}
          className="lg:hidden text-xs tracking-widest text-(--tone)"
        >
          {t("folio.comments.annotate")}
          {count > 0 && ` ${count}`}
        </button>
      </SectionHeading>
      <div ref={bodyRef} className="relative mt-12">
        <CommentGutter slots={SLOTS} containerRef={bodyRef} />
        <div
          data-comment-slot={SCORE_SLOT.key}
          className="group/score relative lg:ml-[26rem]"
        >
          <span className="absolute -left-12 top-0 hidden lg:block">
            <button
              type="button"
              onClick={() => setOpenSlot(SCORE_SLOT.key)}
              aria-label={t("folio.comments.annotateScore")}
              className="font-kaiti text-sm text-(--tone) opacity-0 group-hover/score:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity"
            >
              {t("folio.comments.add")}
            </button>
          </span>
          {failed ? (
            <p className="py-16 text-center text-sm text-slate-400">
              {t("scoreLoadError")}
            </p>
          ) : expanded ? (
            <>
              <button
                type="button"
                onClick={onOpen}
                aria-label={t("zoomScore")}
                className="block w-full cursor-zoom-in overflow-hidden rounded-md bg-white ring-1 ring-slate-900/5 dark:ring-white/10"
              >
                <Image
                  src={getNmnUrl(song)}
                  alt="Score"
                  width={800}
                  height={600}
                  className="w-full h-auto dark:opacity-90"
                  onError={() => setFailed(true)}
                />
              </button>
              <div className="mt-4 flex justify-between text-xs tracking-[0.3em] text-slate-500">
                <span>{t("zoomScore")}</span>
                <button
                  type="button"
                  onClick={collapse}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {t("collapseScore")}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => writeExpanded(true)}
              className="group relative block w-full max-h-[28rem] overflow-hidden rounded-md bg-white ring-1 ring-slate-900/5 dark:ring-white/10"
            >
              <Image
                src={getNmnUrl(song)}
                alt="Score"
                width={800}
                height={600}
                className="w-full h-auto dark:opacity-90"
                onError={() => setFailed(true)}
              />
              <span className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-5">
                <span className="text-xs tracking-[0.3em] text-slate-500 group-hover:text-slate-900 transition-colors">
                  {t("expandScore")}
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
