/**
 * 方向一「古籍绢本舆图 · 总图与厢图」的版式与地理意象数据。
 *
 * 与原 layout.ts 的地铁折线不同，这里采用自然蜿蜒的样条河道 + 变宽书法笔触，
 * 并借鉴古舆图「总图 + 厢图（附图）」的智慧：
 * - 总图（1560 × 1040）疏朗留白，把长沙（11处）、沅陵（9处）、赣州（3处）收成三枚聚落印记；
 * - 点开任一聚落，展开对应的「厢图」细部画卷，各站沿江错落呼吸。
 */

export type LabelDir = "l" | "r" | "a" | "b";

export interface OrganicRiver {
  id: string;
  name: string;
  /** 从河口（下游）写向上游，自然曲流控制点 */
  pts: [number, number][];
  /** 河口最宽处（px），上游自动渐收如游丝 */
  mouthWidth: number;
  sourceWidth?: number;
  bothTaper?: boolean;
  dashed?: boolean;
  /** 伴行极淡细波纹的偏移 */
  rippleOffset?: number;
  delay: number;
  label?: { x: number; y: number; vertical?: boolean; large?: boolean };
}

export interface MountainSilhouette {
  id: string;
  ridge: [number, number][];
  baseY: number;
  /** 1 = 远山淡墨，2 = 中景淡青绿，3 = 赭石近坡 */
  tone: 1 | 2 | 3;
  opacity: number;
}

export interface AtlasStop {
  id: number;
  x: number;
  y: number;
  dir: LabelDir;
  /** 是否用竖排站名 */
  vertical?: boolean;
}

export type ClusterId = "changsha" | "yuanling" | "ganzhou";

export interface AtlasCluster {
  id: ClusterId;
  name: string;
  subtitle: string;
  countLabel: string;
  /** 总图上的聚落坐标 */
  x: number;
  y: number;
  labelDir: LabelDir;
  /** 收纳在此厢图里的地点 id */
  placeIds: number[];
  /** 厢图画布尺寸 */
  view: { width: number; height: number };
  /** 厢图局部河道 */
  rivers: OrganicRiver[];
  /** 厢图局部山影 */
  mountains: MountainSilhouette[];
  /** 厢图里的江心洲/城廓装饰（可选） */
  islets?: string[];
  /** 厢图各站坐标 */
  stops: AtlasStop[];
}

export const ATLAS_VIEW = { width: 1560, height: 1040 };

/** 蜿蜒古图海岸线：辽东/渤海湾 → 山东蓬莱岬 → 苏北 → 长江口 → 杭州湾 → 东海 */
export const COASTLINE_PTS: [number, number][] = [
  [1295, 75],
  [1265, 135],
  [1240, 185],
  [1290, 225],
  [1342, 248], // 山东半岛蓬莱
  [1285, 295],
  [1272, 355],
  [1295, 420], // 长江口北
  [1318, 488], // 杭州湾口
  [1275, 558],
  [1305, 645],
  [1265, 765],
  [1215, 885],
];

/** 写意远山层峦：只点缀四方山水大势，中间大量留白 */
export const OVERVIEW_MOUNTAINS: MountainSilhouette[] = [
  // 东北长白峰峦
  {
    id: "m-changbai",
    ridge: [
      [1155, 118],
      [1195, 82],
      [1235, 62],
      [1270, 74],
      [1315, 108],
      [1355, 126],
    ],
    baseY: 165,
    tone: 1,
    opacity: 0.3,
  },
  // 西北祁连 / 敦煌苍山
  {
    id: "m-qilian",
    ridge: [
      [85, 245],
      [145, 205],
      [205, 182],
      [265, 212],
      [335, 194],
      [395, 238],
      [445, 255],
    ],
    baseY: 305,
    tone: 3,
    opacity: 0.28,
  },
  // 秦岭山脉（长安南侧）
  {
    id: "m-qinling",
    ridge: [
      [425, 365],
      [505, 326],
      [575, 312],
      [645, 332],
      [715, 320],
      [785, 358],
    ],
    baseY: 408,
    tone: 2,
    opacity: 0.25,
  },
  // 西南雪域高原（布达拉宫北背）
  {
    id: "m-tibet-back",
    ridge: [
      [60, 675],
      [130, 618],
      [195, 588],
      [265, 612],
      [330, 650],
      [390, 685],
    ],
    baseY: 750,
    tone: 1,
    opacity: 0.34,
  },
  {
    id: "m-tibet-front",
    ridge: [
      [105, 705],
      [175, 652],
      [245, 668],
      [315, 695],
    ],
    baseY: 770,
    tone: 2,
    opacity: 0.22,
  },
  // 武陵 / 巫山群峰（沅水西侧）
  {
    id: "m-wuling",
    ridge: [
      [330, 745],
      [385, 695],
      [435, 665],
      [485, 702],
      [530, 755],
    ],
    baseY: 825,
    tone: 2,
    opacity: 0.26,
  },
  // 南岭 / 衡岳余脉（湘赣之南）
  {
    id: "m-nanling",
    ridge: [
      [580, 880],
      [660, 835],
      [735, 818],
      [815, 848],
      [900, 832],
      [985, 882],
    ],
    baseY: 945,
    tone: 1,
    opacity: 0.24,
  },
  // 江南烟雨丘陵
  {
    id: "m-jiangnan",
    ridge: [
      [1015, 655],
      [1080, 622],
      [1140, 636],
      [1205, 618],
      [1265, 658],
    ],
    baseY: 710,
    tone: 2,
    opacity: 0.22,
  },
];

