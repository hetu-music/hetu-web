/**
 * 河图志「青绿金线」原型的场景：山体、金色的河、站点光点、同曲弧线，以及叠在画布上的地名。
 * 命令式引擎，React 只管选中后的面板；地名每帧投影一次，太挤时按优先级隐去。
 */

import gsap from "gsap";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import type { River, Side } from "@/components/places/layout";
import {
  CX,
  CZ,
  GOLD,
  POINT_FRAG,
  POINT_VERT,
  alongOf,
  buildArc,
  buildRiver,
  buildTerrain,
  sampleRiver,
  type RiverMesh,
} from "./geometry";

export interface EngineStop {
  id: number;
  name: string;
  x: number;
  y: number;
  side: Side;
  river: string;
  /** 越大越先保住不被隐去 */
  weight: number;
}

export interface EngineText {
  text: string;
  x: number;
  y: number;
  kind: "river-large" | "river" | "group";
  river?: string;
}

interface Options {
  portrait: boolean;
  reduce: boolean;
  onSelect: (id: number | null) => void;
  onIntroEnd: () => void;
}

interface Label {
  el: HTMLElement;
  world: THREE.Vector3;
  side: Side | "center";
  w: number;
  h: number;
  /** 越大越先放 */
  priority: number;
  stop?: EngineStop;
  river?: string;
  along?: number;
  kind: "stop" | EngineText["kind"];
  opacity: number;
  shown: boolean;
}

const BG = new THREE.Color("#04121a");
const LABEL_GAP = 10;
const FOV_WIDE = 32;
const FOV_TALL = 42;

/** 开场里每条河开始流、流完各用多久 */
function revealTiming(river: River): { start: number; dur: number } {
  if (river.id === "coast") return { start: 0, dur: 1.2 };
  if (river.id === "changjiang") return { start: 0.2, dur: 3.6 };
  return { start: 0.5 + river.delay * 1.7, dur: 1.8 };
}

