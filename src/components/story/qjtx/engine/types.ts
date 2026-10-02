/**
 * 滚动叙事的数据形状：一回由若干「拍」组成，拍声明自己占几屏、停还是转、怎么剪。
 * 坐标一律用 0..1 比例：换了分辨率不同的原图，配置不用改。
 */

export type Cut = "dissolve" | "hard" | "ink" | "thread" | "rupture";

export type BeatKind =
  | "come"
  | "open"
  | "title"
  | "text"
  | "colophon"
  | "close"
  | "silence";

/** 线在某一处的样子 */
export interface SpineState {
  /** 笔画宽度，CSS 像素 */
  width: number;
  /** 0 淡墨 → 1 朱红 */
  cinnabar: number;
  /** 0..1 颤动 */
  tremor: number;
  /** 0..1 不透明度 */
  alpha: number;
}

/**
 * 镜头：图上 (x, y) 这一点放在屏幕上的 (ax, ay)，zoom 为相对「铺满屏幕」的倍数。
 * ax / ay 省略时为屏幕正中。
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  ax?: number;
  ay?: number;
}

/** 图上的一块矩形（0..1），文字就放在这里 */
export interface TextRect {
  x: number;
  y: number;
  w: number;
  h: number;
  vertical?: boolean;
  /** 文字后面局部压暗的程度，0..1 */
  shade?: number;
}

export interface Beat {
  kind: BeatKind;
  /** 占几屏 */
  length: number;
  cut?: Cut;
  /** 正文下标区间（含两端） */
  lines?: [number, number];
  /** 本拍结束时的镜头 */
  camera?: CameraState;
  text?: TextRect;
}

export interface Grade {
  exposure: number;
  contrast: number;
  saturation: number;
  /** 乘在画面上的色调 */
  tint: [number, number, number];
}

export type AtmosphereKind = "snow" | "dust" | "rain" | "embers" | "none";

export interface Scene {
  id: number;
  /** 素材清单里的键 */
  image: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  grade: Grade;
  atmosphere: { kind: AtmosphereKind; density: number };
  /** 视差强度：镜头平移 / 推近时，近处比远处多走多少 */
  parallax: number;
  /** 墨从图上哪一点晕开（缺省为镜头锚点） */
  inkOrigin?: [number, number];
  /** 线入画（cut = thread）时，画中那根线的路径，从入画处到线头 */
  thread?: [number, number][];
  /** 回目大字的颜色 */
  titleColor?: string;
  beats: Beat[];
}

/** 时间线上的事件，取自 story_qjtx */
export interface StoryEvent {
  id: number;
  year: string;
  month?: string;
  content: string[];
  important: boolean;
  detail?: {
    title: string;
    quote?: string;
    body: string[];
    closing?: string;
  };
}

export interface SpineConfig {
  /** 开场那一点朱砂 */
  opening: SpineState;
  /** 各事件节点处线的样子；节点之间插值 */
  nodes: Record<string, Partial<SpineState>>;
  /** 普通事件占几屏 */
  eventLength: number;
}

export interface Style {
  ink: {
    /** 墨晕边缘噪声的尺度（屏幕像素） */
    scale: number;
    /** 边缘起伏，占半径的比例 */
    roughness: number;
    /** 晕开边缘积墨的宽度（像素）与浓度 */
    rim: number;
    rimDarkness: number;
    /** 刚晕开处的湿润模糊 */
    wet: number;
  };
  post: {
    bloom: number;
    bloomThreshold: number;
    grain: number;
    vignette: number;
  };
}
