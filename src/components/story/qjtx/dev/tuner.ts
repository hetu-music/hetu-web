/**
 * 调参面板（只在开发时加载）：拖时间轴、逐拍改镜头与文字区、调墨与后期，改好写回 scenes/*.json。
 * 每回的镜头和节奏要靠反复看、反复调才出得来，这个面板决定最终质量的上限。
 */

import type Lenis from "lenis";
import { type FolderApi, Pane } from "tweakpane";
import type { FrameState, StoryEngine } from "../engine";
import { beatStart, locate } from "../engine/schedule";
import type { Beat, Scene, SpineConfig, Style } from "../engine/types";

interface TunerOptions {
  engine: StoryEngine;
  lenis: Lenis;
  scenes: Record<string, Scene>;
  spine: SpineConfig;
  style: Style;
  /** 时间轴长度变了，外壳要重算滚动高度 */
  onRebuild: () => void;
  subscribe: (fn: (state: FrameState) => void) => () => void;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function roundDeep<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "number" ? round(v) : v)),
  );
}

async function save(file: string, data: unknown) {
  const res = await fetch("/api/dev/qjtx-scene", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file, data: roundDeep(data) }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export function mountTuner(options: TunerOptions) {
  const { engine, lenis, scenes, spine, style } = options;
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    width: "300px",
    maxHeight: "calc(100vh - 24px)",
    overflowY: "auto",
    zIndex: "1000",
  });
  document.body.appendChild(container);
  const pane = new Pane({ container, title: "倾尽天下 · 调参" });

  // 叠加层：画中红线的路径、文字区、墨从哪里晕开
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "999",
  });
  document.body.appendChild(overlay);

  const vh = () => window.innerHeight;
  const status = { 位置: 0, 当前: "" };
  const flags = { 叠加层: false };

  // ── 时间轴 ──
  const timeline = pane.addFolder({ title: "时间轴" });
  timeline.addBinding(status, "当前", { readonly: true });
  const scrub = { 位置: 0 };
  const scrubBinding = timeline.addBinding(scrub, "位置", {
    min: 0,
    // 绑定建好后改不了上限；留出调长拍数的余量
    max: engine.schedule.total + 10,
    step: 0.01,
  });
  scrubBinding.on("change", (ev) => {
    // pane.refresh() 同步位置时也会触发 change，只有拖动造成的差值才跳
    if (Math.abs(ev.value - status.位置) > 0.005) {
      lenis.scrollTo(ev.value * vh(), { immediate: true, force: true });
    }
  });
  const jumpOptions: Record<string, string> = {};
  for (const scene of Object.values(scenes)) {
    scene.beats.forEach((beat, i) => {
      jumpOptions[`#${scene.id} · ${i} ${beat.kind}`] = `${scene.id}:${i}`;
    });
  }
  const jump = { 跳到: Object.values(jumpOptions)[0] };
  timeline
    .addBinding(jump, "跳到", { options: jumpOptions })
    .on("change", (ev) => {
      const [id, i] = ev.value.split(":").map(Number);
      const start = beatStart(engine.schedule, id, i);
      if (start !== null) {
        // 落在拍的四成处：停拍的画面已经稳住
        lenis.scrollTo((start + engine.schedule.entries.find((e) => e.start === start)!.length * 0.4) * vh(), {
          immediate: true,
          force: true,
        });
      }
    });
  timeline.addBinding(flags, "叠加层");

  // ── 当前拍：滚到哪拍就换成哪拍的参数 ──
  let beatFolder: FolderApi | null = null;
  let beatKey = "";
  const rebuild = () => {
    engine.rebuild();
    options.onRebuild();
  };

  const mountBeat = (scene: Scene, index: number) => {
    beatFolder?.dispose();
    const beat: Beat = scene.beats[index];
    const folder = pane.addFolder({ title: `当前拍 · #${scene.id} ${index} ${beat.kind}`, index: 1 });
    beatFolder = folder;
    folder.addBinding(beat, "length", { label: "屏数", min: 0.2, max: 4, step: 0.05 }).on("change", rebuild);
    if (beat.camera) {
      const cam = beat.camera;
      cam.ax ??= 0.5;
      cam.ay ??= 0.5;
      const f = folder.addFolder({ title: "镜头（本拍结束时）" });
      f.addBinding(cam, "x", { min: 0, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(cam, "y", { min: 0, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(cam, "zoom", { min: 0.8, max: 4, step: 0.01 }).on("change", rebuild);
      f.addBinding(cam, "ax", { label: "锚点 x", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
      f.addBinding(cam, "ay", { label: "锚点 y", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
    } else {
      folder.addButton({ title: "给本拍加镜头" }).on("click", () => {
        beat.camera = { x: 0.5, y: 0.5, zoom: 1.2 };
        mountBeat(scene, index);
      });
    }
    if (beat.text) {
      const t = beat.text;
      t.shade ??= 0.4;
      const f = folder.addFolder({ title: "文字区（图上比例）" });
      f.addBinding(t, "x", { min: 0, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(t, "y", { min: 0, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(t, "w", { min: 0.02, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(t, "h", { min: 0.02, max: 1, step: 0.005 }).on("change", rebuild);
      f.addBinding(t, "shade", { label: "压暗", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
    }
    folder.addButton({ title: `保存 #${scene.id}` }).on("click", () => {
      save(`${scene.id}.json`, scene).then(
        () => console.info(`[qjtx] 已写回 scenes/${scene.id}.json`),
        (error) => console.error(error),
      );
    });
  };

  // ── 本回 ──
  let sceneFolder: FolderApi | null = null;
  let sceneId = -1;
  const mountScene = (scene: Scene) => {
    sceneFolder?.dispose();
    const folder = pane.addFolder({ title: `本回 · #${scene.id}`, expanded: false, index: 2 });
    sceneFolder = folder;
    const g = scene.grade;
    folder.addBinding(g, "exposure", { label: "曝光", min: 0.5, max: 1.5, step: 0.01 }).on("change", rebuild);
    folder.addBinding(g, "contrast", { label: "对比", min: 0.7, max: 1.5, step: 0.01 }).on("change", rebuild);
    folder.addBinding(g, "saturation", { label: "饱和", min: 0, max: 1.5, step: 0.01 }).on("change", rebuild);
    folder.addBinding(scene, "parallax", { label: "视差", min: 0, max: 3, step: 0.05 }).on("change", rebuild);
    folder.addBinding(scene.atmosphere, "density", { label: "粒子密度", min: 0, max: 1.2, step: 0.05 }).on("change", rebuild);
  };

  // ── 墨与后期 ──
  const look = pane.addFolder({ title: "墨与后期", expanded: false });
  const applyStyle = () => engine.setStyle(style);
  look.addBinding(style.ink, "scale", { label: "墨·尺度", min: 40, max: 800, step: 5 }).on("change", applyStyle);
  look.addBinding(style.ink, "roughness", { label: "墨·起伏", min: 0, max: 1, step: 0.01 }).on("change", applyStyle);
  look.addBinding(style.ink, "rim", { label: "墨·积边", min: 0, max: 120, step: 1 }).on("change", applyStyle);
  look.addBinding(style.ink, "rimDarkness", { label: "墨·积边浓", min: 0, max: 1, step: 0.01 }).on("change", applyStyle);
  look.addBinding(style.ink, "wet", { label: "墨·湿", min: 0, max: 1, step: 0.01 }).on("change", applyStyle);
  look.addBinding(style.post, "bloom", { label: "辉光", min: 0, max: 2, step: 0.01 }).on("change", applyStyle);
  look.addBinding(style.post, "bloomThreshold", { label: "辉光阈值", min: 0, max: 1, step: 0.01 }).on("change", applyStyle);
  look.addBinding(style.post, "grain", { label: "颗粒", min: 0, max: 0.4, step: 0.005 }).on("change", applyStyle);
  look.addBinding(style.post, "vignette", { label: "暗角", min: 0, max: 1.2, step: 0.01 }).on("change", applyStyle);
  look.addButton({ title: "保存 style.json" }).on("click", () => {
    save("style.json", style).catch((error) => console.error(error));
  });

  // ── 线 ──
  const line = pane.addFolder({ title: "线", expanded: false });
  line.addBinding(spine, "eventLength", { label: "编年每条屏数", min: 0.3, max: 2, step: 0.05 }).on("change", rebuild);
  for (const [id, node] of Object.entries(spine.nodes)) {
    const f = line.addFolder({ title: `节点 #${id}`, expanded: false });
    node.width ??= 1.5;
    node.cinnabar ??= 0.5;
    node.tremor ??= 0.1;
    node.alpha ??= 1;
    f.addBinding(node, "width", { label: "宽", min: 0.5, max: 8, step: 0.1 }).on("change", rebuild);
    f.addBinding(node, "cinnabar", { label: "朱", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
    f.addBinding(node, "tremor", { label: "颤", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
    f.addBinding(node, "alpha", { label: "浓", min: 0, max: 1, step: 0.01 }).on("change", rebuild);
  }
  line.addButton({ title: "保存 spine.json" }).on("click", () => {
    save("spine.json", spine).catch((error) => console.error(error));
  });

  // ── 每帧：跟随位置换参数、画叠加层 ──
  const unsubscribe = options.subscribe((state) => {
    const position = window.scrollY / vh();
    status.位置 = position;
    scrub.位置 = position;
    const { entry, progress } = locate(engine.schedule, position);
    status.当前 =
      entry.kind === "chapter"
        ? `#${entry.scene!.id} ${entry.beatIndex} ${entry.beat!.kind} ${(progress * 100).toFixed(0)}%`
        : `${entry.kind}${entry.event ? ` #${entry.event.id}` : ""} ${(progress * 100).toFixed(0)}%`;
    pane.refresh();

    if (entry.kind === "chapter" && entry.scene) {
      const key = `${entry.scene.id}:${entry.beatIndex}`;
      if (key !== beatKey) {
        beatKey = key;
        mountBeat(entry.scene, entry.beatIndex!);
      }
      if (entry.scene.id !== sceneId) {
        sceneId = entry.scene.id;
        mountScene(entry.scene);
      }
    }

    overlay.innerHTML = "";
    if (!flags.叠加层 || !state.toScreen || entry.kind !== "chapter") return;
    const scene = entry.scene!;
    const ns = "http://www.w3.org/2000/svg";
    if (scene.thread) {
      const d = scene.thread
        .map(([u, v], i) => {
          const [x, y] = state.toScreen!(u, v);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join("");
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#00e5ff");
      path.setAttribute("stroke-width", "1");
      overlay.appendChild(path);
    }
    for (const beat of scene.beats) {
      if (!beat.text) continue;
      const [x0, y0] = state.toScreen(beat.text.x, beat.text.y);
      const [x1, y1] = state.toScreen(beat.text.x + beat.text.w, beat.text.y + beat.text.h);
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(x0));
      rect.setAttribute("y", String(y0));
      rect.setAttribute("width", String(x1 - x0));
      rect.setAttribute("height", String(y1 - y0));
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", beat === entry.beat ? "#ffd400" : "rgba(255,212,0,0.25)");
      rect.setAttribute("stroke-dasharray", "4 3");
      overlay.appendChild(rect);
    }
    if (scene.inkOrigin) {
      const [x, y] = state.toScreen(scene.inkOrigin[0], scene.inkOrigin[1]);
      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      dot.setAttribute("r", "5");
      dot.setAttribute("fill", "none");
      dot.setAttribute("stroke", "#ff3df0");
      overlay.appendChild(dot);
    }
  });

  return () => {
    unsubscribe();
    pane.dispose();
    container.remove();
    overlay.remove();
  };
}
