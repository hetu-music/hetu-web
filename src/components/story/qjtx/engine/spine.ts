/**
 * 线：一条随笔尖生长的带状网格。每帧在 CPU 上按折线重建（几百个点，很便宜），
 * 着色器负责毛边、飞白与朱砂的辉光。线入画时折线换成画中红线的路径即可。
 */

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
} from "three";
import { NOISE } from "./shaders/noise";
import type { SpineState } from "./types";

const MAX_POINTS = 600;
/** 带子比笔画宽出这么多，留给辉光 */
const GLOW_PAD = 14;

const vertex = /* glsl */ `
attribute float aSide;
attribute float aAlong;
attribute float aWidth;
attribute float aCinnabar;
attribute float aAlpha;
varying float vSide;
varying float vAlong;
varying float vWidth;
varying float vCinnabar;
varying float vAlpha;
void main() {
  vSide = aSide;
  vAlong = aAlong;
  vWidth = aWidth;
  vCinnabar = aCinnabar;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const COLOR = /* glsl */ `
vec3 spineColor(float cinnabar) {
  // 淡墨在黑底上读作冷灰；朱砂取画中红线的颜色
  return mix(vec3(0.50, 0.52, 0.56), vec3(0.72, 0.07, 0.10), cinnabar);
}
`;

const fragment = /* glsl */ `
precision highp float;
${NOISE}
${COLOR}
uniform float uPad;
uniform float uDry;
uniform float uAlpha;
varying float vSide;
varying float vAlong;
varying float vWidth;
varying float vCinnabar;
varying float vAlpha;
void main() {
  float hw = vWidth * 0.5;
  float x = vSide * (hw + uPad);
  // 毛边：两侧各自起伏
  float n = snoise(vec2(vAlong * 0.06, sign(x) * 5.0));
  float edgeW = hw * (1.0 + 0.3 * n);
  float core = 1.0 - smoothstep(edgeW - 0.7, edgeW + 0.7, abs(x));
  // 飞白：顺着笔势的细丝
  float streak = snoise(vec2(vAlong * 0.012, x / max(hw, 0.8) * 1.3));
  core *= mix(1.0, smoothstep(-0.55, 0.25, streak), uDry);
  // 浓淡：沿线缓慢起伏
  float density = 0.82 + 0.18 * snoise(vec2(vAlong * 0.004, 0.5));
  float glow = exp(-pow(abs(x) / (hw * 3.0 + 4.0), 2.0)) * 0.42 * vCinnabar;
  float a = (core * density + glow * (1.0 - core)) * vAlpha * uAlpha;
  gl_FragColor = vec4(spineColor(vCinnabar) * (1.0 + 0.25 * glow), a);
}
`;

/** 笔尖那一点：开场是一点朱砂，停笔时墨在这里慢慢洇开 */
const tipFragment = /* glsl */ `
precision highp float;
${NOISE}
${COLOR}
uniform float uRadius;   // 像素
uniform float uSize;     // 四边形边长，像素
uniform float uCinnabar;
uniform float uAlpha;
uniform float uSeed;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = length(p);
  float n = inkField(p / max(uRadius, 1.0) * 0.9 + uSeed);
  float r = uRadius * (1.0 + 0.22 * n);
  float core = 1.0 - smoothstep(r - 0.8, r + 0.8, d);
  float glow = exp(-pow(d / (uRadius * 2.6 + 4.0), 2.0)) * 0.5 * uCinnabar;
  float a = (core + glow * (1.0 - core)) * uAlpha;
  gl_FragColor = vec4(spineColor(uCinnabar), a);
}
`;

const tipVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export interface SpinePoint {
  x: number;
  y: number;
  state: SpineState;
}

export function createSpine() {
  const geometry = new BufferGeometry();
  const vertexCount = MAX_POINTS * 2;
  const position = new BufferAttribute(new Float32Array(vertexCount * 3), 3);
  const side = new BufferAttribute(new Float32Array(vertexCount), 1);
  const along = new BufferAttribute(new Float32Array(vertexCount), 1);
  const width = new BufferAttribute(new Float32Array(vertexCount), 1);
  const cinnabar = new BufferAttribute(new Float32Array(vertexCount), 1);
  const alpha = new BufferAttribute(new Float32Array(vertexCount), 1);
  for (const attr of [position, along, width, cinnabar, alpha]) {
    attr.setUsage(DynamicDrawUsage);
  }
  for (let i = 0; i < MAX_POINTS; i++) {
    side.setX(i * 2, -1);
    side.setX(i * 2 + 1, 1);
  }
  geometry.setAttribute("position", position);
  geometry.setAttribute("aSide", side);
  geometry.setAttribute("aAlong", along);
  geometry.setAttribute("aWidth", width);
  geometry.setAttribute("aCinnabar", cinnabar);
  geometry.setAttribute("aAlpha", alpha);
  const index: number[] = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(index);

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    uniforms: {
      uPad: { value: GLOW_PAD },
      uDry: { value: 0.55 },
      uAlpha: { value: 1 },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const tipMaterial = new ShaderMaterial({
    vertexShader: tipVertex,
    fragmentShader: tipFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uRadius: { value: 2 },
      uSize: { value: 64 },
      uCinnabar: { value: 1 },
      uAlpha: { value: 1 },
      uSeed: { value: 0 },
    },
  });
  const tip = new Mesh(new PlaneGeometry(1, 1), tipMaterial);
  tip.frustumCulled = false;
  tip.renderOrder = 3;

  const n = new Vector2();

  return {
    mesh,
    tip,
    /**
     * points：从线头到笔尖的折线（CSS 像素，y 向下）；
     * alongStart：第一个点在整根线上的弧长，飞白随卷面滚动而不是贴在屏幕上
     */
    update(points: SpinePoint[], alongStart: number, opacity: number) {
      const count = Math.min(points.length, MAX_POINTS);
      let s = alongStart;
      for (let i = 0; i < count; i++) {
        const p = points[i];
        const prev = points[Math.max(i - 1, 0)];
        const next = points[Math.min(i + 1, count - 1)];
        n.set(-(next.y - prev.y), next.x - prev.x);
        if (n.lengthSq() < 1e-6) n.set(1, 0);
        n.normalize();
        if (i > 0) s += Math.hypot(p.x - prev.x, p.y - prev.y);
        // 线头收笔：最后几像素收细
        const taper = Math.min(1, (count - 1 - i) / 6 + 0.35);
        const half = (p.state.width * taper) / 2 + GLOW_PAD;
        for (const [k, sign] of [
          [i * 2, -1],
          [i * 2 + 1, 1],
        ] as const) {
          position.setXYZ(k, p.x + n.x * half * sign, p.y + n.y * half * sign, 0);
          along.setX(k, s);
          width.setX(k, p.state.width * taper);
          cinnabar.setX(k, p.state.cinnabar);
          alpha.setX(k, p.state.alpha);
        }
      }
      geometry.setDrawRange(0, Math.max(0, (count - 1) * 6));
      for (const attr of [position, along, width, cinnabar, alpha]) {
        attr.needsUpdate = true;
      }
      material.uniforms.uAlpha.value = opacity;
      mesh.visible = count > 1 && opacity > 0.001;
    },
    updateTip(
      x: number,
      y: number,
      radius: number,
      state: SpineState,
      opacity: number,
      seed: number,
    ) {
      const size = radius * 6 + 24;
      tip.position.set(x, y, 0);
      tip.scale.set(size, size, 1);
      const u = tipMaterial.uniforms;
      u.uRadius.value = radius;
      u.uSize.value = size;
      u.uCinnabar.value = state.cinnabar;
      u.uAlpha.value = opacity * state.alpha;
      u.uSeed.value = seed;
      tip.visible = opacity > 0.001;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      tip.geometry.dispose();
      tipMaterial.dispose();
    },
  };
}
