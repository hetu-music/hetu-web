/**
 * 河图志「青绿金线」原型的几何：程序生成的山体、沿河道的流光带。
 * 坐标沿用水系图的版式（layout.ts，1480 × 1000，y 向南），世界坐标 x = 图 x - CX，z = 图 y - CZ，y 朝上。
 */

import * as THREE from "three";
import type { River } from "@/components/places/layout";

export const CX = 700;
export const CZ = 520;
/** 海岸线（layout 里 coast 那条虚线的 x），以东是海 */
const COAST_X = 1272;

export const GOLD = new THREE.Color("#e9c26b");

// ─── 噪声 ─────────────────────────────────────────────────────────────────────

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** 脊状噪声：山脊尖、山谷圆，比 fbm 更像山 */
function ridged(x: number, y: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    n *= n * weight;
    weight = Math.min(1, n * 1.6);
    sum += n * amp;
    freq *= 2.1;
    amp *= 0.5;
  }
  return sum;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ─── 河道采样 ─────────────────────────────────────────────────────────────────

export interface RiverPath {
  river: River;
  /** 采样点（图坐标），从河口往上游 */
  pts: [number, number][];
  /** 每个采样点离河口的距离 */
  along: number[];
  total: number;
}

/** 与 2D 版 roundedPath 同样的倒圆折角，按固定步长采样 */
export function sampleRiver(river: River, radius = 16, step = 3): RiverPath {
  const src = river.pts;
  const out: [number, number][] = [];
  const line = (a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = out.length === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  };
  let cur = src[0];
  for (let i = 1; i < src.length - 1; i++) {
    const [x, y] = src[i];
    const [px, py] = src[i - 1];
    const [nx, ny] = src[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const a: [number, number] = [x - ((x - px) / inLen) * r, y - ((y - py) / inLen) * r];
    const b: [number, number] = [x + ((nx - x) / outLen) * r, y + ((ny - y) / outLen) * r];
    line(cur, a);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const mt = 1 - t;
      out.push([
        mt * mt * a[0] + 2 * mt * t * x + t * t * b[0],
        mt * mt * a[1] + 2 * mt * t * y + t * t * b[1],
      ]);
    }
    cur = b;
  }
  line(cur, src[src.length - 1]);

  const along = [0];
  for (let i = 1; i < out.length; i++) {
    along.push(
      along[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]),
    );
  }
  return { river, pts: out, along, total: along[along.length - 1] };
}

/** 图上一点在这条河上离河口多远（取最近的采样点） */
export function alongOf(path: RiverPath, x: number, y: number): number {
  let best = Infinity;
  let at = 0;
  path.pts.forEach(([px, py], i) => {
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) {
      best = d;
      at = path.along[i];
    }
  });
  return at;
}

// ─── 山体 ─────────────────────────────────────────────────────────────────────

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export const TERRAIN_VERT = /* glsl */ `
  attribute float aMask;
  attribute float aSea;
  varying float vH;
  varying float vMask;
  varying float vSea;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vH = position.y;
    vMask = aMask;
    vSea = aSea;
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const TERRAIN_FRAG = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uGold;
  uniform vec3 uLow;
  uniform vec3 uQing;
  uniform vec3 uLv;
  uniform vec3 uJade;
  uniform vec3 uPeak;
  uniform vec3 uSea;
  uniform float uTime;
  uniform float uDim;
  varying float vH;
  varying float vMask;
  varying float vSea;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    // 石青到石绿，峰顶泛青白
    float t = clamp(vH / 120.0, 0.0, 1.0);
    vec3 c = mix(uLow, uQing, smoothstep(0.0, 0.1, t));
    c = mix(c, uLv, smoothstep(0.1, 0.38, t));
    c = mix(c, uJade, smoothstep(0.42, 0.72, t));
    c = mix(c, uPeak, smoothstep(0.8, 1.0, t));

    vec3 n = normalize(vNormal);
    vec3 L = normalize(vec3(-0.55, 0.75, -0.4));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    c *= 0.32 + 0.74 * diff;

    // 金色等高线：越高越清楚，河谷里没有
    float lvl = vH / 14.0;
    float w = fwidth(lvl);
    float line = 1.0 - smoothstep(0.0, w * 1.3, abs(fract(lvl - 0.5) - 0.5));
    c = mix(c, uGold, line * 0.2 * smoothstep(6.0, 26.0, vH));

    if (vSea > 0.5) {
      // 细碎的粼光：两组方向不同的细波相乘，只在交叠处一闪
      float w1 = 0.5 + 0.5 * sin(vWorld.z * 0.35 + vWorld.x * 0.08 + uTime * 0.9);
      float w2 = 0.5 + 0.5 * sin(vWorld.z * 0.21 - vWorld.x * 0.13 - uTime * 0.6);
      c = uSea + uGold * 0.22 * pow(w1 * w2, 18.0);
    }

    c *= uDim;
    gl_FragColor = vec4(mix(uBg, c, vMask), 1.0);
  }
`;