/** 东海简笔传统水波纹坐标 */
export const SEA_RIPPLES: { x: number; y: number; scale: number }[] = [
  { x: 1385, y: 175, scale: 1 },
  { x: 1415, y: 315, scale: 1.15 },
  { x: 1365, y: 395, scale: 0.9 },
  { x: 1405, y: 525, scale: 1.2 },
  { x: 1365, y: 665, scale: 1 },
  { x: 1335, y: 795, scale: 0.95 },
];

export const OVERVIEW_SEAS = [
  { name: "渤海", x: 1358, y: 158 },
  { name: "黄海", x: 1388, y: 355 },
  { name: "东海", x: 1388, y: 590 },
];

/** 有机洞庭湖水域形态（代替死板的粗线段） */
export const DONGTING_LAKE_PATH =
  "M 668 552 C 685 538, 722 542, 728 564 C 734 585, 708 606, 682 602 C 656 598, 648 568, 668 552 Z";

/** 总图蜿蜒水系（从河口溯流向上） */
export const OVERVIEW_RIVERS: OrganicRiver[] = [
  {
    id: "changjiang",
    name: "长江",
    pts: [
      [1295, 488],
      [1190, 484],
      [1085, 495],
      [975, 535],
      [865, 558],
      [755, 552],
      [645, 560],
      [530, 540],
      [415, 552],
      [295, 520],
      [180, 485],
    ],
    mouthWidth: 9.5,
    sourceWidth: 1.0,
    rippleOffset: 7.5,
    delay: 0.15,
    label: { x: 465, y: 522, large: true },
  },
  {
    id: "huanghe",
    name: "黄河",
    pts: [
      [1265, 222],
      [1140, 246],
      [1010, 265],
      [880, 272],
      [750, 258],
      [660, 212],
      [585, 165],
      [490, 170],
      [395, 210],
    ],
    mouthWidth: 7.5,
    sourceWidth: 0.9,
    rippleOffset: -6,
    delay: 0.35,
    label: { x: 960, y: 245, large: true },
  },
  {
    id: "haihe",
    name: "海河",
    pts: [
      [1246, 166],
      [1155, 162],
      [1055, 152],
      [965, 156],
    ],
    mouthWidth: 4.0,
    sourceWidth: 0.6,
    delay: 0.55,
    label: { x: 1005, y: 128 },
  },
  {
    id: "bianshui",
    name: "古汴水",
    pts: [
      [1272, 355],
      [1175, 350],
      [1065, 344],
      [975, 352],
    ],
    mouthWidth: 3.0,
    sourceWidth: 0.6,
    dashed: true,
    delay: 0.7,
    label: { x: 1020, y: 332 },
  },
  {
    id: "qiantang",
    name: "钱塘江",
    pts: [
      [1285, 565],
      [1205, 588],
      [1120, 608],
      [1045, 622],
    ],
    mouthWidth: 5.5,
    sourceWidth: 0.7,
    delay: 0.6,
    label: { x: 1055, y: 604 },
  },
  {
    id: "huangpu",
    name: "黄浦江",
    pts: [
      [1255, 488],
      [1242, 520],
      [1235, 548],
    ],
    mouthWidth: 3.6,
    sourceWidth: 0.7,
    delay: 0.45,
  },
  {
    id: "chuhe",
    name: "滁河",
    pts: [
      [1108, 492],
      [1072, 464],
      [1020, 444],
      [970, 448],
    ],
    mouthWidth: 3.2,
    sourceWidth: 0.6,
    delay: 0.7,
    label: { x: 968, y: 432 },
  },
  {
    id: "ganjiang",
    name: "赣江",
    pts: [
      [920, 545],
      [924, 625],
      [938, 715],
      [928, 815],
      [910, 880],
    ],
    mouthWidth: 5.0,
    sourceWidth: 0.7,
    delay: 0.9,
    label: { x: 954, y: 655, vertical: true },
  },
  {
    id: "xiangjiang",
    name: "湘江",
    pts: [
      [698, 594],
      [712, 668],
      [715, 745],
      [692, 828],
      [665, 905],
    ],
    mouthWidth: 5.4,
    sourceWidth: 0.8,
    delay: 1.0,
    label: { x: 740, y: 785, vertical: true },
  },
  {
    id: "yuanshui",
    name: "沅水",
    pts: [
      [666, 588],
      [602, 636],
      [545, 698],
      [496, 775],
      [462, 860],
    ],
    mouthWidth: 5.0,
    sourceWidth: 0.8,
    delay: 1.05,
    label: { x: 582, y: 702, vertical: true },
  },
  {
    id: "luohe",
    name: "洛河",
    pts: [
      [855, 272],
      [805, 302],
      [742, 316],
    ],
    mouthWidth: 3.2,
    sourceWidth: 0.6,
    delay: 0.8,
    label: { x: 830, y: 312 },
  },
  {
    id: "weihe",
    name: "渭河",
    pts: [
      [740, 260],
      [670, 294],
      [585, 306],
      [505, 300],
    ],
    mouthWidth: 3.6,
    sourceWidth: 0.6,
    delay: 0.85,
    label: { x: 648, y: 282 },
  },
  {
    id: "songhua",
    name: "松花江",
    pts: [
      [1265, 96],
      [1212, 72],
      [1155, 58],
    ],
    mouthWidth: 3.4,
    sourceWidth: 0.6,
    delay: 0.95,
    label: { x: 1128, y: 58 },
  },
  {
    id: "dangquan",
    name: "宕泉",
    pts: [
      [255, 318],
      [232, 262],
      [216, 206],
    ],
    mouthWidth: 3.0,
    sourceWidth: 0.5,
    bothTaper: true,
    delay: 1.0,
    label: { x: 245, y: 218 },
  },
  {
    id: "lasa",
    name: "拉萨河",
    pts: [
      [115, 742],
      [210, 730],
      [305, 738],
      [375, 752],
    ],
    mouthWidth: 3.4,
    sourceWidth: 0.6,
    bothTaper: true,
    delay: 1.05,
    label: { x: 318, y: 718 },
  },
];

