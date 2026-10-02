/**
 * 滚动叙事引擎：把滚动位置（屏）换算成一帧的全部状态——镜头、线、墨、氛围、文字——再画出来。
 * 状态只由位置决定（外加用于氛围的时间），倒着滚与正着滚看到的完全一样。
 * DOM 文字由组件按 onFrame 回传的状态摆放，引擎只管画面。
 */

import gsap from "gsap";
import {
  OrthographicCamera,
  Scene as ThreeScene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { createAssets, MANIFEST } from "./assets";
import { createAtmosphere } from "./atmosphere";
import { createGlyph } from "./glyphs";
import { createPlate } from "./plate";
import { createPost } from "./post";
import {
  buildSchedule,
  type Entry,
  type Located,
  locate,
  type Schedule,
  TIP,
} from "./schedule";
import { createSpine, type SpinePoint } from "./spine";
import type {
  Beat,
  CameraState,
  Scene,
  SpineConfig,
  SpineState,
  StoryEvent,
  Style,
} from "./types";

// ── 小工具 ────────────────────────────────────────────────────────────────

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 一维值噪声，线的颤动用 */
function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

const HOLD_KINDS = new Set<Beat["kind"]>(["title", "text", "colophon", "silence"]);

/** 拍内文字的显隐：进 0–22%，停，出 78–100% */
export function textEnvelope(progress: number) {
  return smooth(0, 0.22, progress) * (1 - smooth(0.78, 1, progress));
}

export interface ResolvedCamera extends Required<CameraState> {
  /** 整张图在屏幕上的尺寸，CSS 像素 */
  sx: number;
  sy: number;
}

export interface FrameText {
  key: string;
  kind: "title" | "text" | "colophon";
  event: StoryEvent;
  beat: Beat;
  /** 屏幕上的矩形，CSS 像素 */
  rect: { x: number; y: number; w: number; h: number };
  vertical: boolean;
  progress: number;
}

export interface FrameState {
  located: Located;
  view: { width: number; height: number };
  /** 卷面已走过的距离，CSS 像素 */
  worldPx: number;
  tip: { x: number; y: number };
  /** 开场走到几成；过了开场为 1 */
  opening: number;
  /** 结尾走到几成；没到为 0 */
  ending: number;
  /** 插图露出了多少，0..1 */
  plate: number;
  text: FrameText | null;
  camera: ResolvedCamera | null;
  toScreen: ((u: number, v: number) => [number, number]) | null;
}

export interface StoryEngineOptions {
  events: StoryEvent[];
  scenes: Record<string, Scene>;
  spine: SpineConfig;
  style: Style;
  /** 刻本字体的 font-family，画回目大字用 */
  glyphFont: string;
  onFrame: (state: FrameState) => void;
}

export interface StoryEngine {
  readonly schedule: Schedule;
  setPosition: (screens: number) => void;
  /** 场景或线的配置改了（调参面板），重排时间轴 */
  rebuild: () => void;
  setStyle: (style: Style) => void;
  destroy: () => void;
}

export async function createStoryEngine(
  host: HTMLElement,
  options: StoryEngineOptions,
): Promise<StoryEngine> {
  const { events, scenes, spine: spineConfig } = options;
  let style = options.style;

  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const scene = new ThreeScene();
  // 像素相机：y 向下，与 DOM 坐标一致
  const camera = new OrthographicCamera(0, 1, 0, 1, -10, 10);

  const plate = createPlate(style);
  const spine = createSpine();
  const atmosphere = createAtmosphere();
  scene.add(plate.mesh, atmosphere.points, spine.mesh, spine.tip);

  const glyphs = new Map<number, ReturnType<typeof createGlyph>>();
  for (const s of Object.values(scenes)) {
    const event = events.find((e) => e.id === s.id);
    const titleBeat = s.beats.find((b) => b.kind === "title");
    if (!event?.detail || !titleBeat) continue;
    const glyph = createGlyph(
      event.detail.title,
      options.glyphFont,
      !!titleBeat.text?.vertical,
      s.titleColor ?? "#f2ede4",
      s.id * 0.37,
    );
    glyphs.set(s.id, glyph);
    scene.add(glyph.mesh);
  }

  const post = createPost(renderer, scene, camera, style);
  const assets = createAssets(renderer);

  let schedule = buildSchedule(events, scenes, spineConfig);
  let view = { width: 1, height: 1, dpr: 1 };
  let position = 0;
  let dirty = true;
  let lastMove = performance.now();
  let destroyed = false;

  // ── 尺寸 ──────────────────────────────────────────────────────────────
  const resize = () => {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view = { width, height, dpr };
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    post.setSize(width, height);
    camera.right = width;
    camera.bottom = height;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // ── 素材：打样只有两回，开场时一并取来 ──────────────────────────────
  const neededWidth = (s: Scene) => {
    const asset = MANIFEST[s.image];
    if (!asset) return 1280;
    const aspect = asset.width / asset.height;
    const s0 = Math.max(view.width / aspect, view.height);
    const maxZoom = Math.max(...s.beats.map((b) => b.camera?.zoom ?? 1));
    return aspect * s0 * maxZoom * view.dpr;
  };
  for (const s of Object.values(scenes)) {
    assets
      .load(s.image, neededWidth(s))
      .then(() => (dirty = true))
      .catch((error) => console.error("[qjtx] 素材加载失败", error));
  }

  // ── 线的样子：按节点插值 ──────────────────────────────────────────────
  let spineKeys: { world: number; state: SpineState }[] = [];
  const buildSpineKeys = () => {
    let state = { ...spineConfig.opening };
    spineKeys = [{ world: TIP, state }];
    for (const node of schedule.nodes) {
      state = { ...state, ...spineConfig.nodes[String(node.event.id)] };
      spineKeys.push({ world: node.world, state });
    }
  };
  buildSpineKeys();

  const stateAt = (world: number): SpineState => {
    const keys = spineKeys;
    if (world <= keys[0].world) return keys[0].state;
    for (let i = 1; i < keys.length; i++) {
      if (world <= keys[i].world) {
        const a = keys[i - 1];
        const b = keys[i];
        const t = smooth(a.world, b.world, world);
        return {
          width: lerp(a.state.width, b.state.width, t),
          cinnabar: lerp(a.state.cinnabar, b.state.cinnabar, t),
          tremor: lerp(a.state.tremor, b.state.tremor, t),
          alpha: lerp(a.state.alpha, b.state.alpha, t),
        };
      }
    }
    return keys[keys.length - 1].state;
  };

  // ── 镜头 ──────────────────────────────────────────────────────────────
  const cameraOf = (s: Scene, index: number): CameraState => {
    for (let i = index; i >= 0; i--) {
      const c = s.beats[i].camera;
      if (c) return c;
    }
    return { x: 0.5, y: 0.5, zoom: 1 };
  };

  const resolveCamera = (s: Scene, index: number, progress: number) => {
    const asset = MANIFEST[s.image];
    const aspect = asset ? asset.width / asset.height : 16 / 9;
    const beat = s.beats[index];
    const from = cameraOf(s, Math.max(index - 1, 0));
    const to = cameraOf(s, index);
    const t = HOLD_KINDS.has(beat.kind)
      ? easeInOut(clamp(progress / 0.3))
      : easeInOut(progress);
    const ax = lerp(from.ax ?? 0.5, to.ax ?? 0.5, t);
    const ay = lerp(from.ay ?? 0.5, to.ay ?? 0.5, t);
    const zoom = Math.exp(lerp(Math.log(from.zoom), Math.log(to.zoom), t));
    const { width: W, height: H } = view;
    const s0 = Math.max(W / aspect, H);
    const sx = aspect * s0 * zoom;
    const sy = s0 * zoom;
    // 画面不能露出图外的黑边
    const fitX = (v: number) => {
      const lo = (ax * W) / sx;
      const hi = 1 - ((1 - ax) * W) / sx;
      return lo > hi ? 0.5 : clamp(v, lo, hi);
    };
    const fitY = (v: number) => {
      const lo = (ay * H) / sy;
      const hi = 1 - ((1 - ay) * H) / sy;
      return lo > hi ? 0.5 : clamp(v, lo, hi);
    };
    const x = fitX(lerp(from.x, to.x, t));
    const y = fitY(lerp(from.y, to.y, t));
    const cam: ResolvedCamera = { x, y, zoom, ax, ay, sx, sy };
    const toScreen = (u: number, v: number): [number, number] => [
      ax * W + (u - x) * sx,
      ay * H + (v - y) * sy,
    ];
    return { cam, toScreen };
  };

  const rectOnScreen = (
    toScreen: (u: number, v: number) => [number, number],
    r: { x: number; y: number; w: number; h: number },
  ) => {
    const [x0, y0] = toScreen(r.x, r.y);
    const [x1, y1] = toScreen(r.x + r.w, r.y + r.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  // ── 画中红线：Catmull-Rom 取样 ────────────────────────────────────────
  const samplePath = (path: [number, number][], count: number) => {
    const pts: [number, number][] = [];
    const seg = path.length - 1;
    for (let i = 0; i < count; i++) {
      const g = (i / (count - 1)) * seg;
      const k = Math.min(Math.floor(g), seg - 1);
      const t = g - k;
      const p0 = path[Math.max(k - 1, 0)];
      const p1 = path[k];
      const p2 = path[k + 1];
      const p3 = path[Math.min(k + 2, seg)];
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (-a + 3 * b - 3 * c + d) * t * t * t);
      pts.push([
        cr(p0[0], p1[0], p2[0], p3[0]),
        cr(p0[1], p1[1], p2[1], p3[1]),
      ]);
    }
    return pts;
  };

  // ── 一帧 ──────────────────────────────────────────────────────────────
  const frame = (time: number): { state: FrameState; animating: boolean } => {
    const located = locate(schedule, position);
    const { entry, progress: p } = located;
    const { width: W, height: H } = view;
    const worldPx = located.world * H;
    const narrow = W < 768;
    const tip = { x: narrow ? Math.max(56, W * 0.14) : W / 2, y: TIP * H };
    const idle = (performance.now() - lastMove) / 1000;

    const opening = entry.kind === "opening" ? p : 1;
    const ending = entry.kind === "end" ? p : 0;

    let plateReveal = 0;
    let spineOpacity = 1;
    let text: FrameText | null = null;
    let cam: ResolvedCamera | null = null;
    let toScreen: FrameState["toScreen"] = null;
    let morph: { pts: [number, number][]; m: number } | null = null;
    let tipAt = tip;

    const chapter: Entry | null = entry.kind === "chapter" ? entry : null;
    const s = chapter?.scene ?? null;
    const loaded = s ? assets.get(s.image) : null;

    for (const [id, glyph] of glyphs) if (id !== s?.id) glyph.hide();

    if (chapter && s && chapter.beat && chapter.beatIndex !== undefined) {
      const beat = chapter.beat;
      const resolved = resolveCamera(s, chapter.beatIndex, p);
      cam = resolved.cam;
      toScreen = resolved.toScreen;
      const cover = Math.hypot(Math.max(tip.x, W - tip.x), Math.max(tip.y, H - tip.y)) * 1.35;
      let radius = cover * 3;
      let reveal = 1;

      if (beat.kind === "come") {
        reveal = 0;
      } else if (beat.kind === "open") {
        if (beat.cut === "ink") {
          radius = cover * easeInOut(smooth(0.04, 1, p));
          spineOpacity = 1 - smooth(0, 0.35, p);
        } else if (beat.cut === "thread") {
          reveal = 0.35 * smooth(0.05, 0.35, p) + 0.65 * smooth(0.6, 0.92, p);
          spineOpacity = 1 - smooth(0.86, 0.98, p);
          if (s.thread) {
            const m = easeInOut(smooth(0.15, 0.62, p));
            morph = {
              pts: samplePath(s.thread, 160).map(([u, v]) => toScreen!(u, v)),
              m,
            };
          }
        } else if (beat.cut === "hard") {
          reveal = p > 0.5 ? 1 : 0;
          spineOpacity = 1 - reveal;
        } else {
          reveal = p;
          spineOpacity = 1 - p;
        }
      } else if (beat.kind === "close") {
        if (beat.cut === "ink") {
          radius = cover * (1 - easeInOut(smooth(0, 0.92, p)));
        } else {
          reveal = 1 - p;
        }
        spineOpacity = smooth(0.5, 0.95, p);
      } else {
        spineOpacity = 0;
      }

      const node = schedule.nodes.find((n) => n.event.id === s.id);
      const nodeState = stateAt(node?.world ?? TIP);
      const inkCenter = s.inkOrigin ? toScreen(s.inkOrigin[0], s.inkOrigin[1]) : [tip.x, tip.y];
      const tint: [number, number, number] = [
        lerp(0.5, 0.72, nodeState.cinnabar),
        lerp(0.52, 0.07, nodeState.cinnabar),
        lerp(0.56, 0.1, nodeState.cinnabar),
      ];

      // 视差：镜头相对开场那一镜走了多远，近处就多走多少；停着时也有极轻的呼吸
      const base = cameraOf(s, 1);
      const breath = s.parallax * 0.004;
      const shift: [number, number] = [
        -s.parallax * 0.08 * (cam.x - base.x) + breath * Math.sin(time * 0.23),
        -s.parallax * 0.08 * (cam.y - base.y) + breath * Math.cos(time * 0.19),
      ];
      const dolly = s.parallax * 0.12 * Math.log(cam.zoom / base.zoom);

      // 文字与文字后的压暗
      let shadeRect: [number, number, number, number] = [0, 0, 0, 0];
      let shade = 0;
      if (HOLD_KINDS.has(beat.kind) && beat.text) {
        const rect = rectOnScreen(toScreen, beat.text);
        const envelope = textEnvelope(p);
        if (beat.kind !== "silence") {
          text = {
            key: `${s.id}:${chapter.beatIndex}`,
            kind: beat.kind as FrameText["kind"],
            event: chapter.event!,
            beat,
            rect,
            vertical: !!beat.text.vertical,
            progress: p,
          };
        }
        const pad = 28;
        shadeRect = [rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2];
        shade = (beat.text.shade ?? 0) * envelope;
      }

      const glyph = glyphs.get(s.id);
      if (glyph) {
        if (beat.kind === "title" && beat.text) {
          glyph.update(
            rectOnScreen(toScreen, beat.text),
            smooth(0.04, 0.45, p),
            smooth(0.74, 0.98, p),
            view.dpr,
          );
        } else glyph.hide();
      }

      plate.setImage(loaded?.image ?? null, loaded?.depth ?? null, s.grade);
      plate.update({
        view,
        anchor: [cam.ax * W, cam.ay * H],
        camUV: [cam.x, cam.y],
        scale: [cam.sx, cam.sy],
        shift,
        dolly,
        ink: {
          x: inkCenter[0],
          y: inkCenter[1],
          radius,
          seed: beat.kind === "close" ? s.id + 0.5 : s.id,
          tint,
        },
        reveal,
        shadeRect,
        shade,
      });
      plateReveal = reveal * clamp(radius / cover);
      if (beat.kind === "open" && beat.cut === "thread" && morph) {
        tipAt = { x: lerp(tip.x, morph.pts[morph.pts.length - 1][0], morph.m), y: lerp(tip.y, morph.pts[morph.pts.length - 1][1], morph.m) };
      }
    } else {
      plate.setImage(null, null);
      plate.update({
        view,
        anchor: [0, 0],
        camUV: [0.5, 0.5],
        scale: [1, 1],
        shift: [0, 0],
        dolly: 0,
        ink: { x: 0, y: 0, radius: 0, seed: 0, tint: [0, 0, 0] },
        reveal: 0,
        shadeRect: [0, 0, 0, 0],
        shade: 0,
      });
    }

    // ── 线 ──
    const lineTop = TIP * H - worldPx;
    const points: SpinePoint[] = [];
    const tipWorld = located.world + TIP;
    if (morph) {
      // 线入画：竖线逐点弯向画中红线
      const count = morph.pts.length;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const vx = tip.x;
        const vy = lerp(Math.max(lineTop, -24), tip.y, t);
        const [tx, ty] = morph.pts[i];
        points.push({
          x: lerp(vx, tx, morph.m),
          y: lerp(vy, ty, morph.m),
          state: stateAt(tipWorld),
        });
      }
    } else if (tip.y - lineTop > 1) {
      const step = 6;
      const top = Math.max(lineTop, -24);
      for (let y = top; y <= tip.y + 0.01; y += step) {
        const w = (y + worldPx) / H;
        const st = stateAt(w);
        const wobble = st.tremor * 3.2 * noise1((y + worldPx) * 0.012) + st.tremor * 1.2 * noise1((y + worldPx) * 0.09);
        points.push({ x: tip.x + wobble, y: Math.min(y, tip.y), state: st });
      }
      const last = points[points.length - 1];
      if (last && last.y < tip.y) {
        points.push({ x: tip.x, y: tip.y, state: stateAt(tipWorld) });
      }
    }
    spine.update(points, Math.max(lineTop, -24) + worldPx, spineOpacity);

    // 笔尖：开场是一点朱砂，停笔时慢慢洇开
    const tipState = entry.kind === "opening" ? spineConfig.opening : stateAt(tipWorld);
    const pool = smooth(0.4, 4, idle);
    const openingDot = entry.kind === "opening" ? 4.5 + 0.5 * Math.sin(time * 1.6) : 0;
    const tipRadius = Math.max(openingDot, tipState.width * 0.7 + pool * tipState.width * 1.1);
    spine.updateTip(tipAt.x, tipAt.y, tipRadius, tipState, spineOpacity * (1 - ending), 3.1);

    // ── 氛围 ──
    atmosphere.update(
      s?.atmosphere.kind ?? "none",
      s?.atmosphere.density ?? 0,
      plateReveal,
      time,
      view,
    );

    const animating = plateReveal > 0.001 || idle < 4.5 || entry.kind === "opening";
    return {
      state: {
        located,
        view: { width: W, height: H },
        worldPx,
        tip: tipAt,
        opening,
        ending,
        plate: plateReveal,
        text,
        camera: cam,
        toScreen,
      },
      animating,
    };
  };

  // ── 渲染循环：和 Lenis、ScrollTrigger 共用 gsap 的 ticker ─────────────
  let lastTime = 0;
  const tick = (time: number) => {
    if (destroyed) return;
    const delta = time - lastTime;
    lastTime = time;
    const { state, animating } = frame(time);
    if (!dirty && !animating) return;
    dirty = false;
    post.render(delta);
    options.onFrame(state);
  };
  gsap.ticker.add(tick);

  const onContextLost = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onContextLost);

  return {
    get schedule() {
      return schedule;
    },
    setPosition(screens: number) {
      if (screens === position) return;
      position = screens;
      lastMove = performance.now();
      dirty = true;
    },
    rebuild() {
      schedule = buildSchedule(events, scenes, spineConfig);
      buildSpineKeys();
      dirty = true;
    },
    setStyle(next: Style) {
      style = next;
      plate.setStyle(style);
      post.setStyle(style);
      dirty = true;
    },
    destroy() {
      destroyed = true;
      gsap.ticker.remove(tick);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      plate.dispose();
      spine.dispose();
      atmosphere.dispose();
      for (const glyph of glyphs.values()) glyph.dispose();
      assets.dispose();
      post.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
