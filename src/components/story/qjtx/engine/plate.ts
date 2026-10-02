/**
 * 图像平面：铺满屏幕的一张插图，带深度视差、墨晕遮罩、调色与文字后的局部压暗。
 * 画在一个全屏四边形上，所有计算都在片元着色器里，镜头只是几个 uniform。
 */

import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { NOISE } from "./shaders/noise";
import type { Grade, Style } from "./types";

const vertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
${NOISE}

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform float uHasImage;
uniform vec2 uView;        // 设备像素
uniform float uDpr;
uniform vec2 uAnchor;      // 设备像素，左上为原点
uniform vec2 uCamUV;
uniform vec2 uScale;       // 整张图在屏幕上的尺寸，设备像素
uniform vec2 uShift;
uniform float uDolly;
uniform float uFocus;

uniform vec2 uInkCenter;   // 设备像素
uniform float uInkRadius;
uniform float uInkScale;
uniform float uInkRough;
uniform float uInkRim;
uniform float uInkRimDark;
uniform float uInkWet;
uniform vec3 uInkTint;
uniform float uInkSeed;
uniform float uReveal;

uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uTint;

uniform vec4 uShadeRect;   // x, y, w, h 设备像素
uniform float uShade;

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

vec2 parallax(vec2 uv0) {
  float h = texture(uDepth, uv0).r;
  vec2 off = (h - uFocus) * (uShift + (uv0 - uCamUV) * uDolly);
  // 再取一次深度，近处的轮廓才不会被拖出重影
  h = texture(uDepth, clamp(uv0 - off, 0.0, 1.0)).r;
  off = (h - uFocus) * (uShift + (uv0 - uCamUV) * uDolly);
  return clamp(uv0 - off, 0.0, 1.0);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);

  // 墨晕：半径随噪声起伏，边缘积墨、内侧湿润
  vec2 q = frag / (uInkScale * uDpr) + vec2(uInkSeed * 13.7, uInkSeed * 7.1);
  float n = inkField(q);
  float d = distance(frag, uInkCenter);
  float edge = uInkRadius * (1.0 + uInkRough * n);
  float sdf = edge - d;
  float soft = 1.5 * uDpr + uInkRadius * 0.004;
  float mask = smoothstep(-soft, soft, sdf);
  float rimW = uInkRim * uDpr;
  float rim = (1.0 - smoothstep(0.0, rimW, sdf)) * mask;
  float wet = (1.0 - smoothstep(0.0, rimW * 5.0, sdf)) * mask * uInkWet;

  if (mask * uReveal <= 0.001 || uHasImage < 0.5) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 uv = parallax(uCamUV + (frag - uAnchor) / uScale);
  vec3 col = textureLod(uImage, uv, wet * 3.5).rgb;

  // 调色
  col *= uExposure * uTint;
  col = (col - 0.5) * uContrast + 0.5;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSaturation * (1.0 - wet * 0.6));

  // 文字后面局部压暗，只压那一块，不压整张图
  vec2 c = uShadeRect.xy + uShadeRect.zw * 0.5;
  float feather = 90.0 * uDpr;
  float sd = roundBox(frag - c, uShadeRect.zw * 0.5, 24.0 * uDpr);
  col *= 1.0 - uShade * (1.0 - smoothstep(-feather * 0.3, feather, sd));

  // 积墨的边：先染上线的颜色，再沉下去
  col = mix(col, uInkTint * 0.6, rim * 0.45);
  col *= 1.0 - rim * uInkRimDark;

  col = clamp(col, 0.0, 1.0) * mask * uReveal;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface PlateUniforms {
  view: { width: number; height: number; dpr: number };
  anchor: [number, number];
  camUV: [number, number];
  scale: [number, number];
  shift: [number, number];
  dolly: number;
  ink: { x: number; y: number; radius: number; seed: number; tint: [number, number, number] };
  reveal: number;
  shadeRect: [number, number, number, number];
  shade: number;
}

export function createPlate(style: Style) {
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uImage: { value: null },
      uDepth: { value: null },
      uHasImage: { value: 0 },
      uView: { value: new Vector2(1, 1) },
      uDpr: { value: 1 },
      uAnchor: { value: new Vector2() },
      uCamUV: { value: new Vector2(0.5, 0.5) },
      uScale: { value: new Vector2(1, 1) },
      uShift: { value: new Vector2() },
      uDolly: { value: 0 },
      uFocus: { value: 0.45 },
      uInkCenter: { value: new Vector2() },
      uInkRadius: { value: 0 },
      uInkScale: { value: style.ink.scale },
      uInkRough: { value: style.ink.roughness },
      uInkRim: { value: style.ink.rim },
      uInkRimDark: { value: style.ink.rimDarkness },
      uInkWet: { value: style.ink.wet },
      uInkTint: { value: new Vector3(0.6, 0.1, 0.1) },
      uInkSeed: { value: 0 },
      uReveal: { value: 1 },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uTint: { value: new Vector3(1, 1, 1) },
      uShadeRect: { value: new Vector4(0, 0, 0, 0) },
      uShade: { value: 0 },
    },
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  const u = material.uniforms;

  let current: Texture | null = null;

  return {
    mesh,
    setImage(image: Texture | null, depth: Texture | null, grade?: Grade) {
      if (image !== current) {
        current = image;
        u.uImage.value = image;
        u.uDepth.value = depth;
        u.uHasImage.value = image && depth ? 1 : 0;
      }
      if (grade) {
        u.uExposure.value = grade.exposure;
        u.uContrast.value = grade.contrast;
        u.uSaturation.value = grade.saturation;
        (u.uTint.value as Vector3).set(...grade.tint);
      }
    },
    setStyle(next: Style) {
      u.uInkScale.value = next.ink.scale;
      u.uInkRough.value = next.ink.roughness;
      u.uInkRim.value = next.ink.rim;
      u.uInkRimDark.value = next.ink.rimDarkness;
      u.uInkWet.value = next.ink.wet;
    },
    update(p: PlateUniforms) {
      const { dpr } = p.view;
      (u.uView.value as Vector2).set(p.view.width * dpr, p.view.height * dpr);
      u.uDpr.value = dpr;
      (u.uAnchor.value as Vector2).set(p.anchor[0] * dpr, p.anchor[1] * dpr);
      (u.uCamUV.value as Vector2).set(...p.camUV);
      (u.uScale.value as Vector2).set(p.scale[0] * dpr, p.scale[1] * dpr);
      (u.uShift.value as Vector2).set(...p.shift);
      u.uDolly.value = p.dolly;
      (u.uInkCenter.value as Vector2).set(p.ink.x * dpr, p.ink.y * dpr);
      u.uInkRadius.value = p.ink.radius * dpr;
      u.uInkSeed.value = p.ink.seed;
      (u.uInkTint.value as Vector3).set(...p.ink.tint);
      u.uReveal.value = p.reveal;
      const [x, y, w, h] = p.shadeRect;
      (u.uShadeRect.value as Vector4).set(x * dpr, y * dpr, w * dpr, h * dpr);
      u.uShade.value = p.shade;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
