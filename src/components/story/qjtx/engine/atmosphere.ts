/**
 * 氛围粒子：雪、尘等。位置全在顶点着色器里按时间算，CPU 不逐帧搬数据。
 * 每颗粒子有自己的远近：近的大、快、虚，远的小、慢、实，镜头前才有景深。
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import type { AtmosphereKind } from "./types";

const MAX = 1600;

interface Preset {
  count: number;
  /** 每秒落下多少屏（负数向上飘） */
  fall: number;
  /** 横向飘荡幅度（屏） */
  sway: number;
  /** 恒定横风（屏/秒） */
  wind: number;
  /** 最远处的粒径，像素 */
  size: number;
  color: [number, number, number];
  opacity: number;
  additive: boolean;
}

const PRESETS: Record<Exclude<AtmosphereKind, "none">, Preset> = {
  snow: {
    count: 1400,
    fall: 0.07,
    sway: 0.012,
    wind: 0.012,
    size: 2.4,
    color: [0.95, 0.96, 1],
    opacity: 0.85,
    additive: false,
  },
  dust: {
    count: 500,
    fall: -0.006,
    sway: 0.02,
    wind: 0.003,
    size: 1.8,
    color: [1, 0.86, 0.62],
    opacity: 0.7,
    additive: true,
  },
  rain: {
    count: 1200,
    fall: 1.1,
    sway: 0,
    wind: 0.05,
    size: 1.4,
    color: [0.8, 0.88, 0.95],
    opacity: 0.5,
    additive: false,
  },
  embers: {
    count: 400,
    fall: -0.12,
    sway: 0.03,
    wind: 0.01,
    size: 2.2,
    color: [1, 0.45, 0.15],
    opacity: 0.9,
    additive: true,
  },
};

const vertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec2 uView;
uniform float uDpr;
uniform float uFall;
uniform float uSway;
uniform float uWind;
uniform float uSize;
varying float vBlur;
varying float vAlpha;
varying float vTwinkle;
void main() {
  // z：1 最远，0.15 贴着镜头
  float z = mix(0.15, 1.0, aSeed.z);
  float speed = mix(0.7, 1.3, aSeed.w) / z;
  float y = fract(aSeed.y + uTime * uFall * speed);
  float phase = uTime * mix(0.4, 1.1, aSeed.w) + aSeed.x * 40.0;
  float x = fract(aSeed.x + uTime * uWind / z + sin(phase) * uSway / z);
  vec2 screen = vec2(x * 1.2 - 0.1, y * 1.2 - 0.1) * uView;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(screen, 0.0, 1.0);
  float near = smoothstep(0.42, 0.15, z);
  gl_PointSize = uSize / z * uDpr * (1.0 + near * 2.5);
  vBlur = near;
  vAlpha = mix(0.35, 1.0, 1.0 - aSeed.z) * (1.0 - near * 0.55);
  vTwinkle = 0.75 + 0.25 * sin(uTime * mix(1.0, 3.0, aSeed.x) + aSeed.y * 30.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vBlur;
varying float vAlpha;
varying float vTwinkle;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(1.0 - (0.35 + vBlur * 0.6), 1.0, r);
  a *= vAlpha * vTwinkle * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export function createAtmosphere() {
  const geometry = new BufferGeometry();
  const seeds = new Float32Array(MAX * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(MAX * 3), 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uView: { value: new Vector2(1, 1) },
      uDpr: { value: 1 },
      uFall: { value: 0 },
      uSway: { value: 0 },
      uWind: { value: 0 },
      uSize: { value: 2 },
      uColor: { value: new Vector3(1, 1, 1) },
      uOpacity: { value: 0 },
    },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  const u = material.uniforms;
  let kind: AtmosphereKind = "none";

  return {
    points,
    update(
      next: AtmosphereKind,
      density: number,
      opacity: number,
      time: number,
      view: { width: number; height: number; dpr: number },
    ) {
      if (next !== kind) {
        kind = next;
        if (next !== "none") {
          const p = PRESETS[next];
          u.uFall.value = p.fall;
          u.uSway.value = p.sway;
          u.uWind.value = p.wind;
          u.uSize.value = p.size;
          (u.uColor.value as Vector3).set(...p.color);
          material.blending = p.additive ? AdditiveBlending : NormalBlending;
          material.needsUpdate = true;
        }
      }
      const preset = next === "none" ? null : PRESETS[next];
      points.visible = !!preset && opacity > 0.001;
      if (!preset) return;
      geometry.setDrawRange(0, Math.round(Math.min(MAX, preset.count * density)));
      u.uTime.value = time;
      (u.uView.value as Vector2).set(view.width, view.height);
      u.uDpr.value = view.dpr;
      u.uOpacity.value = opacity * preset.opacity;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
