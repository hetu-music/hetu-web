/**
 * 方向二「溯洄横卷 · 平远水墨长卷」的画卷版式数据（5400 × 860）。
 *
 * 依中国传统手卷「自右向左」展阅：
 * - 最右（x ≈ 5200）：卷首引题「河图志 · 溯洄」与东海入海口；
 * - 向左一路逆流而上，历经五段景致：
 *   1. 沧海东望（海河燕京 · 东海 · 钱塘杭州 · 金陵淮扬）
 *   2. 赣水楚天（赣州三台 · 黄州赤壁 · 洞庭烟波）
 *   3. 潇湘烟雨（湘江两岸与岳麓十二处，舒展排开）
 *   4. 沅陵深谷（武陵十处奇峰险滩，《沅水谣》婉转其间）
 *   5. 关山雪域（蜀中江阳 · 洛阳长安 · 敦煌莫高 · 雪域拉萨）
 * - 最左（x ≈ 140）：卷尾跋语与落款。
 */

import type { LabelDir, MountainSilhouette, OrganicRiver } from "./atlas-data";

export const SCROLL_W = 5400;
export const SCROLL_H = 860;

export interface ScrollChapter {
  id: string;
  name: string;
  subtitle: string;
  /** 章节中心 x（供底部导览条点击滑行） */
  anchorX: number;
  range: [number, number];
}

export interface ScrollStop {
  id: number;
  x: number;
  y: number;
  dir: LabelDir;
  vertical?: boolean;
  chapter: string;
}

export interface ScrollInscription {
  text: string;
  x: number;
  y: number;
  size?: number;
}

/** 从左（卷尾）到右（卷首）排列，与底部横条视觉方向一致 */
export const SCROLL_CHAPTERS: ScrollChapter[] = [
  {
    id: "west",
    name: "关山雪域",
    subtitle: "江阳 · 长安 · 敦煌 · 拉萨",
    anchorX: 540,
    range: [0, 1080],
  },
  {
    id: "yuanling",
    name: "沅陵深谷",
    subtitle: "武陵十处 · 沅水谣",
    anchorX: 1580,
    range: [1080, 2080],
  },
  {
    id: "xiaoxiang",
    name: "潇湘烟雨",
    subtitle: "湘江 · 岳麓 · 浏阳 · 永州",
    anchorX: 2620,
    range: [2080, 3180],
  },
  {
    id: "chutian",
    name: "赣水楚天",
    subtitle: "赣州三台 · 赤壁 · 洞庭",
    anchorX: 3600,
    range: [3180, 4020],
  },
  {
    id: "east",
    name: "沧海东望",
    subtitle: "蓬莱 · 燕京 · 杭苏 · 金陵",
    anchorX: 4620,
    range: [4020, 5400],
  },
];

/** 远景山脉层（视差慢速移动：由东海平远丘陵 → 潇湘烟峦 → 武陵险峰 → 关山雪岭） */
export const FAR_MOUNTAINS: MountainSilhouette[] = [
  // 极西：雪域高原大雪山
  {
    id: "far-snow",
    ridge: [
      [-120, 440],
      [60, 260],
      [210, 155],
      [360, 225],
      [510, 130],
      [680, 240],
      [860, 345],
    ],
    baseY: 540,
    tone: 1,
    opacity: 0.34,
  },
  // 西北：秦岭与大漠沙丘
  {
    id: "far-qin",
    ridge: [
      [780, 385],
      [960, 275],
      [1150, 240],
      [1340, 295],
      [1520, 355],
    ],
    baseY: 520,
    tone: 3,
    opacity: 0.24,
  },
  // 武陵群峰（险峻高耸）
  {
    id: "far-wuling",
    ridge: [
      [1380, 400],
      [1560, 210],
      [1720, 265],
      [1890, 185],
      [2080, 270],
      [2240, 385],
    ],
    baseY: 540,
    tone: 2,
    opacity: 0.3,
  },
  // 潇湘衡岳烟岚
  {
    id: "far-xiang",
    ridge: [
      [2260, 415],
      [2460, 285],
      [2680, 245],
      [2900, 295],
      [3140, 370],
      [3340, 420],
    ],
    baseY: 560,
    tone: 1,
    opacity: 0.25,
  },
  // 庐山 / 赣楚远黛
  {
    id: "far-chu",
    ridge: [
      [3350, 425],
      [3580, 315],
      [3820, 290],
      [4050, 355],
      [4280, 430],
    ],
    baseY: 560,
    tone: 2,
    opacity: 0.22,
  },
  // 江南远岫与东海长白北望
  {
    id: "far-east",
    ridge: [
      [4260, 420],
      [4480, 325],
      [4690, 275],
      [4920, 310],
      [5120, 380],
      [5480, 435],
    ],
    baseY: 540,
    tone: 1,
    opacity: 0.22,
  },
];