export class PlacesEngine {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;
  private terrain: ReturnType<typeof buildTerrain>;
  private rivers: RiverMesh[] = [];
  private riverById = new Map<string, RiverMesh>();
  private points: THREE.Points;
  private pointAlpha: Float32Array;
  private pointSize: Float32Array;
  private stops: EngineStop[];
  private stopAlong: number[];
  private labels: Label[] = [];
  private arcs: ReturnType<typeof buildArc>[] = [];
  private timer = new THREE.Timer();
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private width = 1;
  private height = 1;
  private introTime: number | null = 0;
  private intro: gsap.core.Timeline | null = null;
  private fly: gsap.core.Tween | null = null;
  private selected: number | null = null;
  private kin = new Set<number>();
  private down: { x: number; y: number } | null = null;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private canvas: HTMLCanvasElement,
    private layer: HTMLElement,
    stops: EngineStop[],
    texts: EngineText[],
    rivers: River[],
    private opts: Options,
  ) {
    this.stops = stops;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      depth: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = BG;

    this.camera = new THREE.PerspectiveCamera(
      opts.portrait ? FOV_TALL : FOV_WIDE,
      1,
      10,
      12000,
    );

    this.terrain = buildTerrain(rivers, BG);
    this.scene.add(this.terrain.mesh);

    for (const river of rivers) {
      const rm = buildRiver(sampleRiver(river));
      this.rivers.push(rm);
      this.riverById.set(river.id, rm);
      this.scene.add(rm.mesh);
    }

    // 站点光点
    const positions = new Float32Array(stops.length * 3);
    this.pointAlpha = new Float32Array(stops.length);
    this.pointSize = new Float32Array(stops.length).fill(14);
    this.stopAlong = stops.map((s, i) => {
      positions.set([s.x - CX, 3.5, s.y - CZ], i * 3);
      const rm = this.riverById.get(s.river);
      return rm ? alongOf(rm.path, s.x, s.y) : 0;
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pg.setAttribute("aAlpha", new THREE.BufferAttribute(this.pointAlpha, 1));
    pg.setAttribute("aSize", new THREE.BufferAttribute(this.pointSize, 1));
    this.points = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uGold: { value: GOLD }, uScale: { value: 800 } },
      }),
    );
    this.points.renderOrder = 4;
    this.scene.add(this.points);

    // 后期：泛光让金线发亮，四角压暗收住画面
    this.composer = new EffectComposer(this.renderer, {
      multisampling: Math.min(4, this.renderer.capabilities.maxSamples),
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new EffectPass(
        this.camera,
        new BloomEffect({
          intensity: 1.35,
          luminanceThreshold: 0.36,
          luminanceSmoothing: 0.3,
          mipmapBlur: true,
          radius: 0.72,
        }),
        new VignetteEffect({ offset: 0.32, darkness: 0.7 }),
      ),
    );

    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableRotate = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 140;
    this.controls.enabled = false;

    this.buildLabels(texts);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.fonts?.ready.then(() => this.measureLabels());

    if (opts.reduce) this.finishIntro();
    else this.playIntro();
    this.loop();
  }

  // ─── 地名 ───────────────────────────────────────────────────────────────────

  private buildLabels(texts: EngineText[]) {
    for (const t of texts) {
      const el = document.createElement("div");
      el.textContent = t.text;
      el.className =
        t.kind === "group"
          ? "pointer-events-none absolute left-0 top-0 font-calligraphy text-[44px] leading-none text-[#e9d9a8] [writing-mode:vertical-rl]"
          : t.kind === "river-large"
            ? "pointer-events-none absolute left-0 top-0 font-calligraphy text-[30px] leading-none text-[#f0cf7c] whitespace-nowrap [text-shadow:0_0_18px_rgba(233,194,107,0.55)]"
            : "pointer-events-none absolute left-0 top-0 font-sans text-[12px] tracking-[0.3em] text-[#d9bf7f]/85 whitespace-nowrap";
      this.layer.appendChild(el);
      const rm = t.river ? this.riverById.get(t.river) : undefined;
      this.labels.push({
        el,
        world: new THREE.Vector3(t.x - CX, 4, t.y - CZ),
        side: "center",
        w: 0,
        h: 0,
        priority: t.kind === "river-large" ? 900 : t.kind === "group" ? -1 : 5,
        kind: t.kind,
        river: t.river,
        along: rm ? alongOf(rm.path, t.x, t.y) : undefined,
        opacity: -1,
        shown: false,
      });
    }
    for (const s of this.stops) {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = s.name;
      el.className =
        "absolute left-0 top-0 cursor-pointer whitespace-nowrap font-serif text-[15px] leading-none text-[#f5ecd2] transition-[color] duration-300 hover:text-[#ffd98a] [text-shadow:0_1px_10px_rgba(2,12,18,0.9),0_0_2px_rgba(2,12,18,0.9)]" +
        (s.side === "a" || s.side === "b"
          ? " [writing-mode:vertical-rl] tracking-[0.12em]"
          : " tracking-[0.06em]");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.opts.onSelect(s.id);
      });
      this.layer.appendChild(el);
      this.labels.push({
        el,
        world: new THREE.Vector3(s.x - CX, 3.5, s.y - CZ),
        side: s.side,
        w: 0,
        h: 0,
        priority: 100 + s.weight * 10,
        stop: s,
        river: s.river,
        along: this.stopAlong[this.stops.indexOf(s)],
        kind: "stop",
        opacity: -1,
        shown: false,
      });
    }
    this.measureLabels();
  }

  private measureLabels() {
    for (const l of this.labels) {
      l.w = l.el.offsetWidth;
      l.h = l.el.offsetHeight;
    }
  }

  /** 地名相对光点的位置：左右横排，上下竖排 */
  private rectOf(l: Label, sx: number, sy: number) {
    switch (l.side) {
      case "r":
        return { x: sx + LABEL_GAP, y: sy - l.h / 2 };
      case "l":
        return { x: sx - LABEL_GAP - l.w, y: sy - l.h / 2 };
      case "a":
        return { x: sx - l.w / 2, y: sy - LABEL_GAP - l.h };
      case "b":
        return { x: sx - l.w / 2, y: sy + LABEL_GAP };
      default:
        return { x: sx - l.w / 2, y: sy - l.h / 2 };
    }
  }

  private updateLabels() {
    const v = new THREE.Vector3();
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const dist = this.camera.position.distanceTo(this.controls.target);
    const ordered = [...this.labels].sort(
      (a, b) => this.priorityOf(b) - this.priorityOf(a),
    );
    for (const l of ordered) {
      v.copy(l.world).project(this.camera);
      const sx = ((v.x + 1) / 2) * this.width;
      const sy = ((1 - v.y) / 2) * this.height;
      const { x, y } = this.rectOf(l, sx, sy);
      let visible = v.z < 1 && sx > -80 && sx < this.width + 80 && sy > -80 && sy < this.height + 80;

      // 开场时，水流到哪里，哪里的名字才出来
      const reveal = this.revealOf(l);
      if (reveal <= 0) visible = false;

      if (visible && l.kind !== "group") {
        const pad = l.kind === "stop" ? 3 : 6;
        const hit = placed.some(
          (p) =>
            x - pad < p.x + p.w && x + l.w + pad > p.x && y - pad < p.y + p.h && y + l.h + pad > p.y,
        );
        if (hit) visible = false;
        else placed.push({ x, y, w: l.w, h: l.h });
      }

      let target = visible ? Math.min(1, reveal) : 0;
      if (visible && l.kind === "group") {
        // 大地名只在远看时托底，凑近了就让位给站名
        target *= 0.22 * THREE.MathUtils.smoothstep(dist, 700, 1400);
      } else if (visible && this.selected !== null && l.kind === "stop") {
        const id = l.stop?.id;
        target *= id === this.selected || (id !== undefined && this.kin.has(id)) ? 1 : 0.3;
      } else if (visible && this.selected !== null) {
        target *= 0.4;
      }

      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const o = Math.round(target * 100) / 100;
      if (o !== l.opacity) {
        l.el.style.opacity = String(o);
        l.el.style.pointerEvents = o > 0.2 && l.kind === "stop" ? "auto" : "none";
        l.opacity = o;
      }
      if (l.stop) {
        const lit = l.stop.id === this.selected || this.kin.has(l.stop.id);
        if (lit !== l.shown) {
          l.el.style.color = lit ? "#ffd98a" : "";
          l.el.style.fontWeight = l.stop.id === this.selected ? "700" : "";
          l.shown = lit;
        }
      }
    }
  }

  private priorityOf(l: Label): number {
    if (l.stop && l.stop.id === this.selected) return 10000;
    if (l.stop && this.kin.has(l.stop.id)) return 5000;
    return l.priority;
  }

  /** 0：水还没流到；1：已经显出来 */
  private revealOf(l: Label): number {
    if (l.river === undefined || l.along === undefined) {
      return this.introTime === null ? 1 : THREE.MathUtils.clamp((this.introTime - 3.8) / 1, 0, 1);
    }
    const rm = this.riverById.get(l.river);
    if (!rm) return 1;
    const reveal = rm.material.uniforms.uReveal.value as number;
    return THREE.MathUtils.clamp((reveal - l.along) / 60, 0, 1);
  }

  // ─── 相机 ───────────────────────────────────────────────────────────────────

  /** 全图的相机：宽屏从南边斜看；竖屏站在海口往上游看 */
  private overview() {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const tan = Math.tan(fov / 2);
    const aspect = this.width / this.height;
    if (this.opts.portrait) {
      const elev = THREE.MathUtils.degToRad(62);
      const dist = 470 / (tan * aspect);
      // 近处（东边的海）多留一点给卷首，山水往画面上方挪
      const target = new THREE.Vector3(70, 0, 0);
      return {
        target,
        position: target.clone().add(new THREE.Vector3(Math.cos(elev), Math.sin(elev), 0).multiplyScalar(dist)),
        dist,
      };
    }
    const elev = THREE.MathUtils.degToRad(57);
    const dist = Math.max(900 / (tan * aspect), (640 * Math.sin(elev)) / tan);
    // 左边留给卷首，全图往右挪一点；顶栏占掉上沿，再往北挪一点
    const target = new THREE.Vector3(-130, 0, -10);
    return {
      target,
      position: target.clone().add(new THREE.Vector3(0, Math.sin(elev), Math.cos(elev)).multiplyScalar(dist)),
      dist,
    };
  }

  private setCamera(position: THREE.Vector3, target: THREE.Vector3) {
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.camera.lookAt(target);
  }

  private playIntro() {
    const mouth = this.worldOf(1270, 430);
    const mid = this.worldOf(820, 498);
    const end = this.overview();
    const cam = {
      px: mouth.x + 260,
      py: 110,
      pz: mouth.z + 10,
      tx: mouth.x - 140,
      ty: 0,
      tz: mouth.z,
    };
    const apply = () =>
      this.setCamera(new THREE.Vector3(cam.px, cam.py, cam.pz), new THREE.Vector3(cam.tx, cam.ty, cam.tz));
    apply();
    this.introTime = 0;
    const tl = gsap.timeline({
      onUpdate: () => {
        apply();
        this.introTime = tl.time();
      },
      onComplete: () => this.finishIntro(),
    });
    tl.to(cam, {
      px: mid.x + 260,
      py: 150,
      pz: mid.z + 70,
      tx: mid.x - 120,
      tz: mid.z,
      duration: 2.8,
      ease: "power1.inOut",
    });
    tl.to(cam, {
      px: end.position.x,
      py: end.position.y,
      pz: end.position.z,
      tx: end.target.x,
      ty: end.target.y,
      tz: end.target.z,
      duration: 2.6,
      ease: "power3.inOut",
    });
    this.intro = tl;
  }

  skipIntro() {
    if (this.intro && this.intro.isActive()) this.intro.progress(1);
  }

  private finishIntro() {
    this.intro?.kill();
    this.intro = null;
    this.introTime = null;
    for (const rm of this.rivers) rm.material.uniforms.uReveal.value = rm.path.total + 1;
    const end = this.overview();
    this.setCamera(end.position, end.target);
    this.controls.maxDistance = end.dist * 1.3;
    this.controls.enabled = true;
    this.controls.update();
    this.opts.onIntroEnd();
  }

  private worldOf(x: number, y: number) {
    return new THREE.Vector3(x - CX, 0, y - CZ);
  }

  private flyTo(target: THREE.Vector3, position: THREE.Vector3, duration = 1.3) {
    this.fly?.kill();
    this.controls.enabled = false;
    const from = {
      px: this.camera.position.x,
      py: this.camera.position.y,
      pz: this.camera.position.z,
      tx: this.controls.target.x,
      ty: this.controls.target.y,
      tz: this.controls.target.z,
    };
    this.fly = gsap.to(from, {
      px: position.x,
      py: position.y,
      pz: position.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      duration: this.opts.reduce ? 0 : duration,
      ease: "power3.inOut",
      onUpdate: () =>
        this.setCamera(new THREE.Vector3(from.px, from.py, from.pz), new THREE.Vector3(from.tx, from.ty, from.tz)),
      onComplete: () => {
        this.controls.enabled = true;
        this.controls.update();
      },
    });
  }

  // ─── 选中 ───────────────────────────────────────────────────────────────────

  setSelection(id: number | null, kin: Set<number>, pairs: [number, number][]) {
    if (this.introTime !== null) this.skipIntro();
    this.selected = id;
    this.kin = kin;

    for (const a of this.arcs) {
      this.scene.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.material.dispose();
    }
    this.arcs = [];

    const dimmed = id !== null;
    gsap.to(this.terrain.material.uniforms.uDim, { value: dimmed ? 0.6 : 1, duration: 0.6 });
    for (const rm of this.rivers) {
      gsap.to(rm.material.uniforms.uDim, { value: dimmed ? 0.45 : 1, duration: 0.6 });
    }
    this.stops.forEach((s, i) => {
      this.pointSize[i] = s.id === id ? 26 : kin.has(s.id) ? 18 : 14;
    });
    this.points.geometry.attributes.aSize.needsUpdate = true;

    if (id === null) {
      const end = this.overview();
      this.flyTo(end.target, end.position, 1.4);
      return;
    }

    const byId = new Map(this.stops.map((s) => [s.id, s]));
    for (const [a, b] of pairs) {
      const sa = byId.get(a);
      const sb = byId.get(b);
      if (!sa || !sb) continue;
      const arc = buildArc(
        new THREE.Vector3(sa.x - CX, 3.5, sa.y - CZ),
        new THREE.Vector3(sb.x - CX, 3.5, sb.y - CZ),
      );
      this.scene.add(arc.mesh);
      this.arcs.push(arc);
      gsap.to(arc.material.uniforms.uProgress, {
        value: 1,
        duration: this.opts.reduce ? 0 : 1.1,
        delay: this.opts.reduce ? 0 : 0.5,
        ease: "power2.inOut",
      });
    }

    const stop = byId.get(id);
    if (!stop) return;
    // 同曲的地点都要进画面：按它们散开的范围定远近
    const group = [stop, ...[...kin].map((k) => byId.get(k)).filter((s): s is EngineStop => !!s)];
    const xs = group.map((s) => s.x);
    const ys = group.map((s) => s.y);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const center = this.worldOf(
      (Math.max(...xs) + Math.min(...xs)) / 2,
      (Math.max(...ys) + Math.min(...ys)) / 2,
    );
    const focus = this.worldOf(stop.x, stop.y).lerp(center, 0.6);
    const dist = THREE.MathUtils.clamp(
      spread * 1.25 + (this.opts.portrait ? 640 : 420),
      this.opts.portrait ? 900 : 560,
      this.overview().dist * 0.9,
    );
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    // 面板在宽屏左边、竖屏下边：把焦点挪到画面另一侧
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().negate();
    // 画面朝上在地面上的方向：竖屏要让焦点落在上半屏，相机对准点就往画面下方（朝镜头）挪
    const groundUp = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
    const target = this.opts.portrait
      ? focus.clone().sub(groundUp.multiplyScalar(dist * 0.28))
      : focus.clone().sub(right.multiplyScalar(dist * 0.22));
    this.flyTo(target, target.clone().add(dir.multiplyScalar(dist)));
  }

  // ─── 交互与循环 ───────────────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
    if (this.introTime !== null) this.skipIntro();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.down) return;
    const moved = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y);
    this.down = null;
    if (moved < 6 && this.selected !== null) this.opts.onSelect(null);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const mat = this.points.material as THREE.ShaderMaterial;
    mat.uniforms.uScale.value =
      (h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.measureLabels();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    this.timer.update();
    const t = this.timer.getElapsed();
    this.terrain.material.uniforms.uTime.value = t;
    for (const rm of this.rivers) {
      rm.material.uniforms.uTime.value = t;
      if (this.introTime !== null) {
        const { start, dur } = revealTiming(rm.path.river);
        const p = THREE.MathUtils.clamp((this.introTime - start) / dur, 0, 1);
        rm.material.uniforms.uReveal.value = (1 - Math.pow(1 - p, 2)) * (rm.path.total + 1);
      }
    }
    this.stops.forEach((s, i) => {
      const rm = this.riverById.get(s.river);
      const reveal = rm ? (rm.material.uniforms.uReveal.value as number) : Infinity;
      const shown = THREE.MathUtils.clamp((reveal - this.stopAlong[i]) / 40, 0, 1);
      const dim = this.selected === null || s.id === this.selected || this.kin.has(s.id) ? 1 : 0.3;
      this.pointAlpha[i] = shown * dim;
    });
    this.points.geometry.attributes.aAlpha.needsUpdate = true;

    if (this.controls.enabled) {
      this.controls.update();
      // 别拖出画外
      const tg = this.controls.target;
      const cx = THREE.MathUtils.clamp(tg.x, -720, 620);
      const cz = THREE.MathUtils.clamp(tg.z, -500, 480);
      if (cx !== tg.x || cz !== tg.z) {
        const d = new THREE.Vector3(cx - tg.x, 0, cz - tg.z);
        tg.add(d);
        this.camera.position.add(d);
      }
    }
    this.composer.render();
    this.updateLabels();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.intro?.kill();
    this.fly?.kill();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    for (const l of this.labels) l.el.remove();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
  }
}