/** 山体：西高东低，河道处压成河谷，海岸以东是平的海，四边渐隐成底色 */
export function buildTerrain(rivers: River[], bg: THREE.Color) {
  const W = 1760;
  const D = 1240;
  const SX = 320;
  const SZ = 226;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const mask = new Float32Array(pos.count);
  const sea = new Float32Array(pos.count);

  const segs: [number, number, number, number][] = [];
  for (const r of rivers) {
    if (r.id === "coast") continue;
    for (let i = 1; i < r.pts.length; i++) {
      segs.push([r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]]);
    }
  }

  for (let i = 0; i < pos.count; i++) {
    const mx = pos.getX(i) + CX;
    const my = pos.getZ(i) + CZ;
    const nx = (mx - 740) / 860;
    const nz = (my - 520) / 610;
    const wobble = (fbm(mx * 0.004 + 7, my * 0.004 + 3, 3) - 0.5) * 0.22;
    const edge = Math.max(Math.abs(nx), Math.abs(nz)) + wobble;
    mask[i] = 1 - smooth(0.74, 0.98, edge);

    if (mx > COAST_X) {
      sea[i] = 1;
      pos.setY(i, -2);
      continue;
    }

    let d = Infinity;
    for (const [ax, ay, bx, by] of segs) d = Math.min(d, segDist(mx, my, ax, ay, bx, by));

    const west = 1 - Math.min(1, Math.max(0, mx / 1480));
    const amp = 22 + 120 * Math.pow(west, 1.6);
    let h = (0.3 * fbm(mx * 0.005, my * 0.005) + 0.85 * ridged(mx * 0.0075 + 11, my * 0.0075 + 5)) * amp;
    h *= smooth(4, 24 + 26 * west, d);
    // 近海是平原
    h *= 0.35 + 0.65 * smooth(COAST_X, COAST_X - 220, mx);
    h *= mask[i];
    pos.setY(i, h - 1);
  }
  geo.setAttribute("aMask", new THREE.BufferAttribute(mask, 1));
  geo.setAttribute("aSea", new THREE.BufferAttribute(sea, 1));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      uBg: { value: bg },
      uGold: { value: GOLD },
      // 颜色经 THREE.Color 换成线性值，后期输出时再转回 sRGB
      uLow: { value: new THREE.Color("#0b3140") },
      uQing: { value: new THREE.Color("#1b5873") },
      uLv: { value: new THREE.Color("#2f8a78") },
      uJade: { value: new THREE.Color("#79b69a") },
      uPeak: { value: new THREE.Color("#dbe3c8") },
      uSea: { value: new THREE.Color("#071b26") },
      uTime: { value: 0 },
      uDim: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, material: mat };
}

// ─── 河：金色流光带 ───────────────────────────────────────────────────────────