/** 中景淡青绿墨峦（略贴近水面，营造三远景深） */
export const MID_MOUNTAINS: MountainSilhouette[] = [
  {
    id: "mid-1",
    ridge: [
      [120, 560],
      [310, 455],
      [490, 485],
      [690, 425],
      [900, 520],
    ],
    baseY: 675,
    tone: 2,
    opacity: 0.24,
  },
  {
    id: "mid-2",
    ridge: [
      [1180, 585],
      [1390, 465],
      [1620, 435],
      [1820, 490],
      [2040, 445],
      [2220, 565],
    ],
    baseY: 710,
    tone: 2,
    opacity: 0.28,
  },
  {
    id: "mid-3",
    ridge: [
      [2340, 610],
      [2560, 505],
      [2780, 470],
      [3010, 525],
      [3220, 615],
    ],
    baseY: 745,
    tone: 3,
    opacity: 0.22,
  },
  {
    id: "mid-4",
    ridge: [
      [3520, 635],
      [3760, 535],
      [3990, 558],
      [4200, 640],
    ],
    baseY: 760,
    tone: 2,
    opacity: 0.2,
  },
  {
    id: "mid-5",
    ridge: [
      [4420, 625],
      [4640, 555],
      [4850, 580],
      [5050, 645],
    ],
    baseY: 760,
    tone: 1,
    opacity: 0.18,
  },
];

/** 贯通整卷的主水脉与支流（从右往左溯流而上） */
export const SCROLL_RIVERS: OrganicRiver[] = [
  // 贯通全卷的长江主水脉
  {
    id: "sc-changjiang",
    name: "长江",
    pts: [
      [4960, 495],
      [4760, 502],
      [4520, 488],
      [4240, 478],
      [3960, 485],
      [3680, 456],
      [3400, 472],
      [3100, 498],
      [2720, 465],
      [2340, 480],
      [2020, 470],
      [1640, 495],
      [1280, 478],
      [960, 450],
      [680, 462],
    ],
    mouthWidth: 14,
    sourceWidth: 1.5,
    rippleOffset: 10,
    delay: 0.1,
    label: { x: 4070, y: 458, large: true },
  },
  // 燕京海河 & 松花江（右上方北国水脉）
  {
    id: "sc-north",
    name: "海河 · 松花江",
    pts: [
      [4920, 290],
      [4740, 250],
      [4540, 255],
      [4330, 265],
      [4140, 240],
    ],
    mouthWidth: 5.5,
    sourceWidth: 0.8,
    delay: 0.2,
    label: { x: 4320, y: 218 },
  },
  // 古汴水（徐州）
  {
    id: "sc-bianshui",
    name: "古汴水",
    pts: [
      [4820, 382],
      [4640, 376],
      [4440, 385],
      [4280, 392],
    ],
    mouthWidth: 3.4,
    sourceWidth: 0.7,
    dashed: true,
    delay: 0.25,
    label: { x: 4410, y: 364 },
  },
  // 钱塘江（杭州三处，右下方江南水脉）
  {
    id: "sc-qiantang",
    name: "钱塘江",
    pts: [
      [4920, 625],
      [4740, 650],
      [4520, 668],
      [4300, 656],
      [4120, 668],
    ],
    mouthWidth: 7.5,
    sourceWidth: 1.0,
    rippleOffset: 6,
    delay: 0.2,
    label: { x: 4230, y: 696 },
  },
  // 赣江（赣州三台，从长江中游向南舒展）
  {
    id: "sc-ganjiang",
    name: "赣江",
    pts: [
      [3860, 482],
      [3790, 565],
      [3680, 645],
      [3540, 692],
      [3380, 710],
    ],
    mouthWidth: 7,
    sourceWidth: 1.0,
    delay: 0.3,
    label: { x: 3560, y: 732 },
  },
  // 湘江（第三段主角：宽阔蜿蜒贯穿潇湘烟雨）
  {
    id: "sc-xiangjiang",
    name: "湘江",
    pts: [
      [3350, 478],
      [3180, 558],
      [2980, 610],
      [2760, 588],
      [2540, 622],
      [2320, 655],
      [2120, 695],
    ],
    mouthWidth: 10.5,
    sourceWidth: 1.6,
    rippleOffset: 8,
    delay: 0.35,
    label: { x: 2630, y: 658, large: true },
  },
  // 浏阳河（从湘江分出）
  {
    id: "sc-liuyang",
    name: "浏阳河",
    pts: [
      [2680, 594],
      [2580, 695],
      [2460, 738],
      [2340, 750],
    ],
    mouthWidth: 4.2,
    sourceWidth: 0.8,
    delay: 0.4,
    label: { x: 2470, y: 768 },
  },
  // 沅水（第四段主角：武陵深谷）
  {
    id: "sc-yuanshui",
    name: "沅水",
    pts: [
      [2060, 472],
      [1920, 545],
      [1760, 585],
      [1600, 545],
      [1430, 598],
      [1260, 640],
      [1090, 615],
    ],
    mouthWidth: 9.5,
    sourceWidth: 1.4,
    rippleOffset: 7.5,
    delay: 0.4,
    label: { x: 1580, y: 632, large: true },
  },
  // 黄河 · 洛渭（第五段上方中原古道）
  {
    id: "sc-huanghe",
    name: "黄河 · 洛渭",
    pts: [
      [1180, 320],
      [1020, 290],
      [850, 315],
      [680, 295],
      [510, 330],
    ],
    mouthWidth: 7.0,
    sourceWidth: 1.1,
    bothTaper: true,
    delay: 0.45,
    label: { x: 860, y: 274, large: true },
  },
  // 宕泉（敦煌莫高窟）
  {
    id: "sc-dangquan",
    name: "宕泉",
    pts: [
      [560, 250],
      [460, 220],
      [370, 232],
    ],
    mouthWidth: 3.4,
    sourceWidth: 0.6,
    bothTaper: true,
    delay: 0.5,
    label: { x: 465, y: 196 },
  },
  // 拉萨河（雪域极西）
  {
    id: "sc-lasa",
    name: "拉萨河",
    pts: [
      [520, 625],
      [410, 610],
      [295, 622],
      [195, 608],
    ],
    mouthWidth: 5.5,
    sourceWidth: 0.8,
    bothTaper: true,
    delay: 0.55,
    label: { x: 315, y: 658 },
  },
];

