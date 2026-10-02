"use client";

/**
 * 《倾尽天下》滚动叙事的外壳：挂 canvas、DOM 文字层与 Lenis。
 * 画面全在引擎里；这里只按引擎每帧回传的状态摆放文字，不经 React 重渲染。
 */

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { useEffect, useMemo, useRef } from "react";
import { usePlayerStore } from "@/store/player-store";
import {
  createStoryEngine,
  type FrameState,
  type StoryEngine,
} from "./engine";
import { TIP } from "./engine/schedule";
import type { Scene, SpineConfig, StoryEvent, Style } from "./engine/types";
import scene28 from "./scenes/28.json";
import scene31 from "./scenes/31.json";
import spineJson from "./scenes/spine.json";
import styleJson from "./scenes/style.json";

gsap.registerPlugin(SplitText);

const SCENES = { "28": scene28, "31": scene31 } as unknown as Record<string, Scene>;

/** 文字入场时先是朱砂色的湿墨，再干成纸白 */
const INK_WET = "#8f2a2c";
const PAPER = "#ece5d8";

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function envelope(p: number) {
  return smooth(0, 0.22, p) * (1 - smooth(0.78, 1, p));
}

interface Props {
  events: StoryEvent[];
  /** 开发时把调参面板挂上 */
  tuner?: boolean;
}

