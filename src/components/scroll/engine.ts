/**
 * 夜展长卷的 WebGL 部分：卷面上的画、镜头（平移、缩放、推近）、灯光与输入。
 * 只管画面；题字、说明、按钮都是 DOM，由组件按 onFrame 回传的镜头位置对齐。
 */

import type {
  Application,
  BlurFilter,
  Container,
  FederatedPointerEvent,
  Sprite,
  Texture,
} from "pixi.js";
import {
  BAND_HEIGHT,
  type Placement,
  type ScrollLayout,
  type YearSpan,
  yearInscriptionAt,
} from "./layout";

export interface EngineWork {
  id: number;
  title: string;
  /** 有自己的封面时的原图地址；没有就画素笺 */
  coverUrl: string | null;
}

/** 镜头：视口中心对准的卷面坐标，以及缩放（卷面单位 → 屏幕像素） */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface EngineEvents {
  /** 鼠标停在哪一幅上 */
  onHover: (id: number | null) => void;
  /** 推近到哪一幅（null 为退回远观） */
  onFocus: (id: number | null) => void;
  /** 每一帧镜头的位置，供 DOM 题字与说明对齐 */
  onFrame: (camera: Camera, view: { width: number; height: number }) => void;
  /** 第一次有人动它：收起操作提示 */
  onInteract: () => void;
  /** 鼠标停在某年的题字上（空白处），可以点进那一年的展室 */
  onYearHover: (span: YearSpan | null) => void;
  /** 点了某年的题字 */
  onYearTap: (year: number | null) => void;
  /** WebGL 上下文丢了（移动端内存紧张时会发生），由页面改用近赏 */
  onContextLost: () => void;
}

/** 镜头的去处：恢复上次的位置、落在某一年，或者都不给（从引首开卷） */
export interface EngineInitial {
  camera?: Camera;
  /** 恢复时直接推近到这一幅 */
  focusId?: number | null;
  /** 从近赏切过来：落在这一年 */
  year?: number | null;
}

/** 离开主页前记下的状态，回来时原样恢复 */
export interface EngineState {
  /** 远观时的镜头（推近时是推近前的那个） */
  camera: Camera;
  focusId: number | null;
}

export interface ScrollEngine {
  focus: (id: number) => void;
  unfocus: () => void;
  /** 推近状态下沿卷走到前（-1，更早）或后（+1，更新）一幅 */
  step: (direction: -1 | 1) => void;
  /** 远观时沿卷平移，单位是屏宽 */
  pan: (screens: number) => void;
  /** 点灯：只让这些画亮着，其余沉进暗处；null 全亮 */
  setLit: (ids: Set<number> | null) => void;
  getState: () => EngineState;
  destroy: () => void;
}

// ── 参数 ──────────────────────────────────────────────────────────────────