/** 画卷空白处的淡墨题诗水印（营造宋画题跋意境） */
export const SCROLL_INSCRIPTIONS: ScrollInscription[] = [
  { text: "溯洄从之", x: 4990, y: 210, size: 19 },
  { text: "千里飞渡 洞庭波", x: 3440, y: 215, size: 18 },
  { text: "湘江泼墨化云霭", x: 2660, y: 210, size: 19 },
  { text: "清浪滩现云上帆", x: 1640, y: 210, size: 19 },
  { text: "故事里的长安", x: 760, y: 185, size: 18 },
  { text: "拉萨雪纷乱了几千年", x: 255, y: 265, size: 17 },
];

/** 全部 45 处地点在 5400px 长卷中的舒展坐标（绝无拥挤重叠） */
export const SCROLL_STOPS: ScrollStop[] = [
  // ─── 一、沧海东望（右端入海口） ───
  { id: 4, x: 4860, y: 365, dir: "a", vertical: true, chapter: "east" }, // 蓬莱阁
  { id: 5, x: 4845, y: 465, dir: "r", chapter: "east" }, // 宝塔镇
  { id: 9, x: 4790, y: 515, dir: "b", vertical: true, chapter: "east" }, // 黄浦江

  // 东北 & 京师（北岸）
  { id: 43, x: 4820, y: 262, dir: "a", chapter: "east" }, // 长白山
  { id: 1, x: 4665, y: 250, dir: "a", vertical: true, chapter: "east" }, // 文昌阁
  { id: 2, x: 4545, y: 256, dir: "b", vertical: true, chapter: "east" }, // 鸟巢
  { id: 3, x: 4415, y: 262, dir: "a", vertical: true, chapter: "east" }, // 故宫午门

  // 古汴水 & 淮扬金陵
  { id: 6, x: 4550, y: 380, dir: "a", chapter: "east" }, // 徐州
  { id: 11, x: 4395, y: 482, dir: "b", chapter: "east" }, // 南京
  { id: 10, x: 4250, y: 445, dir: "a", chapter: "east" }, // 滁州

  // 钱塘杭州（南岸）
  { id: 40, x: 4725, y: 650, dir: "b", vertical: true, chapter: "east" }, // 杭州
  { id: 41, x: 4545, y: 666, dir: "a", vertical: true, chapter: "east" }, // 一半勾留
  { id: 42, x: 4355, y: 658, dir: "b", vertical: true, chapter: "east" }, // 西湖十景

  // ─── 二、赣水楚天 ───
  { id: 14, x: 3775, y: 575, dir: "r", chapter: "chutian" }, // 八境台
  { id: 15, x: 3675, y: 646, dir: "r", chapter: "chutian" }, // 慈云塔
  { id: 16, x: 3530, y: 692, dir: "l", chapter: "chutian" }, // 郁孤台
  { id: 12, x: 3685, y: 455, dir: "a", vertical: true, chapter: "chutian" }, // 文赤壁
  { id: 17, x: 3395, y: 472, dir: "a", vertical: true, chapter: "chutian" }, // 洞庭湖

  // ─── 三、潇湘烟雨（12 处全数舒展） ───
  { id: 18, x: 3205, y: 548, dir: "r", chapter: "xiaoxiang" }, // 左公故里
  { id: 19, x: 3090, y: 585, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 乔口镇
  { id: 20, x: 2980, y: 610, dir: "b", vertical: true, chapter: "xiaoxiang" }, // 铜官古镇
  { id: 21, x: 2865, y: 595, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 湘江
  { id: 22, x: 2775, y: 542, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 渔阳墓
  { id: 23, x: 2665, y: 505, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 岳麓山
  { id: 24, x: 2725, y: 604, dir: "b", vertical: true, chapter: "xiaoxiang" }, // 杜甫江阁
  { id: 25, x: 2565, y: 562, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 赫曦台
  { id: 26, x: 2480, y: 628, dir: "b", vertical: true, chapter: "xiaoxiang" }, // 定王台
  { id: 27, x: 2375, y: 585, dir: "a", vertical: true, chapter: "xiaoxiang" }, // 自卑亭
  { id: 29, x: 2450, y: 738, dir: "l", chapter: "xiaoxiang" }, // 谭嗣同故居（浏阳）
  { id: 28, x: 2170, y: 685, dir: "b", chapter: "xiaoxiang" }, // 蘋岛（永州）

  // ─── 四、沅陵深谷（10 处峰回路转） ───
  { id: 30, x: 2025, y: 492, dir: "a", vertical: true, chapter: "yuanling" }, // 沅江
  { id: 31, x: 1925, y: 545, dir: "b", vertical: true, chapter: "yuanling" }, // 五强溪古栈道
  { id: 32, x: 1820, y: 572, dir: "a", vertical: true, chapter: "yuanling" }, // 瓮子洞
  { id: 33, x: 1715, y: 576, dir: "b", vertical: true, chapter: "yuanling" }, // 清浪乡
  { id: 34, x: 1615, y: 542, dir: "a", vertical: true, chapter: "yuanling" }, // 壶头山
  { id: 35, x: 1515, y: 572, dir: "b", vertical: true, chapter: "yuanling" }, // 明月山
  { id: 36, x: 1418, y: 598, dir: "a", vertical: true, chapter: "yuanling" }, // 龙兴讲寺
  { id: 37, x: 1325, y: 626, dir: "b", vertical: true, chapter: "yuanling" }, // 武陵桥
  { id: 38, x: 1228, y: 632, dir: "a", vertical: true, chapter: "yuanling" }, // 凤凰山
  { id: 39, x: 1125, y: 618, dir: "b", vertical: true, chapter: "yuanling" }, // 二酉山

  // ─── 五、关山雪域（西行收卷） ───
  { id: 13, x: 965, y: 452, dir: "b", vertical: true, chapter: "west" }, // 江阳
  { id: 7, x: 970, y: 298, dir: "a", vertical: true, chapter: "west" }, // 洛阳
  { id: 8, x: 750, y: 304, dir: "b", vertical: true, chapter: "west" }, // 西安
  { id: 45, x: 465, y: 222, dir: "b", vertical: true, chapter: "west" }, // 莫高窟
  { id: 44, x: 355, y: 614, dir: "a", vertical: true, chapter: "west" }, // 布达拉宫
];