export default function QjtxStory({ events, tuner = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const openingRef = useRef<HTMLDivElement>(null);
  const annalsRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef(new Map<string, HTMLDivElement>());
  const nodeRefs = useRef(new Map<number, HTMLDivElement>());

  // 调参面板会改这几份配置，所以各自深拷贝一份
  const config = useMemo(
    () => ({
      scenes: structuredClone(SCENES),
      spine: structuredClone(spineJson) as SpineConfig,
      style: structuredClone(styleJson) as Style,
    }),
    [],
  );

  const { pause, setPlayerVisible } = usePlayerStore();
  useEffect(() => {
    pause();
    setPlayerVisible(false);
    return () => setPlayerVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 各回里带文字的拍，预先排进 DOM，滚到时只改样式
  const textBeats = useMemo(() => {
    const list: {
      key: string;
      kind: "title" | "text" | "colophon";
      event: StoryEvent;
      vertical: boolean;
      lines: string[];
    }[] = [];
    for (const event of events) {
      const scene = config.scenes[String(event.id)];
      if (!scene || !event.detail) continue;
      scene.beats.forEach((beat, i) => {
        const key = `${scene.id}:${i}`;
        const vertical = !!beat.text?.vertical;
        if (beat.kind === "text" && beat.lines) {
          const [a, b] = beat.lines;
          list.push({
            key,
            kind: "text",
            event,
            vertical,
            lines: event.detail!.body.slice(a, b + 1),
          });
        } else if (beat.kind === "title") {
          list.push({
            key,
            kind: "title",
            event,
            vertical,
            lines: event.detail!.quote ? [event.detail!.quote] : [],
          });
        } else if (beat.kind === "colophon" && event.detail!.closing) {
          list.push({
            key,
            kind: "colophon",
            event,
            vertical,
            lines: [event.detail!.closing],
          });
        }
      });
    }
    return list;
  }, [events, config]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const html = document.documentElement;
    html.classList.add("qjtx-story-page");

    let engine: StoryEngine | null = null;
    let cancelled = false;
    let disposeTuner: (() => void) | null = null;

    // 每拍一条暂停的时间线，进度跟着拍走：倒着滚就倒着放
    const timelines = new Map<string, gsap.core.Timeline>();
    const splits: SplitText[] = [];
    for (const [key, el] of textRefs.current) {
      const body = el.querySelector<HTMLElement>("[data-body]");
      if (!body) continue;
      const split = SplitText.create(body, { type: "chars" });
      splits.push(split);
      const vertical = el.dataset.vertical === "true";
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(
        split.chars,
        {
          opacity: 0,
          color: INK_WET,
          x: vertical ? "-0.25em" : 0,
          y: vertical ? 0 : "0.3em",
        },
        {
          opacity: 1,
          color: PAPER,
          x: 0,
          y: 0,
          duration: 0.09,
          ease: "power2.out",
          stagger: { amount: 0.12 },
        },
        0.01,
      );
      tl.to(
        split.chars,
        {
          opacity: 0,
          duration: 0.08,
          ease: "power1.in",
          stagger: { amount: 0.1 },
        },
        0.8,
      );
      tl.set({}, {}, 1);
      timelines.set(key, tl);
    }

    let activeText: string | null = null;
    const vh = () => window.innerHeight;
    const listeners = new Set<(state: FrameState) => void>();

    const onFrame = (state: FrameState) => {
      for (const fn of listeners) fn(state);
      const { tip, worldPx, view, plate, opening, ending, text } = state;
      const H = view.height;

      // 开场题句
      const openingEl = openingRef.current;
      if (openingEl) {
        const o = 1 - smooth(0.2, 0.8, opening);
        openingEl.style.opacity = String(o);
        openingEl.style.transform = `translate(${tip.x}px, ${tip.y}px)`;
        openingEl.style.visibility = o > 0.001 ? "visible" : "hidden";
      }

      // 编年：整层随卷面走，节点按与笔尖的距离显隐
      const annals = annalsRef.current;
      if (annals) {
        annals.style.transform = `translate3d(0, ${-worldPx}px, 0)`;
        annals.style.opacity = String(1 - plate);
        const schedule = engine?.schedule;
        if (schedule) {
          for (const node of schedule.nodes) {
            const el = nodeRefs.current.get(node.event.id);
            if (!el) continue;
            const y = node.world * H - worldPx;
            if (y < -H * 0.5 || y > H * 1.5) {
              el.style.visibility = "hidden";
              continue;
            }
            const d = y - tip.y;
            const o =
              d > 0
                ? 0.1 + 0.55 * (1 - smooth(0, H * 0.45, d))
                : 1 - 0.6 * smooth(0, H * 0.5, -d);
            el.style.visibility = "visible";
            el.style.opacity = String(o);
            el.style.left = `${tip.x}px`;
            el.style.top = `${node.world * H}px`;
            el.dataset.passed = d <= 0 ? "true" : "false";
          }
        }
      }

      // 回内文字
      const key = text?.key ?? null;
      if (key !== activeText) {
        if (activeText) {
          const prev = textRefs.current.get(activeText);
          if (prev) prev.style.visibility = "hidden";
        }
        activeText = key;
      }
      if (text && key) {
        const el = textRefs.current.get(key);
        if (el) {
          el.style.visibility = "visible";
          const { rect } = text;
          if (text.kind === "title") {
            // 回目大字在 WebGL 里；这里只摆题句：竖排在左，横排在下
            el.style.left = `${text.vertical ? rect.x - 64 : rect.x}px`;
            el.style.top = `${text.vertical ? rect.y + rect.h * 0.08 : rect.y + rect.h + 18}px`;
            el.style.width = text.vertical ? "auto" : `${rect.w}px`;
            el.style.height = text.vertical ? `${rect.h * 0.84}px` : "auto";
          } else {
            el.style.left = `${rect.x}px`;
            el.style.top = `${rect.y}px`;
            el.style.width = `${rect.w}px`;
            el.style.height = `${rect.h}px`;
          }
          timelines.get(key)?.progress(text.progress);
          el.style.opacity = text.kind === "title" ? String(envelope(text.progress)) : "1";
        }
      }

      const endEl = endRef.current;
      if (endEl) endEl.style.opacity = String(smooth(0.2, 0.8, ending));
    };

    // 滚动：Lenis 平滑滚轮，触屏用原生惯性
    const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const sizeSpacer = () => {
      const spacer = spacerRef.current;
      if (spacer && engine) {
        spacer.style.height = `${(engine.schedule.total + 1) * vh()}px`;
      }
    };
    const onScroll = () => engine?.setPosition(window.scrollY / vh());
    lenis.on("scroll", onScroll);
    window.addEventListener("resize", sizeSpacer);

    (async () => {
      const keben = getComputedStyle(html).getPropertyValue("--font-keben").trim() || "serif";
      await Promise.all(
        events
          .filter((e) => e.detail)
          .map((e) =>
            document.fonts.load(`120px ${keben}`, e.detail!.title).catch(() => undefined),
          ),
      );
      if (cancelled) return;
      engine = await createStoryEngine(host, {
        events,
        scenes: config.scenes,
        spine: config.spine,
        style: config.style,
        glyphFont: keben,
        onFrame,
      });
      if (cancelled) {
        engine.destroy();
        return;
      }
      sizeSpacer();
      onScroll();
      if (tuner) {
        const { mountTuner } = await import("./dev/tuner");
        if (!cancelled && engine) {
          disposeTuner = mountTuner({
            engine,
            lenis,
            scenes: config.scenes,
            spine: config.spine,
            style: config.style,
            onRebuild: sizeSpacer,
            subscribe: (fn) => {
              listeners.add(fn);
              return () => listeners.delete(fn);
            },
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      disposeTuner?.();
      lenis.off("scroll", onScroll);
      lenis.destroy();
      gsap.ticker.remove(raf);
      window.removeEventListener("resize", sizeSpacer);
      for (const tl of timelines.values()) tl.kill();
      for (const split of splits) split.revert();
      engine?.destroy();
      html.classList.remove("qjtx-story-page");
    };
  }, [events, config, tuner]);

  const annals = events;

  return (
    <div className="relative bg-black text-[#ece5d8]">
      <style href="qjtx-story" precedence="default">{`
        html.qjtx-story-page, html.qjtx-story-page body {
          background: #000;
          scrollbar-width: none;
          scrollbar-gutter: auto;
        }
        html.qjtx-story-page::-webkit-scrollbar { display: none; }
        html.lenis.lenis-smooth { scroll-behavior: auto; }
        html.lenis.lenis-stopped { overflow: hidden; }
        .qjtx-node[data-passed="true"] .qjtx-dot { background: #8f1d22; border-color: #b4262c; box-shadow: 0 0 10px rgba(180,38,44,0.7); }
      `}</style>

      <div ref={hostRef} className="fixed inset-0 z-0" aria-hidden />

      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden font-serif">
        {/* 开场：题句在那一点朱砂上方 */}
        <div
          ref={openingRef}
          className="absolute top-0 left-0 will-change-transform"
          style={{ transform: `translate(50vw, ${TIP * 100}vh)` }}
        >
          <div className="absolute bottom-16 left-0 flex -translate-x-1/2 flex-col items-center gap-5 text-sm tracking-[0.8em] text-zinc-400 md:text-lg">
            <p className="whitespace-nowrap pl-[0.8em]">血染江山的画</p>
            <p className="whitespace-nowrap pl-[0.8em]">
              怎敌你眉间一点<span className="text-[#b4262c]">朱砂</span>
            </p>
          </div>
        </div>

        {/* 编年 */}
        <div ref={annalsRef} className="absolute inset-x-0 top-0 will-change-transform">
          {annals.map((event) => (
            <AnnalNode
              key={event.id}
              event={event}
              ref={(el) => {
                if (el) nodeRefs.current.set(event.id, el);
                else nodeRefs.current.delete(event.id);
              }}
            />
          ))}
        </div>

        {/* 回内文字 */}
        {textBeats.map((t) => (
          <div
            key={t.key}
            ref={(el) => {
              if (el) textRefs.current.set(t.key, el);
              else textRefs.current.delete(t.key);
            }}
            data-vertical={t.vertical ? "true" : "false"}
            className="absolute top-0 left-0"
            style={{ visibility: "hidden" }}
          >
            <div
              data-body
              className={
                t.kind === "title"
                  ? `font-kaiti text-[15px] tracking-[0.5em] text-zinc-300 md:text-[17px] ${t.vertical ? "[writing-mode:vertical-rl]" : "text-left"}`
                  : t.kind === "colophon"
                    ? "text-[12px] tracking-[0.4em] text-zinc-400 md:text-[13px]"
                    : `text-[clamp(15px,0.55vw+10px,20px)] font-light tracking-[0.2em] [text-shadow:0_0_14px_rgba(0,0,0,0.65)] ${t.vertical ? "h-full space-y-5 leading-[1.95] [writing-mode:vertical-rl]" : "space-y-2 leading-[2.1]"}`
              }
            >
              {t.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        <div
          ref={endRef}
          className="absolute inset-x-0 top-[44%] flex flex-col items-center gap-3 text-xs tracking-[0.5em] text-zinc-500"
          style={{ opacity: 0 }}
        >
          <p>打样至此</p>
          <p className="text-zinc-600">往回滚，检查倒放是否一致</p>
        </div>
      </div>

      <div ref={spacerRef} style={{ height: "300vh" }} />
    </div>
  );
}

function AnnalNode({
  event,
  ref,
}: {
  event: StoryEvent;
  ref: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={ref}
      className="qjtx-node absolute top-0"
      style={{ visibility: "hidden" }}
      data-id={event.id}
    >
      <NodePlacement event={event} />
    </div>
  );
}

/** 年月在线左，事在线右；节点那一点压在线上 */
function NodePlacement({ event }: { event: StoryEvent }) {
  return (
    <div className="relative">
      <div className="qjtx-dot absolute top-0 left-0 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-600 bg-black transition-colors duration-500" />
      <div className="absolute top-0 right-6 hidden -translate-y-1/2 text-right whitespace-nowrap md:block">
        <span className="text-base tracking-[0.3em] text-zinc-300 md:text-lg">{event.year}</span>
        {event.month && (
          <span className="ml-3 text-xs tracking-[0.3em] text-[#9b2a2e] md:text-sm">{event.month}</span>
        )}
      </div>
      <div className="absolute top-0 left-6 w-[min(22rem,60vw)] -translate-y-1/2 space-y-1 text-[13px] leading-[1.9] tracking-[0.18em] text-zinc-400 md:text-sm">
        <p className="text-zinc-300 md:hidden">
          {event.year}
          {event.month && <span className="ml-2 text-[#9b2a2e]">{event.month}</span>}
        </p>
        {event.content.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}
