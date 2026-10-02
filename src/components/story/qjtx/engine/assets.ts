/**
 * 素材：按清单选档、后台解码、提前上传 GPU。
 * 读者下一回要看哪张图是确定的，所以总能在用到之前准备好；解码走 createImageBitmap，不占主线程。
 */

import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  Texture,
  type WebGLRenderer,
} from "three";
import manifestJson from "../assets.manifest.json";

export interface PlateAsset {
  width: number;
  height: number;
  variants: { width: number; src: string }[];
  depth: string;
  placeholder: string;
}

export const MANIFEST = manifestJson as Record<string, PlateAsset>;

export interface LoadedPlate {
  image: Texture;
  depth: Texture;
  /** 原图宽高比，换档不变 */
  aspect: number;
}

async function bitmap(src: string): Promise<ImageBitmap> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status} ${src}`);
  // ImageBitmap 的行序从上到下，配合 flipY = false，着色器里 uv 的原点就在左上
  return createImageBitmap(await res.blob(), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
}

/** 取不小于所需宽度的最小一档；都不够就取最大的 */
export function pickVariant(asset: PlateAsset, neededWidth: number) {
  return (
    asset.variants.find((v) => v.width >= neededWidth) ??
    asset.variants[asset.variants.length - 1]
  );
}

export function createAssets(renderer: WebGLRenderer) {
  const cache = new Map<string, Promise<LoadedPlate>>();
  const ready = new Map<string, LoadedPlate>();

  const load = (key: string, neededWidth: number) => {
    const existing = cache.get(key);
    if (existing) return existing;
    const asset = MANIFEST[key];
    if (!asset) return Promise.reject(new Error(`素材清单里没有 ${key}`));
    const promise = Promise.all([
      bitmap(pickVariant(asset, neededWidth).src),
      bitmap(asset.depth),
    ]).then(([img, dep]) => {
      const image = new Texture(img);
      image.flipY = false;
      image.colorSpace = SRGBColorSpace;
      image.generateMipmaps = true;
      image.minFilter = LinearMipmapLinearFilter;
      image.magFilter = LinearFilter;
      image.anisotropy = renderer.capabilities.getMaxAnisotropy();
      image.needsUpdate = true;
      const depth = new Texture(dep);
      depth.flipY = false;
      depth.colorSpace = NoColorSpace;
      depth.generateMipmaps = false;
      depth.minFilter = LinearFilter;
      depth.needsUpdate = true;
      // 现在就传上 GPU，晕开那一帧不再有额外工作
      renderer.initTexture(image);
      renderer.initTexture(depth);
      const plate = { image, depth, aspect: asset.width / asset.height };
      ready.set(key, plate);
      return plate;
    });
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  };

  return {
    load,
    get: (key: string) => ready.get(key) ?? null,
    /** 只留这几张在 GPU 里，其余释放 */
    keep(keys: string[]) {
      for (const [key, plate] of ready) {
        if (keys.includes(key)) continue;
        plate.image.dispose();
        plate.depth.dispose();
        ready.delete(key);
        cache.delete(key);
      }
    },
    dispose() {
      for (const plate of ready.values()) {
        plate.image.dispose();
        plate.depth.dispose();
      }
      ready.clear();
      cache.clear();
    },
  };
}
