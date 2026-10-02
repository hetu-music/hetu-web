/**
 * 回目大字：用刻本字体画进 canvas，转成纹理，和墨用同一套噪声溶进溶出。
 * 只有几十个字，代价很小，却能做到 DOM 做不到的「被墨吞吐」。
 */

import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";
import { NOISE } from "./shaders/noise";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;
${NOISE}
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uIn;
uniform float uOut;
uniform float uAspect;
uniform float uSeed;
varying vec2 vUv;
void main() {
  // 平面在 y 向下的相机里翻过一次，配上 CanvasTexture 默认的 flipY，正好是正的
  vec2 uv = vUv;
  float a = texture(uMap, uv).a;
  float n = inkField(vec2(uv.x * uAspect, uv.y) * 2.2 + uSeed) * 0.5 + 0.5;
  float front = uIn * 1.3 - 0.15;
  float shown = smoothstep(n - 0.06, n + 0.06, front);
  // 墨还湿的地方往外洇一点
  float wetBand = shown * (1.0 - smoothstep(0.0, 0.18, front - n));
  float bleed = textureLod(uMap, uv, 3.0).a * wetBand * 0.55;
  float back = uOut * 1.3 - 0.15;
  float gone = smoothstep(n - 0.06, n + 0.06, back);
  float alpha = max(a * shown, bleed) * (1.0 - gone);
  gl_FragColor = vec4(uColor * (1.0 - wetBand * 0.35), alpha);
}
`;

export interface GlyphRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 字号与排布都按矩形算：竖排一列从上到下，横排一行 */
function drawGlyphs(
  text: string,
  font: string,
  vertical: boolean,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const chars = Array.from(text);
  const size = vertical
    ? Math.min(width * 0.9, (height / chars.length) * 0.92)
    : Math.min(height * 0.9, (width / chars.length) * 0.92);
  ctx.fillStyle = "#fff";
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = (vertical ? height : width) / chars.length;
  chars.forEach((ch, i) => {
    const c = step * (i + 0.5);
    if (vertical) ctx.fillText(ch, width / 2, c);
    else ctx.fillText(ch, c, height / 2);
  });
  return canvas;
}

export function createGlyph(
  text: string,
  font: string,
  vertical: boolean,
  color: string,
  seed: number,
) {
  const geometry = new PlaneGeometry(1, 1);
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uMap: { value: null },
      uColor: { value: new Color(color) },
      uIn: { value: 0 },
      uOut: { value: 0 },
      uAspect: { value: 1 },
      uSeed: { value: seed },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.visible = false;
  let texture: CanvasTexture | null = null;
  let size = "";

  return {
    mesh,
    /** 矩形是 CSS 像素；尺寸变了才重画纹理 */
    update(rect: GlyphRect, reveal: number, exit: number, dpr: number) {
      const w = Math.max(8, Math.round(rect.w * dpr));
      const h = Math.max(8, Math.round(rect.h * dpr));
      const key = `${w}x${h}`;
      if (key !== size) {
        size = key;
        texture?.dispose();
        texture = new CanvasTexture(drawGlyphs(text, font, vertical, w, h));
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        material.uniforms.uMap.value = texture;
        material.uniforms.uAspect.value = w / h;
      }
      mesh.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2, 0);
      // 相机 y 轴向下，平面要翻一下才不会倒过来
      mesh.scale.set(rect.w, -rect.h, 1);
      material.uniforms.uIn.value = reveal;
      material.uniforms.uOut.value = exit;
      mesh.visible = reveal > 0.001 && exit < 0.999;
    },
    hide() {
      mesh.visible = false;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    },
  };
}