/** 远观时卷面占视口高度的比例 */
const FAR_FILL = 0.6;
/** 窄屏竖着拿，卷面占得少一点，一屏才看得到几列 */
const FAR_FILL_NARROW = 0.42;
/** 推近时那一幅占视口高度的比例 */
const NEAR_FILL = 0.66;
/** 画平时只点着这么亮，停上去才全亮 */
const BASE_LIGHT = 0.68;
/** 推近时，其余的画退到多暗、虚得多厉害 */
const AWAY_ALPHA = 0.16;
const AWAY_BLUR = 7;
/** 推近、退回的镜头飞行时长 */
const FLIGHT_MS = 1300;
/** 开卷：对着引首停多久，再用多长时间滑进画里 */
const OPENING_HOLD_MS = 2200;
const OPENING_GLIDE_MS = 2800;
/** 开场时画从右往左依次亮起：镜头起滑后多久开始，扫过一屏的时长与总上限 */
const INTRO_START_MS = OPENING_HOLD_MS + 500;
const INTRO_SWEEP_MS = 1400;
const INTRO_MAX_MS = 3200;
/** 同时下载的封面数 */
const LOAD_CONCURRENCY = 6;
/** 点灯：命中的画从镜头正中往两边一盏盏亮，相隔多久、最晚多久 */
const LIT_STAGGER_MS = 10;
const LIT_MAX_MS = 900;
/** 没命中的画沉到多暗 */
const UNLIT_ALPHA = 0.09;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** 经 Next 的图片优化走同源地址：WebGL 读跨域图片会被拒 */
function optimizedUrl(src: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 素笺：深色纸面，题名竖排 */
function cardCanvas(title: string, fontFamily: string): HTMLCanvasElement {
  // 推近时素笺会放得很大，按 512 画才不发虚
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#161922";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  const chars = Array.from(title).slice(0, 18);
  const perColumn = 7;
  const columns = Math.ceil(chars.length / perColumn);
  const fontSize = 52;
  const step = fontSize * 1.25;
  ctx.fillStyle = "#c9ccd6";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let c = 0; c < columns; c++) {
    // 竖排从右往左
    const x = size / 2 + ((columns - 1) / 2 - c) * step;
    chars.slice(c * perColumn, (c + 1) * perColumn).forEach((ch, i) => {
      ctx.fillText(ch, x, 68 + i * step);
    });
  }
  return canvas;
}