/** 总图上直接展露的 22 处独立地点（疏朗有致，无一重叠） */
export const OVERVIEW_STOPS: AtlasStop[] = [
  // 海河 · 京师
  { id: 1, x: 1172, y: 162, dir: "a", vertical: true }, // 文昌阁
  { id: 2, x: 1112, y: 158, dir: "a", vertical: true }, // 鸟巢
  { id: 3, x: 1052, y: 152, dir: "a", vertical: true }, // 故宫午门

  // 松花江 · 长白
  { id: 43, x: 1226, y: 78, dir: "r" }, // 长白山

  // 海岸
  { id: 4, x: 1336, y: 246, dir: "r" }, // 蓬莱阁
  { id: 5, x: 1272, y: 372, dir: "r" }, // 宝塔镇

  // 古汴水
  { id: 6, x: 1120, y: 347, dir: "a" }, // 徐州

  // 洛河 & 渭河
  { id: 7, x: 782, y: 309, dir: "b" }, // 洛阳
  { id: 8, x: 585, y: 306, dir: "b" }, // 西安

  // 长江下游 & 滁河 & 黄浦江
  { id: 9, x: 1242, y: 522, dir: "r" }, // 黄浦江
  { id: 10, x: 1044, y: 452, dir: "a" }, // 滁州
  { id: 11, x: 1086, y: 495, dir: "b" }, // 南京

  // 钱塘江 · 杭州
  { id: 40, x: 1222, y: 583, dir: "b", vertical: true }, // 杭州
  { id: 41, x: 1166, y: 598, dir: "b", vertical: true }, // 一半勾留
  { id: 42, x: 1106, y: 611, dir: "b", vertical: true }, // 西湖十景

  // 长江中上游 & 洞庭
  { id: 12, x: 822, y: 556, dir: "a" }, // 文赤壁
  { id: 17, x: 696, y: 572, dir: "a" }, // 洞庭湖
  { id: 13, x: 356, y: 538, dir: "a" }, // 江阳

  // 湘江源 & 沅江口
  { id: 28, x: 682, y: 856, dir: "r" }, // 蘋岛
  { id: 30, x: 608, y: 632, dir: "l" }, // 沅江

  // 西域 & 高原
  { id: 45, x: 234, y: 268, dir: "r" }, // 莫高窟
  { id: 44, x: 210, y: 730, dir: "b" }, // 布达拉宫
];

