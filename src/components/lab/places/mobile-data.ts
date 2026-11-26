/**
 * 方案一移动端原生构图数据：
 * - M1「溯洄立轴」：宽 420 × 高 3520，单指顺水自上而下展阅的一整幅竖向水墨挂轴；
 * - M2「方域册页」：6 幅专为 3:4 竖屏（420 × 560）精绘的独立水墨小画，零缩放左右翻阅。
 *
 * 两套均完整覆盖全部 45 处地点（id 1..45），坐标按手机竖幅比例全新创作，非宽屏缩放妥协。
 */

import type { LabelDir, MountainSilhouette, OrganicRiver } from "./atlas-data";

export interface MobileStop {
  id: number;
  x: number;
  y: number;
  dir: LabelDir;
  vertical?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// M1：溯洄立轴（420 × 3520）
// ══════════════════════════════════════════════════════════════════════════════

export const HANGING_W = 420;
export const HANGING_H = 3520;

export interface HangingChapter {
  id: string;
  name: string;
  subtitle: string;
  y: number;
  side: "l" | "r";
}

export const HANGING_CHAPTERS: HangingChapter[] = [
  { id: "east", name: "沧海东望", subtitle: "海河 · 东海 · 钱塘", y: 270, side: "r" },
  { id: "chutian", name: "赣水楚天", subtitle: "赣江 · 赤壁 · 洞庭", y: 1020, side: "l" },
  { id: "xiaoxiang", name: "潇湘烟雨", subtitle: "湘江 · 岳麓 · 浏阳", y: 1475, side: "r" },
  { id: "yuanling", name: "沅陵深谷", subtitle: "武陵十处 · 沅水谣", y: 2240, side: "l" },
  { id: "west", name: "关山雪域", subtitle: "蜀道 · 长安 · 雪域", y: 2945, side: "r" },
];

export const HANGING_MOUNTAINS: MountainSilhouette[] = [
  // 东海远岫
  {
    id: "hm-1",
    ridge: [
      [10, 390],
      [75, 338],
      [135, 355],
      [195, 385],
    ],
    baseY: 455,
    tone: 1,
    opacity: 0.24,
  },
  // 江南烟丘
  {
    id: "hm-2",
    ridge: [
      [230, 810],
      [295, 760],
      [355, 775],
      [412, 815],
    ],
    baseY: 880,
    tone: 2,
    opacity: 0.22,
  },
  // 赣楚群山
  {
    id: "hm-3",
    ridge: [
      [10, 1210],
      [85, 1140],
      [165, 1172],
      [230, 1225],
    ],
    baseY: 1295,
    tone: 2,
    opacity: 0.24,
  },
  // 岳麓主峰（湘江西岸）
  {
    id: "hm-4",
    ridge: [
      [0, 1810],
      [68, 1732],
      [138, 1758],
      [205, 1825],
    ],
    baseY: 1920,
    tone: 2,
    opacity: 0.3,
  },
  // 衡岳余脉
  {
    id: "hm-5",
    ridge: [
      [245, 2110],
      [318, 2050],
      [385, 2075],
      [420, 2120],
    ],
    baseY: 2195,
    tone: 1,
    opacity: 0.22,
  },
  // 武陵峭壁（左）
  {
    id: "hm-6",
    ridge: [
      [0, 2490],
      [72, 2395],
      [142, 2435],
      [200, 2500],
    ],
    baseY: 2610,
    tone: 2,
    opacity: 0.3,
  },
  // 武陵峭壁（右）
  {
    id: "hm-7",
    ridge: [
      [235, 2750],
      [310, 2655],
      [375, 2685],
      [420, 2755],
    ],
    baseY: 2860,
    tone: 1,
    opacity: 0.28,
  },
  // 秦岭与敦煌苍山
  {
    id: "hm-8",
    ridge: [
      [15, 3145],
      [95, 3080],
      [180, 3110],
      [265, 3075],
      [350, 3130],
    ],
    baseY: 3220,
    tone: 3,
    opacity: 0.26,
  },
  // 雪域高原远雪峰
  {
    id: "hm-9",
    ridge: [
      [0, 3360],
      [95, 3260],
      [185, 3295],
      [285, 3240],
      [375, 3295],
      [420, 3350],
    ],
    baseY: 3445,
    tone: 1,
    opacity: 0.32,
  },
];

export const HANGING_RIVERS: OrganicRiver[] = [
  // 贯通全轴的 S 形主水脉（从顶部东海口蜿蜒南下溯洄至西南雪域）
  {
    id: "hr-main",
    name: "长江",
    pts: [
      [215, 230],
      [235, 360],
      [205, 515],
      [175, 675],
      [220, 845],
      [255, 1020],
      [210, 1200],
      [210, 1345],
      [225, 1525],
      [205, 1735],
      [228, 1955],
      [195, 2175],
      [185, 2385],
      [228, 2595],
      [195, 2810],
      [210, 3005],
      [180, 3195],
      [215, 3365],
    ],
    mouthWidth: 11,
    sourceWidth: 1.5,
    rippleOffset: 8,
    delay: 0.05,
    label: { x: 248, y: 695, vertical: true, large: true },
  },
  // 北国海河与长白短支（顶部左侧分出）
  {
    id: "hr-haihe",
    name: "海河",
    pts: [
      [228, 300],
      [165, 332],
      [105, 390],
      [85, 455],
    ],
    mouthWidth: 4.5,
    sourceWidth: 0.8,
    delay: 0.1,
    label: { x: 140, y: 318 },
  },
  // 海岸蓬莱/盐城短支（顶部右侧）
  {
    id: "hr-coast",
    name: "东海",
    pts: [
      [224, 345],
      [300, 415],
      [315, 495],
    ],
    mouthWidth: 2.6,
    sourceWidth: 0.8,
    dashed: true,
    delay: 0.12,
  },
  // 古汴水（徐州）
  {
    id: "hr-bian",
    name: "古汴水",
    pts: [
      [205, 520],
      [125, 540],
      [75, 575],
    ],
    mouthWidth: 3.2,
    sourceWidth: 0.7,
    dashed: true,
    delay: 0.15,
    label: { x: 115, y: 525 },
  },
  // 钱塘江（杭州三处，右侧舒展）
  {
    id: "hr-qiantang",
    name: "钱塘江",
    pts: [
      [204, 775],
      [275, 815],
      [325, 880],
      [335, 955],
    ],
    mouthWidth: 5.5,
    sourceWidth: 0.9,
    delay: 0.18,
    label: { x: 292, y: 805 },
  },
  // 赣江（赣州三台，左侧弯出）
  {
    id: "hr-gan",
    name: "赣江",
    pts: [
      [246, 1050],
      [165, 1085],
      [115, 1150],
      [98, 1235],
    ],
    mouthWidth: 5.5,
    sourceWidth: 0.9,
    delay: 0.2,
    label: { x: 158, y: 1068 },
  },
  // 浏阳河（从湘江右侧弯出）
  {
    id: "hr-liuyang",
    name: "浏阳河",
    pts: [
      [212, 1690],
      [285, 1720],
      [335, 1768],
    ],
    mouthWidth: 3.6,
    sourceWidth: 0.8,
    delay: 0.25,
    label: { x: 292, y: 1706 },
  },
  // 酉水（沅陵段左侧短支至二酉山）
  {
    id: "hr-youshui",
    name: "酉水",
    pts: [
      [202, 2765],
      [135, 2810],
      [88, 2860],
    ],
    mouthWidth: 3.6,
    sourceWidth: 0.8,
    delay: 0.28,
    label: { x: 138, y: 2790 },
  },
  // 黄河 · 洛渭（第五境右侧弯出）
  {
    id: "hr-huanghe",
    name: "洛渭",
    pts: [
      [208, 2990],
      [285, 3035],
      [328, 3115],
    ],
    mouthWidth: 4.5,
    sourceWidth: 0.8,
    delay: 0.3,
    label: { x: 288, y: 3022 },
  },
];

/** 立轴 45 处地点坐标：按 420px 宽屏重新排布，纵向充裕留白，绝不拥挤 */
export const HANGING_STOPS: MobileStop[] = [
  // ─── 一、沧海东望 ───
  { id: 43, x: 162, y: 334, dir: "l" }, // 长白山
  { id: 1, x: 122, y: 374, dir: "l" }, // 文昌阁
  { id: 2, x: 100, y: 416, dir: "l" }, // 鸟巢
  { id: 3, x: 86, y: 460, dir: "r" }, // 故宫午门

  { id: 4, x: 296, y: 410, dir: "r" }, // 蓬莱阁
  { id: 5, x: 312, y: 478, dir: "r" }, // 宝塔镇

  { id: 6, x: 105, y: 556, dir: "l" }, // 徐州
  { id: 9, x: 196, y: 585, dir: "r" }, // 黄浦江
  { id: 11, x: 182, y: 642, dir: "l" }, // 南京
  { id: 10, x: 180, y: 702, dir: "l" }, // 滁州

  { id: 40, x: 282, y: 826, dir: "r" }, // 杭州
  { id: 41, x: 320, y: 882, dir: "l" }, // 一半勾留
  { id: 42, x: 334, y: 942, dir: "l" }, // 西湖十景

  // ─── 二、赣水楚天 ───
  { id: 12, x: 252, y: 1020, dir: "r" }, // 文赤壁
  { id: 14, x: 158, y: 1094, dir: "l" }, // 八境台
  { id: 15, x: 116, y: 1152, dir: "r" }, // 慈云塔
  { id: 16, x: 100, y: 1216, dir: "r" }, // 郁孤台
  { id: 17, x: 210, y: 1325, dir: "r" }, // 洞庭湖

  // ─── 三、潇湘烟雨（12 处沿湘江两岸错落排开） ───
  { id: 18, x: 218, y: 1445, dir: "l" }, // 左公故里
  { id: 19, x: 224, y: 1508, dir: "r" }, // 乔口镇
  { id: 20, x: 222, y: 1570, dir: "l" }, // 铜官古镇
  { id: 21, x: 214, y: 1632, dir: "r" }, // 湘江
  { id: 22, x: 208, y: 1692, dir: "l" }, // 渔阳墓
  { id: 29, x: 326, y: 1762, dir: "l" }, // 谭嗣同故居（浏阳）
  { id: 23, x: 204, y: 1756, dir: "l" }, // 岳麓山
  { id: 24, x: 214, y: 1824, dir: "r" }, // 杜甫江阁
  { id: 25, x: 222, y: 1888, dir: "l" }, // 赫曦台
  { id: 26, x: 226, y: 1952, dir: "r" }, // 定王台
  { id: 27, x: 218, y: 2016, dir: "l" }, // 自卑亭
  { id: 28, x: 202, y: 2096, dir: "r" }, // 蘋岛

  // ─── 四、沅陵深谷（10 处峰回路转） ───
  { id: 30, x: 190, y: 2225, dir: "r" }, // 沅江
  { id: 31, x: 186, y: 2292, dir: "l" }, // 五强溪古栈道
  { id: 32, x: 185, y: 2358, dir: "r" }, // 瓮子洞
  { id: 33, x: 196, y: 2424, dir: "l" }, // 清浪乡
  { id: 34, x: 212, y: 2490, dir: "r" }, // 壶头山
  { id: 35, x: 224, y: 2556, dir: "l" }, // 明月山
  { id: 36, x: 226, y: 2622, dir: "r" }, // 龙兴讲寺
  { id: 37, x: 216, y: 2688, dir: "l" }, // 武陵桥
  { id: 38, x: 204, y: 2754, dir: "r" }, // 凤凰山
  { id: 39, x: 102, y: 2846, dir: "r" }, // 二酉山

  // ─── 五、关山雪域 ───
  { id: 13, x: 205, y: 2965, dir: "l" }, // 江阳
  { id: 7, x: 285, y: 3042, dir: "r" }, // 洛阳
  { id: 8, x: 322, y: 3106, dir: "l" }, // 西安
  { id: 45, x: 182, y: 3198, dir: "l" }, // 莫高窟
  { id: 44, x: 210, y: 3338, dir: "r" }, // 布达拉宫
];

// ══════════════════════════════════════════════════════════════════════════════
// M2：方域册页（6 幅独立 420 × 560 竖版水墨小画）
// ══════════════════════════════════════════════════════════════════════════════

export const FOLIO_W = 420;
export const FOLIO_H = 560;

export interface FolioPage {
  id: string;
  numeral: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  colophon: string;
  /** 可选淡湖泊/江心洲路径 */
  waterShapes?: { d: string; kind: "lake" | "islet" }[];
  rivers: OrganicRiver[];
  mountains: MountainSilhouette[];
  stops: MobileStop[];
}

export const FOLIO_PAGES: FolioPage[] = [
  // ── 卷一 · 燕京东海（7 处） ──
  {
    id: "north-sea",
    numeral: "卷一",
    title: "燕京东海",
    shortTitle: "燕京",
    subtitle: "长白 · 海河 · 蓬莱 · 古汴",
    colophon: "紫禁朱门百年逝川，只留下这岛屿称作蓬莱。",
    rivers: [
      {
        id: "f1-coast",
        name: "渤海 · 黄海",
        pts: [
          [328, 70],
          [312, 165],
          [358, 255],
          [316, 365],
          [322, 485],
        ],
        mouthWidth: 2.2,
        sourceWidth: 1.0,
        dashed: true,
        delay: 0.05,
        label: { x: 368, y: 350, vertical: true },
      },
      {
        id: "f1-songhua",
        name: "松花江",
        pts: [
          [308, 108],
          [242, 82],
          [175, 92],
        ],
        mouthWidth: 4.5,
        sourceWidth: 0.8,
        delay: 0.1,
        label: { x: 205, y: 74 },
      },
      {
        id: "f1-haihe",
        name: "海河",
        pts: [
          [314, 198],
          [232, 192],
          [148, 206],
          [78, 195],
        ],
        mouthWidth: 6.2,
        sourceWidth: 1.0,
        rippleOffset: 6,
        delay: 0.12,
        label: { x: 108, y: 174, large: true },
      },
      {
        id: "f1-bianshui",
        name: "古汴水",
        pts: [
          [318, 412],
          [225, 404],
          [125, 422],
          [62, 412],
        ],
        mouthWidth: 4.2,
        sourceWidth: 0.8,
        dashed: true,
        delay: 0.18,
        label: { x: 130, y: 392 },
      },
    ],
    mountains: [
      {
        id: "f1-m1",
        ridge: [
          [160, 128],
          [222, 76],
          [282, 92],
          [340, 132],
        ],
        baseY: 168,
        tone: 1,
        opacity: 0.3,
      },
      {
        id: "f1-m2",
        ridge: [
          [28, 345],
          [105, 298],
          [180, 322],
          [245, 355],
        ],
        baseY: 398,
        tone: 2,
        opacity: 0.22,
      },
    ],
    stops: [
      { id: 43, x: 252, y: 88, dir: "a" }, // 长白山
      { id: 1, x: 242, y: 194, dir: "b", vertical: true }, // 文昌阁
      { id: 2, x: 176, y: 201, dir: "a", vertical: true }, // 鸟巢
      { id: 3, x: 112, y: 204, dir: "b", vertical: true }, // 故宫午门
      { id: 4, x: 350, y: 256, dir: "l" }, // 蓬莱阁
      { id: 5, x: 318, y: 416, dir: "l" }, // 宝塔镇
      { id: 6, x: 165, y: 415, dir: "b" }, // 徐州
    ],
  },

  // ── 卷二 · 金陵钱塘（6 处） ──
  {
    id: "jiangnan",
    numeral: "卷二",
    title: "金陵钱塘",
    shortTitle: "江南",
    subtitle: "长江下游 · 滁河 · 西湖十景",
    colophon: "金陵城灯火萧瑟秋意，抱剑观花西湖畔。",
    rivers: [
      {
        id: "f2-cj",
        name: "长江",
        pts: [
          [380, 215],
          [295, 220],
          [205, 245],
          [115, 255],
          [40, 280],
        ],
        mouthWidth: 12,
        sourceWidth: 2.2,
        rippleOffset: 9,
        delay: 0.05,
        label: { x: 245, y: 202, large: true },
      },
      {
        id: "f2-chuhe",
        name: "滁河",
        pts: [
          [192, 246],
          [148, 192],
          [92, 168],
        ],
        mouthWidth: 4.5,
        sourceWidth: 0.8,
        delay: 0.12,
        label: { x: 164, y: 184 },
      },
      {
        id: "f2-huangpu",
        name: "黄浦江",
        pts: [
          [332, 218],
          [318, 282],
          [306, 336],
        ],
        mouthWidth: 5.0,
        sourceWidth: 1.0,
        delay: 0.14,
      },
      {
        id: "f2-qiantang",
        name: "钱塘江",
        pts: [
          [378, 375],
          [292, 412],
          [195, 434],
          [98, 455],
        ],
        mouthWidth: 9.0,
        sourceWidth: 1.4,
        rippleOffset: 7,
        delay: 0.16,
        label: { x: 122, y: 416, large: true },
      },
    ],
    mountains: [
      {
        id: "f2-m1",
        ridge: [
          [20, 175],
          [88, 128],
          [158, 148],
          [225, 180],
        ],
        baseY: 225,
        tone: 2,
        opacity: 0.25,
      },
      {
        id: "f2-m2",
        ridge: [
          [90, 505],
          [175, 462],
          [260, 478],
          [350, 446],
          [405, 495],
        ],
        baseY: 545,
        tone: 1,
        opacity: 0.26,
      },
    ],
    stops: [
      { id: 10, x: 124, y: 178, dir: "l" }, // 滁州
      { id: 11, x: 192, y: 248, dir: "b" }, // 南京
      { id: 9, x: 316, y: 296, dir: "l" }, // 黄浦江
      { id: 40, x: 306, y: 406, dir: "b", vertical: true }, // 杭州
      { id: 41, x: 222, y: 428, dir: "a", vertical: true }, // 一半勾留
      { id: 42, x: 138, y: 448, dir: "b", vertical: true }, // 西湖十景
    ],
  },

  // ── 卷三 · 赣水楚天（5 处） ──
  {
    id: "chutian",
    numeral: "卷三",
    title: "赣水楚天",
    shortTitle: "赣楚",
    subtitle: "文赤壁 · 洞庭波 · 章贡合流",
    colophon: "郁孤台前清江，千里飞渡洞庭波。",
    waterShapes: [
      {
        d: "M 92 212 C 110 194, 152 198, 160 222 C 166 246, 138 270, 108 264 C 80 258, 74 228, 92 212 Z",
        kind: "lake",
      },
    ],
    rivers: [
      {
        id: "f3-cj",
        name: "长江",
        pts: [
          [390, 145],
          [305, 168],
          [215, 198],
          [125, 224],
          [35, 215],
        ],
        mouthWidth: 11.5,
        sourceWidth: 2.5,
        rippleOffset: 8,
        delay: 0.05,
        label: { x: 270, y: 146, large: true },
      },
      {
        id: "f3-gan",
        name: "赣江",
        pts: [
          [286, 174],
          [278, 255],
          [268, 336],
        ],
        mouthWidth: 9.0,
        sourceWidth: 5.5,
        delay: 0.12,
        label: { x: 296, y: 245, vertical: true },
      },
      {
        id: "f3-zhang",
        name: "章水",
        pts: [
          [268, 336],
          [210, 398],
          [148, 478],
        ],
        mouthWidth: 6.5,
        sourceWidth: 1.5,
        delay: 0.16,
        label: { x: 185, y: 446 },
      },
      {
        id: "f3-gong",
        name: "贡水",
        pts: [
          [268, 336],
          [326, 402],
          [372, 482],
        ],
        mouthWidth: 6.5,
        sourceWidth: 1.5,
        delay: 0.16,
        label: { x: 342, y: 454 },
      },
    ],
    mountains: [
      {
        id: "f3-m1",
        ridge: [
          [125, 148],
          [192, 102],
          [258, 120],
          [320, 142],
        ],
        baseY: 185,
        tone: 2,
        opacity: 0.25,
      },
      {
        id: "f3-m2",
        ridge: [
          [16, 425],
          [85, 365],
          [155, 395],
          [215, 445],
        ],
        baseY: 505,
        tone: 1,
        opacity: 0.25,
      },
    ],
    stops: [
      { id: 12, x: 238, y: 190, dir: "a" }, // 文赤壁
      { id: 17, x: 122, y: 228, dir: "b" }, // 洞庭湖
      { id: 14, x: 268, y: 342, dir: "b" }, // 八境台
      { id: 16, x: 222, y: 392, dir: "l" }, // 郁孤台
      { id: 15, x: 312, y: 408, dir: "r" }, // 慈云塔
    ],
  },

  // ── 卷四 · 潇湘岳麓（12 处，南北向湘江天生契合竖屏！） ──
  {
    id: "xiaoxiang",
    numeral: "卷四",
    title: "潇湘岳麓",
    shortTitle: "潇湘",
    subtitle: "湘江 · 岳麓 · 浏阳 · 永州",
    colophon: "岳麓巍巍摘星作砚台，湘江泼墨化云霭。",
    waterShapes: [
      {
        d: "M 206 270 C 212 285, 214 335, 209 376 C 206 388, 200 388, 198 376 C 195 335, 199 285, 206 270 Z",
        kind: "islet",
      },
    ],
    rivers: [
      {
        id: "f4-xiang",
        name: "湘江",
        pts: [
          [202, 42],
          [194, 145],
          [206, 255],
          [214, 375],
          [198, 465],
          [184, 528],
        ],
        mouthWidth: 16,
        sourceWidth: 6,
        rippleOffset: 11,
        delay: 0.05,
        label: { x: 232, y: 452, vertical: true, large: true },
      },
      {
        id: "f4-liuyang",
        name: "浏阳河",
        pts: [
          [206, 224],
          [276, 240],
          [345, 220],
          [392, 238],
        ],
        mouthWidth: 6.0,
        sourceWidth: 1.2,
        delay: 0.14,
        label: { x: 318, y: 205 },
      },
    ],
    mountains: [
      // 岳麓山（湘江西岸）
      {
        id: "f4-yuelu",
        ridge: [
          [10, 345],
          [66, 286],
          [122, 265],
          [168, 305],
        ],
        baseY: 425,
        tone: 2,
        opacity: 0.34,
      },
      {
        id: "f4-south",
        ridge: [
          [265, 455],
          [335, 412],
          [400, 442],
        ],
        baseY: 515,
        tone: 1,
        opacity: 0.22,
      },
    ],
    stops: [
      { id: 18, x: 199, y: 74, dir: "r" }, // 左公故里
      { id: 19, x: 196, y: 120, dir: "l" }, // 乔口镇
      { id: 20, x: 198, y: 164, dir: "r" }, // 铜官古镇
      { id: 21, x: 204, y: 212, dir: "l" }, // 湘江
      { id: 29, x: 344, y: 226, dir: "b" }, // 谭嗣同故居
      { id: 22, x: 160, y: 266, dir: "l" }, // 渔阳墓
      { id: 23, x: 112, y: 312, dir: "l" }, // 岳麓山
      { id: 25, x: 152, y: 362, dir: "l" }, // 赫曦台
      { id: 27, x: 122, y: 416, dir: "l" }, // 自卑亭
      { id: 24, x: 244, y: 312, dir: "r" }, // 杜甫江阁
      { id: 26, x: 268, y: 374, dir: "r" }, // 定王台
      { id: 28, x: 190, y: 492, dir: "r" }, // 蘋岛
    ],
  },

  // ── 卷五 · 武陵沅水（10 处，宛如一幅竖版《武陵溪山图》） ──
  {
    id: "wuling",
    numeral: "卷五",
    title: "武陵沅水",
    shortTitle: "武陵",
    subtitle: "沅江 · 清浪滩 · 沅陵十处",
    colophon: "清浪滩现云上帆，书通二酉天下来。",
    rivers: [
      {
        id: "f5-yuan",
        name: "沅水",
        pts: [
          [328, 56],
          [268, 128],
          [192, 186],
          [238, 265],
          [184, 344],
          [230, 422],
          [165, 502],
        ],
        mouthWidth: 12.5,
        sourceWidth: 3.5,
        rippleOffset: 8,
        delay: 0.05,
        label: { x: 286, y: 154, large: true },
      },
      {
        id: "f5-youshui",
        name: "酉水",
        pts: [
          [194, 466],
          [125, 434],
          [72, 396],
        ],
        mouthWidth: 5.0,
        sourceWidth: 1.0,
        delay: 0.15,
        label: { x: 102, y: 446 },
      },
    ],
    mountains: [
      {
        id: "f5-m1",
        ridge: [
          [10, 225],
          [75, 152],
          [138, 185],
          [190, 240],
        ],
        baseY: 315,
        tone: 2,
        opacity: 0.3,
      },
      {
        id: "f5-m2",
        ridge: [
          [245, 365],
          [318, 285],
          [380, 315],
          [415, 370],
        ],
        baseY: 455,
        tone: 1,
        opacity: 0.28,
      },
    ],
    stops: [
      { id: 30, x: 306, y: 82, dir: "l" }, // 沅江
      { id: 31, x: 262, y: 132, dir: "l" }, // 五强溪古栈道
      { id: 32, x: 212, y: 174, dir: "l" }, // 瓮子洞
      { id: 33, x: 214, y: 224, dir: "r" }, // 清浪乡
      { id: 34, x: 234, y: 274, dir: "r" }, // 壶头山
      { id: 35, x: 204, y: 318, dir: "l" }, // 明月山
      { id: 36, x: 196, y: 368, dir: "r" }, // 龙兴讲寺
      { id: 37, x: 226, y: 416, dir: "r" }, // 武陵桥
      { id: 38, x: 192, y: 472, dir: "r" }, // 凤凰山
      { id: 39, x: 88, y: 406, dir: "a" }, // 二酉山
    ],
  },

  // ── 卷六 · 关山雪域（5 处，苍茫开阔留白） ──
  {
    id: "west",
    numeral: "卷六",
    title: "关山雪域",
    shortTitle: "关山",
    subtitle: "洛阳 · 长安 · 江阳 · 敦煌 · 拉萨",
    colophon: "故事里的长安，拉萨雪纷乱了几千年。",
    rivers: [
      {
        id: "f6-huanghe",
        name: "黄河 · 洛渭",
        pts: [
          [385, 195],
          [305, 226],
          [225, 232],
          [148, 212],
        ],
        mouthWidth: 8.5,
        sourceWidth: 1.5,
        bothTaper: true,
        delay: 0.05,
        label: { x: 268, y: 198, large: true },
      },
      {
        id: "f6-dangquan",
        name: "宕泉",
        pts: [
          [112, 165],
          [94, 118],
          [82, 76],
        ],
        mouthWidth: 3.8,
        sourceWidth: 0.8,
        bothTaper: true,
        delay: 0.12,
        label: { x: 122, y: 98 },
      },
      {
        id: "f6-cj",
        name: "长江上游",
        pts: [
          [365, 342],
          [282, 355],
          [202, 342],
        ],
        mouthWidth: 7.5,
        sourceWidth: 1.4,
        bothTaper: true,
        delay: 0.14,
        label: { x: 305, y: 332 },
      },
      {
        id: "f6-lasa",
        name: "拉萨河",
        pts: [
          [62, 466],
          [148, 456],
          [238, 472],
        ],
        mouthWidth: 5.5,
        sourceWidth: 1.0,
        bothTaper: true,
        delay: 0.18,
        label: { x: 205, y: 492 },
      },
    ],
    mountains: [
      // 鸣沙山 / 祁连
      {
        id: "f6-m1",
        ridge: [
          [12, 160],
          [75, 108],
          [148, 132],
          [215, 165],
        ],
        baseY: 205,
        tone: 3,
        opacity: 0.28,
      },
      // 秦岭横亘
      {
        id: "f6-m2",
        ridge: [
          [135, 305],
          [215, 266],
          [295, 282],
          [378, 258],
          [415, 305],
        ],
        baseY: 350,
        tone: 2,
        opacity: 0.24,
      },
      // 西藏大雪山
      {
        id: "f6-m3",
        ridge: [
          [12, 435],
          [86, 372],
          [155, 396],
          [228, 362],
          [302, 425],
        ],
        baseY: 485,
        tone: 1,
        opacity: 0.34,
      },
    ],
    stops: [
      { id: 45, x: 96, y: 128, dir: "r" }, // 莫高窟
      { id: 7, x: 325, y: 222, dir: "b" }, // 洛阳
      { id: 8, x: 228, y: 232, dir: "b" }, // 西安
      { id: 13, x: 286, y: 355, dir: "b" }, // 江阳
      { id: 44, x: 148, y: 456, dir: "a" }, // 布达拉宫
    ],
  },
];

export function folioIndexOfPlace(placeId: number): number {
  const idx = FOLIO_PAGES.findIndex((f) =>
    f.stops.some((s) => s.id === placeId),
  );
  return idx >= 0 ? idx : 0;
}