/** 画背后的一圈光晕 */
function haloCanvas(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,244,225,1)");
  g.addColorStop(0.45, "rgba(255,244,225,0.35)");
  g.addColorStop(1, "rgba(255,244,225,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

interface Item {
  placement: Placement;
  work: EngineWork;
  node: Container;
  sprite: Sprite;
  halo: Sprite;
  /** 0..1：灯光 */
  light: number;
  lightTarget: number;
  /** 开场淡入：何时开始亮（performance.now 时刻），未加载完为 Infinity */
  appearAt: number;
  appear: number;
  hiResLoading: boolean;
  /** 点灯：0 沉在暗处，1 亮着；litAt 之前不动（亮灯的先后） */
  lit: number;
  litTarget: number;
  litAt: number;
}

export async function createScrollEngine(
  host: HTMLElement,
  layout: ScrollLayout,
  works: Map<number, EngineWork>,
  events: EngineEvents,
  options: { serifFont: string; initial?: EngineInitial },
): Promise<ScrollEngine> {
  const initial = options.initial ?? {};
  // 什么都没给才从引首开卷；恢复或从近赏切来时直接落在该在的地方
  const opening = !initial.camera && initial.year === undefined;
  const PIXI = await import("pixi.js");
  const app: Application = new PIXI.Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: "webgl",
  });
  const canvas = app.canvas;
  canvas.style.touchAction = "none";
  canvas.style.display = "block";
  host.appendChild(canvas);

  // 两层卷面：其余的画（back）与推近的那一幅（front），都随镜头平移缩放。
  // back 外面再套一层不随镜头动的壳，虚化挂在壳上：壳的坐标就是屏幕坐标，
  // 虚化的范围才能按整个屏幕算，贴着屏幕边的画不会被切出硬边
  const back = new PIXI.Container();
  const front = new PIXI.Container();
  const backShell = new PIXI.Container();
  backShell.addChild(back);
  app.stage.addChild(backShell, front);
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  const blur: BlurFilter = new PIXI.BlurFilter({ strength: 0, quality: 3 });
  backShell.filterArea = app.screen;
  const haloTexture: Texture = PIXI.Texture.from(haloCanvas(), true);

  // ── 画 ────────────────────────────────────────────────────────────────
  const items = new Map<number, Item>();
  const ordered = [...layout.placements].sort((a, b) => a.x - b.x);
  for (const placement of ordered) {
    const work = works.get(placement.id);
    if (!work) continue;
    const half = placement.size / 2;
    const node = new PIXI.Container();
    node.position.set(placement.x + half, placement.y + half);
    node.eventMode = "static";
    node.cursor = "pointer";
    node.hitArea = new PIXI.Rectangle(
      -half,
      -half,
      placement.size,
      placement.size,
    );
    node.alpha = 0;

    const halo = new PIXI.Sprite(haloTexture);
    halo.anchor.set(0.5);
    halo.setSize(placement.size * 1.9, placement.size * 1.9);
    halo.blendMode = "add";
    halo.alpha = 0;
    halo.eventMode = "none";

    const sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    sprite.anchor.set(0.5);
    sprite.eventMode = "none";

    node.addChild(halo, sprite);
    back.addChild(node);

    const item: Item = {
      placement,
      work,
      node,
      sprite,
      halo,
      light: 0,
      lightTarget: 0,
      appearAt: Infinity,
      appear: 0,
      hiResLoading: false,
      lit: 1,
      litTarget: 1,
      litAt: 0,
    };
    items.set(placement.id, item);

    node.on("pointerover", (e: FederatedPointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovered = placement.id;
      events.onHover(placement.id);
    });
    node.on("pointerout", (e: FederatedPointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (hovered === placement.id) {
        hovered = null;
        events.onHover(null);
      }
    });
    node.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (dragMoved) return;
      if (focused === placement.id) return;
      focus(placement.id);
    });
  }
  // 点在暗处：推近时退回远观；远观时点在某年的题字上，走进那一年的展室
  app.stage.on("pointertap", (e: FederatedPointerEvent) => {
    if (dragMoved) return;
    if (focused !== null) {
      unfocus();
      return;
    }
    const span = yearAtScreen(e.global.x, e.global.y);
    if (span) events.onYearTap(span.year);
  });
  let hoveredYear: YearSpan | null = null;
  app.stage.on("pointermove", (e: FederatedPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    // 停在画上时不算停在题字上
    const span =
      e.target === app.stage ? yearAtScreen(e.global.x, e.global.y) : null;
    if (span === hoveredYear) return;
    hoveredYear = span;
    app.stage.cursor = span ? "pointer" : "default";
    events.onYearHover(span);
  });

  // ── 镜头 ──────────────────────────────────────────────────────────────
  const view = () => ({ width: app.screen.width, height: app.screen.height });
  const farZoom = () =>
    (view().height * (view().width < 768 ? FAR_FILL_NARROW : FAR_FILL)) /
    BAND_HEIGHT;
  const isNarrow = () => view().width < 768;

  const cam: Camera = { x: 0, y: BAND_HEIGHT / 2, zoom: farZoom() };
  const { frontispiece } = layout;
  if (initial.camera) {
    Object.assign(cam, initial.camera);
  } else if (initial.year !== undefined) {
    const span = layout.years.find((y) => y.year === initial.year);
    if (span) cam.x = (span.from + span.to) / 2;
  } else {
    // 开卷：镜头先对着引首（题名），停一会儿再向左滑进画里
    cam.x = (frontispiece.from + frontispiece.to) / 2;
    // 窄屏放不下整段引首：开卷时先拉远到装得下，滑进画里时再推回远观的高度
    cam.zoom = Math.min(
      cam.zoom,
      (view().width * 0.92) / (frontispiece.to - frontispiece.from),
    );
  }
  const target: Camera = { ...cam };
  /** 画群最右缘：最新那一年的右边界 */
  const worksRight = layout.years[layout.years.length - 1]?.to ?? 0;
  const openingCamera = (): Camera => ({
    x: worksRight - view().width / 2 / farZoom() + 220,
    y: BAND_HEIGHT / 2,
    zoom: farZoom(),
  });
  let flight: {
    from: Camera;
    to: Camera;
    start: number;
    duration: number;
  } | null = null;
  let interacted = false;
  /** 有人动过它：不再自动开卷，收起提示 */
  const touch = () => {
    interacted = true;
    events.onInteract();
  };

  const clampTarget = () => {
    const { width, height } = view();
    const halfW = width / 2 / target.zoom;
    const margin = 240;
    const minX = halfW - margin;
    const maxX = layout.width - halfW + margin;
    target.x = minX > maxX ? layout.width / 2 : clamp(target.x, minX, maxX);
    const halfH = height / 2 / target.zoom;
    const minY = halfH - 200;
    const maxY = BAND_HEIGHT - halfH + 200;
    target.y = minY > maxY ? BAND_HEIGHT / 2 : clamp(target.y, minY, maxY);
  };
  // 恢复或落在某年时，位置要落在卷面范围之内（视口大小可能和上次不同）
  if (!opening) {
    clampTarget();
    Object.assign(cam, target);
  }

  /** 屏幕上一点落在哪一年的题字上（推近时不算） */
  const yearAtScreen = (gx: number, gy: number) => {
    if (focused !== null) return null;
    const { width, height } = view();
    return yearInscriptionAt(
      layout,
      cam.x + (gx - width / 2) / cam.zoom,
      cam.y + (gy - height / 2) / cam.zoom,
    );
  };

  const flyTo = (to: Camera, duration = FLIGHT_MS) => {
    flight = {
      from: { ...cam },
      to: { ...to },
      start: performance.now(),
      duration,
    };
    Object.assign(target, to);
  };

  /** 以屏幕上某点为不动点缩放 */
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const { width, height } = view();
    const far = farZoom();
    const next = clamp(target.zoom * factor, far * 0.55, far * 4.5);
    const wx = target.x + (sx - width / 2) / target.zoom;
    const wy = target.y + (sy - height / 2) / target.zoom;
    target.zoom = next;
    target.x = wx - (sx - width / 2) / next;
    target.y = wy - (sy - height / 2) / next;
    clampTarget();
  };

  // ── 推近与退回 ────────────────────────────────────────────────────────
  let focused: number | null = null;
  let hovered: number | null = null;
  let farBeforeFocus: Camera | null = null;
  /** 0..1：其余的画退进暗处的程度 */
  let away = 0;
  let blurApplied = false;

  const nearCamera = (p: Placement): Camera => {
    const { width, height } = view();
    const cx = p.x + p.size / 2;
    const cy = p.y + p.size / 2;
    if (isNarrow()) {
      // 窄屏：画在上半屏居中，说明放在下面
      const zoom = Math.min(width * 0.78, height * 0.46) / p.size;
      return { x: cx, y: cy + (height * 0.5 - height * 0.34) / zoom, zoom };
    }
    // 宽屏：画在左侧偏中，右边留给说明
    const zoom = (height * NEAR_FILL) / p.size;
    return { x: cx + (width * 0.5 - width * 0.34) / zoom, y: cy, zoom };
  };

  const loadHiRes = (item: Item) => {
    if (item.hiResLoading || !item.work.coverUrl) return;
    item.hiResLoading = true;
    loadImage(optimizedUrl(item.work.coverUrl, 1080))
      .then((img) => {
        if (destroyed) return;
        item.sprite.texture = PIXI.Texture.from(img, true);
        item.sprite.setSize(item.placement.size, item.placement.size);
      })
      .catch(() => undefined);
  };

  function focus(id: number) {
    const item = items.get(id);
    if (!item) return;
    touch();
    if (focused === null) farBeforeFocus = { ...target };
    else {
      const prev = items.get(focused);
      if (prev) back.addChild(prev.node);
    }
    focused = id;
    front.addChild(item.node);
    flyTo(nearCamera(item.placement));
    loadHiRes(item);
    events.onFocus(id);
  }

  function unfocus() {
    if (focused === null) return;
    const item = items.get(focused);
    focused = null;
    // 退回远观：回到推近前的高度，横向停在刚才看的那一幅附近
    const far = farBeforeFocus ?? { ...cam, zoom: farZoom() };
    const back_ = {
      ...far,
      x: item ? item.placement.x + item.placement.size / 2 : far.x,
    };
    Object.assign(target, back_);
    clampTarget();
    flyTo({ ...target });
    if (item) {
      // 镜头退开一半再把画放回去，免得它先被虚化
      setTimeout(() => {
        if (focused !== item.placement.id) back.addChild(item.node);
      }, FLIGHT_MS * 0.6);
    }
    events.onFocus(null);
  }

  function step(direction: -1 | 1) {
    if (focused === null) return;
    const index = ordered.findIndex((p) => p.id === focused);
    const next = ordered[index + direction];
    if (next) focus(next.id);
  }

  function pan(screens: number) {
    touch();
    target.x += (screens * view().width) / target.zoom;
    clampTarget();
  }

  // ── 输入 ──────────────────────────────────────────────────────────────
  let dragMoved = false;
  const pointers = new Map<number, { x: number; y: number }>();
  let velocity = 0;
  let lastMove = 0;
  let pinchDistance = 0;
  let downAt = { x: 0, y: 0 };
  let wheelStep = 0;
  let wheelStepAt = 0;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    touch();
    if (focused !== null) {
      // 推近时，滚一下走一幅
      const now = performance.now();
      wheelStep += e.deltaY + e.deltaX;
      if (Math.abs(wheelStep) > 60 && now - wheelStepAt > 650) {
        step(wheelStep > 0 ? -1 : 1);
        wheelStep = 0;
        wheelStepAt = now;
      }
      return;
    }
    flight = null;
    if (e.ctrlKey) {
      const rect = canvas.getBoundingClientRect();
      zoomAt(
        Math.exp(-e.deltaY * 0.004),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
      return;
    }
    // 往下滚是往卷的深处走，也就是更早的年份（向左）
    const delta =
      (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) *
      (e.deltaMode === 1 ? 32 : 1);
    target.x -= delta / target.zoom;
    clampTarget();
  };

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragMoved = false;
      velocity = 0;
      lastMove = performance.now();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      // 双指缩放
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0 && focused === null) {
        const rect = canvas.getBoundingClientRect();
        zoomAt(
          distance / pinchDistance,
          (a.x + b.x) / 2 - rect.left,
          (a.y + b.y) / 2 - rect.top,
        );
        Object.assign(cam, target);
      }
      pinchDistance = distance;
      dragMoved = true;
      return;
    }

    // 挪动不到几像素算点按，不算拖
    if (
      !dragMoved &&
      Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6
    ) {
      return;
    }
    dragMoved = true;
    touch();
    if (focused !== null) return;
    flight = null;
    target.x -= dx / target.zoom;
    target.y -= dy / target.zoom;
    clampTarget();
    cam.x = target.x;
    cam.y = target.y;
    const now = performance.now();
    const dt = Math.max(now - lastMove, 1);
    velocity = lerp(velocity, dx / dt, 0.4);
    lastMove = now;
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    pinchDistance = 0;
    if (dragMoved && focused === null && performance.now() - lastMove < 80) {
      // 松手后顺着惯性再滑一段
      target.x -= (velocity * 320) / target.zoom;
      clampTarget();
    }
    // tap 事件在 pointerup 之后才派发，晚一拍再清掉拖动标记
    setTimeout(() => (dragMoved = false), 0);
  };

  // 推近时横划：比较按下与松开的位置
  let swipeStart: { x: number; y: number } | null = null;
  const onSwipeStart = (e: PointerEvent) => {
    swipeStart = { x: e.clientX, y: e.clientY };
  };
  const onSwipeEnd = (e: PointerEvent) => {
    if (!swipeStart || focused === null) return;
    const dx = e.clientX - swipeStart.x;
    if (
      Math.abs(dx) > 50 &&
      Math.abs(dx) > Math.abs(e.clientY - swipeStart.y)
    ) {
      step(dx > 0 ? -1 : 1);
    }
    swipeStart = null;
  };

  const onKey = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (e.key === "Escape") unfocus();
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const direction = e.key === "ArrowLeft" ? -1 : 1;
      if (focused !== null) step(direction);
      else pan(direction * 0.6);
    } else return;
    e.preventDefault();
  };

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerdown", onSwipeStart);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerup", onSwipeEnd);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKey);

  // 视口变了：远观时保持「卷面占视口六成高」
  let lastFar = farZoom();
  const onResize = () => {
    const far = farZoom();
    if (focused === null) {
      target.zoom *= far / lastFar;
      clampTarget();
      Object.assign(cam, target);
    } else {
      const item = items.get(focused);
      if (item) Object.assign(target, nearCamera(item.placement));
      Object.assign(cam, target);
    }
    lastFar = far;
  };
  app.renderer.on("resize", onResize);

  // ── 加载封面：离开场镜头近的先下 ──────────────────────────────────────
  let destroyed = false;
  // 开卷时画从画群的右缘起，随着镜头滑进来依次亮起；
  // 恢复或从近赏切来时从镜头所在处往两边亮，不必等
  const introAt = performance.now() + (opening ? INTRO_START_MS : 150);
  const revealFrom = opening ? worksRight : cam.x;
  const openingTimer = opening
    ? setTimeout(() => {
        if (!interacted && focused === null)
          flyTo(openingCamera(), OPENING_GLIDE_MS);
      }, OPENING_HOLD_MS)
    : undefined;
  const queue = [...items.values()].sort(
    (a, b) =>
      Math.abs(revealFrom - a.placement.x) -
      Math.abs(revealFrom - b.placement.x),
  );
  const introDelay = (item: Item) => {
    const screens =
      (Math.abs(revealFrom - item.placement.x) * farZoom()) / view().width;
    return Math.min(screens * INTRO_SWEEP_MS, INTRO_MAX_MS);
  };
  const markReady = (item: Item) => {
    item.appearAt = Math.max(performance.now(), introAt + introDelay(item));
  };

  await document.fonts.load(`26px ${options.serifFont}`).catch(() => undefined);
  const worker = async () => {
    while (queue.length > 0 && !destroyed) {
      const item = queue.shift();
      if (!item) break;
      const { work, placement, sprite } = item;
      try {
        if (work.coverUrl) {
          const width = placement.tier === 2 ? 256 : 384;
          const img = await loadImage(optimizedUrl(work.coverUrl, width));
          if (destroyed) return;
          sprite.texture = PIXI.Texture.from(img, true);
        } else {
          sprite.texture = PIXI.Texture.from(
            cardCanvas(work.title, options.serifFont),
            true,
          );
        }
        sprite.setSize(placement.size, placement.size);
      } catch {
        // 封面取不到：画素笺代替
        sprite.texture = PIXI.Texture.from(
          cardCanvas(work.title, options.serifFont),
          true,
        );
        sprite.setSize(placement.size, placement.size);
      }
      markReady(item);
    }
  };
  for (let i = 0; i < LOAD_CONCURRENCY; i++) void worker();

  // ── 点灯 ──────────────────────────────────────────────────────────────
  function setLit(ids: Set<number> | null) {
    const now = performance.now();
    const centerOf = (item: Item) => item.placement.x + item.placement.size / 2;
    // 新亮起的从镜头正中往两边一盏盏亮；沉下去的一起沉
    const rising = [...items.values()]
      .filter(
        (item) =>
          (ids === null || ids.has(item.placement.id)) && item.litTarget === 0,
      )
      .sort(
        (a, b) => Math.abs(centerOf(a) - cam.x) - Math.abs(centerOf(b) - cam.x),
      );
    rising.forEach((item, i) => {
      item.litTarget = 1;
      item.litAt = now + Math.min(i * LIT_STAGGER_MS, LIT_MAX_MS);
    });
    if (ids) {
      for (const item of items.values()) {
        if (ids.has(item.placement.id)) continue;
        item.litTarget = 0;
        item.litAt = now;
      }
    }
  }

  function getState(): EngineState {
    return {
      camera: {
        ...(focused !== null && farBeforeFocus ? farBeforeFocus : target),
      },
      focusId: focused,
    };
  }

  // 恢复到推近状态：不飞，直接就位
  if (initial.focusId != null && items.has(initial.focusId)) {
    const far = { ...target };
    focus(initial.focusId);
    farBeforeFocus = far;
    flight = null;
    Object.assign(cam, target);
  }

  const onContextLost = (e: Event) => {
    e.preventDefault();
    events.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  // ── 每一帧 ────────────────────────────────────────────────────────────
  const dimTint = Math.round(BASE_LIGHT * 255);
  app.ticker.add((ticker) => {
    const now = performance.now();
    const dt = ticker.deltaMS / 1000;

    if (flight) {
      const t = clamp((now - flight.start) / flight.duration, 0, 1);
      const e = easeInOut(t);
      // 缩放按对数插值，推近拉远的速度才均匀
      cam.zoom = Math.exp(
        lerp(Math.log(flight.from.zoom), Math.log(flight.to.zoom), e),
      );
      cam.x = lerp(flight.from.x, flight.to.x, e);
      cam.y = lerp(flight.from.y, flight.to.y, e);
      if (t >= 1) flight = null;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      cam.x = lerp(cam.x, target.x, k);
      cam.y = lerp(cam.y, target.y, k);
      cam.zoom = Math.exp(lerp(Math.log(cam.zoom), Math.log(target.zoom), k));
    }

    const { width, height } = view();
    for (const layer of [back, front]) {
      layer.scale.set(cam.zoom);
      layer.position.set(
        width / 2 - cam.x * cam.zoom,
        height / 2 - cam.y * cam.zoom,
      );
    }

    // 其余的画退进暗处、虚掉
    away = lerp(away, focused !== null ? 1 : 0, 1 - Math.exp(-dt * 4));
    back.alpha = lerp(1, AWAY_ALPHA, away);
    blur.strength = AWAY_BLUR * away;
    const blurOn = away > 0.02;
    if (blurOn !== blurApplied) {
      backShell.filters = blurOn ? [blur] : [];
      blurApplied = blurOn;
    }

    // 视口外的不画
    const left = cam.x - width / 2 / cam.zoom - 400;
    const right = cam.x + width / 2 / cam.zoom + 400;
    for (const item of items.values()) {
      const p = item.placement;
      const visible = p.x + p.size > left && p.x < right;
      item.node.visible = visible;
      if (!visible) continue;

      if (now >= item.appearAt && item.appear < 1) {
        item.appear = Math.min(1, item.appear + dt / 1.1);
      }
      // 推近时只有那一幅亮着；远观时鼠标停在哪幅哪幅亮
      const lit = focused !== null ? p.id === focused : p.id === hovered;
      item.lightTarget = lit ? 1 : 0;
      item.light = lerp(item.light, item.lightTarget, 1 - Math.exp(-dt * 5));

      if (now >= item.litAt) {
        item.lit = lerp(item.lit, item.litTarget, 1 - Math.exp(-dt * 4));
      }
      // 没点着灯的沉进暗处：更淡，也更暗；停上去仍会亮一点，方便认
      const glow = Math.max(item.lit, item.light * 0.6);
      const shade = Math.round(
        lerp(dimTint, 255, item.light) * lerp(0.55, 1, item.lit),
      );
      item.sprite.tint = (shade << 16) | (shade << 8) | shade;
      item.halo.alpha = (0.035 + 0.11 * item.light) * item.appear * item.lit;
      item.node.alpha = easeInOut(item.appear) * lerp(UNLIT_ALPHA, 1, glow);
      item.node.scale.set(1 + 0.035 * item.light * (focused === p.id ? 0 : 1));
    }

    events.onFrame(cam, { width, height });
  });

  return {
    focus,
    unfocus,
    step,
    pan,
    setLit,
    getState,
    destroy: () => {
      destroyed = true;
      clearTimeout(openingTimer);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      app.destroy(true, { children: true, texture: true });
    },
  };
}