/** 三幅「厢图（Inset）」：把最密集的三处水乡做成可点开细赏的局部手卷 */
export const CLUSTERS: AtlasCluster[] = [
  {
    id: "changsha",
    name: "长沙",
    subtitle: "湘江 · 浏阳河厢图",
    countLabel: "十一处",
    x: 714,
    y: 716,
    labelDir: "r",
    placeIds: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29],
    view: { width: 920, height: 680 },
    rivers: [
      {
        id: "cs-xiang",
        name: "湘江",
        pts: [
          [435, 38],
          [420, 145],
          [442, 265],
          [456, 395],
          [440, 520],
          [418, 640],
        ],
        mouthWidth: 26,
        sourceWidth: 16,
        rippleOffset: 16,
        delay: 0.05,
        label: { x: 472, y: 590, vertical: true, large: true },
      },
      {
        id: "cs-liuyang",
        name: "浏阳河",
        pts: [
          [444, 272],
          [535, 290],
          [640, 265],
          [750, 296],
          [855, 280],
        ],
        mouthWidth: 9,
        sourceWidth: 2,
        delay: 0.2,
        label: { x: 635, y: 248 },
      },
    ],
    // 橘子洲（江心沙洲）
    islets: [
      "M 444 338 C 451 355, 454 415, 449 468 C 446 485, 439 485, 437 468 C 434 418, 437 355, 444 338 Z",
    ],
    mountains: [
      // 岳麓山主峰（湘江西岸）
      {
        id: "cs-yuelu-1",
        ridge: [
          [95, 425],
          [165, 365],
          [235, 338],
          [305, 368],
          [358, 415],
        ],
        baseY: 505,
        tone: 2,
        opacity: 0.34,
      },
      {
        id: "cs-yuelu-2",
        ridge: [
          [125, 480],
          [198, 422],
          [268, 436],
          [340, 482],
        ],
        baseY: 558,
        tone: 1,
        opacity: 0.22,
      },
      // 东岸远丘
      {
        id: "cs-east",
        ridge: [
          [620, 170],
          [705, 138],
          [785, 152],
          [855, 185],
        ],
        baseY: 225,
        tone: 1,
        opacity: 0.2,
      },
    ],
    stops: [
      { id: 18, x: 426, y: 92, dir: "r" }, // 左公故里（湘阴）
      { id: 19, x: 424, y: 158, dir: "l" }, // 乔口镇
      { id: 20, x: 432, y: 215, dir: "r" }, // 铜官古镇
      { id: 21, x: 444, y: 288, dir: "l" }, // 湘江
      { id: 22, x: 355, y: 342, dir: "l" }, // 渔阳墓
      { id: 23, x: 256, y: 392, dir: "l" }, // 岳麓山
      { id: 25, x: 334, y: 454, dir: "l" }, // 赫曦台
      { id: 27, x: 284, y: 522, dir: "l" }, // 自卑亭
      { id: 24, x: 492, y: 418, dir: "r" }, // 杜甫江阁
      { id: 26, x: 548, y: 486, dir: "r" }, // 定王台
      { id: 29, x: 752, y: 294, dir: "b" }, // 谭嗣同故居（浏阳）
    ],
  },
  {
    id: "yuanling",
    name: "沅陵",
    subtitle: "沅水 · 武陵峡谷厢图",
    countLabel: "九处",
    x: 522,
    y: 734,
    labelDir: "l",
    placeIds: [31, 32, 33, 34, 35, 36, 37, 38, 39],
    view: { width: 920, height: 680 },
    rivers: [
      {
        id: "yl-yuan",
        name: "沅水",
        pts: [
          [855, 130],
          [740, 175],
          [630, 265],
          [510, 320],
          [400, 390],
          [285, 445],
          [165, 510],
          [75, 575],
        ],
        mouthWidth: 20,
        sourceWidth: 10,
        rippleOffset: 13,
        delay: 0.05,
        label: { x: 745, y: 122, large: true },
      },
      {
        id: "yl-youshui",
        name: "酉水",
        pts: [
          [295, 440],
          [225, 360],
          [155, 295],
          [95, 240],
        ],
        mouthWidth: 7.5,
        sourceWidth: 1.8,
        delay: 0.25,
        label: { x: 168, y: 270 },
      },
    ],
    mountains: [
      // 武陵北岸群峰（壶头山、凤凰山、二酉山）
      {
        id: "yl-north-1",
        ridge: [
          [65, 215],
          [160, 148],
          [265, 182],
          [385, 132],
          [495, 175],
          [610, 125],
          [710, 165],
        ],
        baseY: 270,
        tone: 1,
        opacity: 0.3,
      },
      // 南岸峭壁（清浪滩、明月山）
      {
        id: "yl-south-1",
        ridge: [
          [340, 560],
          [445, 488],
          [555, 515],
          [665, 448],
          [790, 495],
          [865, 550],
        ],
        baseY: 645,
        tone: 2,
        opacity: 0.32,
      },
    ],
    stops: [
      { id: 31, x: 778, y: 162, dir: "b" }, // 五强溪古栈道
      { id: 32, x: 682, y: 222, dir: "r" }, // 瓮子洞
      { id: 33, x: 604, y: 276, dir: "b" }, // 清浪乡
      { id: 34, x: 516, y: 256, dir: "a" }, // 壶头山
      { id: 35, x: 472, y: 416, dir: "b" }, // 明月山
      { id: 36, x: 398, y: 348, dir: "a" }, // 龙兴讲寺
      { id: 37, x: 342, y: 420, dir: "b" }, // 武陵桥
      { id: 38, x: 256, y: 492, dir: "b" }, // 凤凰山
      { id: 39, x: 165, y: 318, dir: "r" }, // 二酉山
    ],
  },
  {
    id: "ganzhou",
    name: "赣州",
    subtitle: "章贡合流 · 宋城厢图",
    countLabel: "三处",
    x: 932,
    y: 765,
    labelDir: "r",
    placeIds: [14, 15, 16],
    view: { width: 820, height: 600 },
    rivers: [
      // 赣江北去
      {
        id: "gz-gan",
        name: "赣江",
        pts: [
          [420, 45],
          [416, 130],
          [410, 210],
        ],
        mouthWidth: 24,
        sourceWidth: 16,
        delay: 0.05,
        label: { x: 446, y: 110, vertical: true, large: true },
      },
      // 章水（自西而来）
      {
        id: "gz-zhang",
        name: "章水",
        pts: [
          [410, 210],
          [332, 286],
          [265, 395],
          [190, 515],
        ],
        mouthWidth: 14,
        sourceWidth: 5,
        delay: 0.15,
        label: { x: 258, y: 355 },
      },
      // 贡水（自东而来）
      {
        id: "gz-gong",
        name: "贡水",
        pts: [
          [410, 210],
          [505, 290],
          [580, 405],
          [665, 520],
        ],
        mouthWidth: 15,
        sourceWidth: 5.5,
        delay: 0.15,
        label: { x: 562, y: 355 },
      },
    ],
    mountains: [
      {
        id: "gz-hill",
        ridge: [
          [140, 200],
          [220, 152],
          [300, 178],
          [350, 215],
        ],
        baseY: 265,
        tone: 2,
        opacity: 0.26,
      },
      {
        id: "gz-east",
        ridge: [
          [520, 210],
          [615, 158],
          [705, 195],
        ],
        baseY: 268,
        tone: 1,
        opacity: 0.24,
      },
    ],
    stops: [
      { id: 14, x: 410, y: 236, dir: "b" }, // 八境台（章贡合流龟角尾）
      { id: 16, x: 342, y: 342, dir: "r" }, // 郁孤台（贺兰山巅）
      { id: 15, x: 476, y: 382, dir: "r" }, // 慈云塔（城东古塔）
    ],
  },
];

/** 按地点 id 查它归属哪个厢图（不在厢图里则返回 null） */
export function clusterOfPlace(placeId: number): AtlasCluster | null {
  return CLUSTERS.find((c) => c.placeIds.includes(placeId)) ?? null;
}