const RIVER_VERT = /* glsl */ `
  attribute float aAlong;
  attribute float aSide;
  varying float vAlong;
  varying float vSide;
  void main() {
    vAlong = aAlong;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIVER_FRAG = /* glsl */ `
  uniform vec3 uGold;
  uniform float uTime;
  uniform float uReveal;
  uniform float uTotal;
  uniform float uFade;
  uniform float uFadeBoth;
  uniform float uDashed;
  uniform float uOpacity;
  uniform float uDim;
  varying float vAlong;
  varying float vSide;

  void main() {
    if (vAlong > uReveal) discard;
    if (uDashed > 0.5 && fract(vAlong / 10.0) > 0.4) discard;
    float a = smoothstep(1.0, 0.15, abs(vSide));
    if (uFade > 0.0) a *= 1.0 - smoothstep(uTotal - uFade, uTotal, vAlong);
    if (uFadeBoth > 0.5) a *= smoothstep(0.0, uTotal * 0.14, vAlong) * (1.0 - smoothstep(uTotal * 0.86, uTotal, vAlong));
    // 一段段亮光往河口流：相位 along + t 不变的点，along 随时间变小
    float flow = pow(0.5 + 0.5 * sin((vAlong + uTime * 46.0) / 26.0), 14.0);
    // 开场时的水头
    float head = smoothstep(uReveal - 40.0, uReveal, vAlong) * step(uReveal, uTotal - 1.0);
    float glow = 0.75 + flow * 0.9 + head * 2.2;
    float core = smoothstep(0.55, 0.0, abs(vSide));
    vec3 c = uGold * glow + vec3(1.0, 0.95, 0.8) * core * 0.35;
    gl_FragColor = vec4(c * uDim, a * uOpacity);
  }
`;

export interface RiverMesh {
  path: RiverPath;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function buildRiver(path: RiverPath): RiverMesh {
  const { pts, along, river } = path;
  const width = river.width * (river.id === "dongting" ? 3.2 : 2.6);
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3);
  const aAlong = new Float32Array(n * 2);
  const aSide = new Float32Array(n * 2);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[Math.min(n - 1, i + 1)];
    const tx = x1 - x0;
    const ty = y1 - y0;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const [x, y] = pts[i];
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const k = (i * 2 + s) * 3;
      positions[k] = x + nx * side * width - CX;
      positions[k + 1] = 1.6;
      positions[k + 2] = y + ny * side * width - CZ;
      aAlong[i * 2 + s] = along[i];
      aSide[i * 2 + s] = side;
    }
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aAlong", new THREE.BufferAttribute(aAlong, 1));
  geo.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  geo.setIndex(index);

  const material = new THREE.ShaderMaterial({
    vertexShader: RIVER_VERT,
    fragmentShader: RIVER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uGold: { value: GOLD },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uTotal: { value: path.total },
      uFade: { value: river.fade ?? 0 },
      uFadeBoth: { value: river.fadeBoth ? 1 : 0 },
      uDashed: { value: river.dashed ? 1 : 0 },
      uOpacity: { value: river.id === "dongting" ? 0.35 : river.dashed ? 0.6 : 1 },
      uDim: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 2;
  return { path, mesh, material };
}

// ─── 站点：金色光点 ───────────────────────────────────────────────────────────

export const POINT_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const POINT_FRAG = /* glsl */ `
  uniform vec3 uGold;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    vec3 c = uGold * (0.5 + halo * 0.6) + vec3(1.0, 0.97, 0.88) * core * 1.4;
    gl_FragColor = vec4(c, (halo * 0.7 + core) * vAlpha);
  }
`;

// ─── 同曲弧线 ─────────────────────────────────────────────────────────────────

const ARC_VERT = /* glsl */ `
  varying float vU;
  void main() {
    vU = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform vec3 uGold;
  uniform float uProgress;
  varying float vU;
  void main() {
    if (vU > uProgress) discard;
    float head = smoothstep(uProgress - 0.08, uProgress, vU) * step(uProgress, 0.999);
    gl_FragColor = vec4(uGold * (1.1 + head * 2.0), 0.9);
  }
`;

/** 两站之间升起的弧：隔得越远拱得越高 */
export function buildArc(a: THREE.Vector3, b: THREE.Vector3) {
  const dist = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += 24 + dist * 0.32;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geo = new THREE.TubeGeometry(curve, 72, 1.1, 6, false);
  const material = new THREE.ShaderMaterial({
    vertexShader: ARC_VERT,
    fragmentShader: ARC_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uGold: { value: GOLD }, uProgress: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 3;
  return { mesh, material };
}
