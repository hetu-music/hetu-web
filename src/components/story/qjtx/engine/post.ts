/**
 * 后期：辉光、暗角、胶片颗粒，由 postprocessing 合并成一遍。
 * 色差、镜头震动只留给高潮的回，打样的两回用不到。
 */

import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from "postprocessing";
import {
  type Camera,
  HalfFloatType,
  type Scene,
  type WebGLRenderer,
} from "three";
import type { Style } from "./types";

export function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  style: Style,
) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceSmoothing: 0.2,
    radius: 0.7,
  });
  const vignette = new VignetteEffect({ offset: 0.3 });
  const noise = new NoiseEffect({
    blendFunction: BlendFunction.OVERLAY,
    premultiply: true,
  });
  composer.addPass(new EffectPass(camera, bloom, vignette, noise));

  const apply = (next: Style) => {
    bloom.intensity = next.post.bloom;
    bloom.luminanceMaterial.threshold = next.post.bloomThreshold;
    vignette.darkness = next.post.vignette;
    noise.blendMode.opacity.value = next.post.grain;
  };
  apply(style);

  return {
    composer,
    setStyle: apply,
    setSize(width: number, height: number) {
      composer.setSize(width, height);
    },
    render(delta: number) {
      composer.render(delta);
    },
    dispose() {
      composer.dispose();
    },
  };
}
