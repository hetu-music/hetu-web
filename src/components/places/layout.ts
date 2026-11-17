/**
 * 河图志水系图的版式：河、海名、地名分组与每一站的位置，都是手工排的（见 docs/PLACES.md 第二节）。
 * 地点本身（名称、地区、对应的歌与词句）在数据库里，这里按 places.id 对应。
 *
 * 坐标不按真实比例：只保留西东、南北的大致方向和「谁连着谁」，
 * 否则湖南的二十多处会挤成一团。同一条河上的站点次序也只是示意。
 * 新增的地点没排进来之前，宽屏图上没有它，窄屏目录把它列在最后。
 */

export type Side = "l" | "r" | "a" | "b";

export interface Station {
  /** places.id */
  id: number;
  x: number;
  y: number;
  /** 地名写在河的哪一边：左右用横排，上下用竖排 */
  side: Side;
  river: string;
}

export interface River {
  id: string;
  name: string;
  /** 从河口往上游写：入场动画因此是溯流而上 */
  pts: [number, number][];
  width: number;
  dashed?: boolean;
  /** 上游末端淡出的长度 */
  fade?: number;
  /** 两头都淡出，用于不从属于任何干流的短线 */
  fadeBoth?: boolean;
  delay: number;
  label?: { x: number; y: number; vertical?: boolean; large?: boolean };
}

export const VIEW = { width: 1480, height: 1000 };

export const RIVERS: River[] = [
  {
    id: "coast",
    name: "海",
    pts: [
      [1270, 60],
      [1270, 720],
    ],
    width: 1,
    dashed: true,
    fadeBoth: true,
    delay: 0,
  },
  {
    id: "changjiang",
    name: "长江",
    pts: [
      [1270, 430],
      [900, 430],
      [830, 500],
      [300, 500],
      [200, 400],
      [50, 400],
    ],
    width: 3.4,
    fade: 90,
    delay: 0.2,
    label: { x: 400, y: 486, large: true },
  },
  {
    id: "huanghe",
    name: "黄河",
    pts: [
      [1270, 215],
      [600, 215],
      [530, 145],
      [360, 145],
    ],
    width: 2.6,
    fade: 130,
    delay: 0.4,
    label: { x: 960, y: 203, large: true },
  },
  {
    id: "haihe",
    name: "海河",
    pts: [
      [1270, 150],
      [900, 150],
    ],
    width: 1.5,
    fade: 70,
    delay: 0.6,
    label: { x: 945, y: 140 },
  },
  {
    id: "bianshui",
    name: "古汴水",
    pts: [
      [1270, 320],
      [1000, 320],
    ],
    width: 1.2,
    dashed: true,
    fade: 70,
    delay: 0.8,
    label: { x: 1040, y: 310 },
  },
  {
    id: "qiantang",
    name: "钱塘江",
    pts: [
      [1270, 560],
      [1050, 560],
    ],
    width: 1.8,
    fade: 50,
    delay: 0.7,
    label: { x: 1080, y: 550 },
  },
  {
    id: "huangpu",
    name: "黄浦江",
    pts: [
      [1215, 430],
      [1180, 465],
      [1180, 535],
    ],
    width: 1.2,
    fade: 25,
    delay: 0.5,
  },
  {
    id: "chuhe",
    name: "滁河",
    pts: [
      [1060, 430],
      [1025, 395],
      [945, 395],
    ],
    width: 1.2,
    fade: 40,
    delay: 0.8,
    label: { x: 952, y: 385 },
  },
  {
    id: "ganjiang",
    name: "赣江",
    pts: [
      [800, 500],
      [800, 560],
      [850, 610],
      [850, 955],
    ],
    width: 1.8,
    fade: 70,
    delay: 1.1,
    label: { x: 868, y: 680, vertical: true },
  },
  {
    id: "dongting",
    name: "洞庭",
    pts: [
      [560, 500],
      [560, 520],
    ],
    width: 7,
    delay: 1.3,
  },
  {
    id: "xiangjiang",
    name: "湘江",
    pts: [
      [560, 520],
      [560, 975],
    ],
    width: 2,
    fade: 60,
    delay: 1.5,
    label: { x: 578, y: 815, vertical: true },
  },
  {
    id: "yuanshui",
    name: "沅水",
    pts: [
      [560, 520],
      [440, 640],
      [440, 985],
    ],
    width: 2,
    fade: 50,
    delay: 1.5,
    label: { x: 458, y: 690, vertical: true },
  },
  {
    id: "liuyang",
    name: "浏阳河",
    pts: [
      [560, 665],
      [595, 700],
      [725, 700],
    ],
    width: 1.1,
    fade: 30,
    delay: 2,
    label: { x: 606, y: 692 },
  },
  {
    id: "luohe",
    name: "洛河",
    pts: [
      [840, 215],
      [790, 265],
      [715, 265],
    ],
    width: 1.2,
    fade: 35,
    delay: 1,
    label: { x: 800, y: 285 },
  },
  {
    id: "weihe",
    name: "渭河",
    pts: [
      [680, 215],
      [630, 265],
      [465, 265],
    ],
    width: 1.2,
    fade: 50,
    delay: 1.1,
    label: { x: 600, y: 256 },
  },
  {
    id: "songhua",
    name: "松花江",
    pts: [
      [1180, 75],
      [1120, 15],
    ],
    width: 1.2,
    fade: 70,
    delay: 1.2,
    label: { x: 1085, y: 62 },
  },
  {
    id: "lasa",
    name: "拉萨河",
    pts: [
      [30, 700],
      [300, 700],
    ],
    width: 1.2,
    fadeBoth: true,
    delay: 1.2,
    label: { x: 205, y: 688 },
  },
  {
    id: "dangquan",
    name: "宕泉",
    pts: [
      [110, 270],
      [110, 110],
    ],
    width: 1.2,
    fade: 100,
    delay: 1.2,
    label: { x: 122, y: 165 },
  },
];

/** 大地名：把挤在一起的站点归成一处，不是可点的站 */
export const GROUPS = [
  { name: "沅陵", x: 335, y: 750 },
  { name: "长沙", x: 750, y: 745 },
  { name: "赣州", x: 955, y: 790 },
];

/** 图上的海名 */
export const SEAS = [
  { name: "渤海", x: 1296, y: 150 },
  { name: "黄海", x: 1296, y: 345 },
  { name: "东海", x: 1296, y: 585 },
];

export const STATIONS: Station[] = [
  { id: 1, x: 1120, y: 150, side: "a", river: "haihe" }, // 文昌阁
  { id: 2, x: 1060, y: 150, side: "a", river: "haihe" }, // 鸟巢
  { id: 3, x: 1000, y: 150, side: "a", river: "haihe" }, // 故宫午门
  { id: 4, x: 1270, y: 258, side: "r", river: "coast" }, // 蓬莱阁
  { id: 5, x: 1270, y: 378, side: "r", river: "coast" }, // 宝塔镇
  { id: 6, x: 1130, y: 320, side: "a", river: "bianshui" }, // 徐州
  { id: 7, x: 755, y: 265, side: "b", river: "luohe" }, // 洛阳
  { id: 8, x: 540, y: 265, side: "b", river: "weihe" }, // 西安
  { id: 9, x: 1180, y: 500, side: "r", river: "huangpu" }, // 黄浦江
  { id: 10, x: 990, y: 395, side: "a", river: "chuhe" }, // 滁州
  { id: 11, x: 1010, y: 430, side: "b", river: "changjiang" }, // 南京
  { id: 12, x: 690, y: 500, side: "a", river: "changjiang" }, // 文赤壁
  { id: 13, x: 170, y: 400, side: "a", river: "changjiang" }, // 江阳
  { id: 14, x: 850, y: 770, side: "r", river: "ganjiang" }, // 八境台
  { id: 15, x: 850, y: 802, side: "r", river: "ganjiang" }, // 慈云塔
  { id: 16, x: 850, y: 834, side: "r", river: "ganjiang" }, // 郁孤台
  { id: 17, x: 560, y: 510, side: "r", river: "dongting" }, // 洞庭湖
  { id: 18, x: 560, y: 575, side: "r", river: "xiangjiang" }, // 左公故里
  { id: 19, x: 560, y: 605, side: "l", river: "xiangjiang" }, // 乔口镇
  { id: 20, x: 560, y: 635, side: "r", river: "xiangjiang" }, // 铜官古镇
  { id: 21, x: 560, y: 665, side: "l", river: "xiangjiang" }, // 湘江
  { id: 22, x: 560, y: 697, side: "l", river: "xiangjiang" }, // 渔阳墓
  { id: 23, x: 560, y: 729, side: "l", river: "xiangjiang" }, // 岳麓山
  { id: 24, x: 560, y: 729, side: "r", river: "xiangjiang" }, // 杜甫江阁
  { id: 25, x: 560, y: 761, side: "l", river: "xiangjiang" }, // 赫曦台
  { id: 26, x: 560, y: 761, side: "r", river: "xiangjiang" }, // 定王台
  { id: 27, x: 560, y: 793, side: "l", river: "xiangjiang" }, // 自卑亭
  { id: 28, x: 560, y: 925, side: "r", river: "xiangjiang" }, // 蘋岛
  { id: 29, x: 675, y: 700, side: "b", river: "liuyang" }, // 谭嗣同故居
  { id: 30, x: 490, y: 590, side: "l", river: "yuanshui" }, // 沅江
  { id: 31, x: 440, y: 660, side: "l", river: "yuanshui" }, // 五强溪古栈道
  { id: 32, x: 440, y: 692, side: "l", river: "yuanshui" }, // 瓮子洞
  { id: 33, x: 440, y: 724, side: "l", river: "yuanshui" }, // 清浪乡
  { id: 34, x: 440, y: 756, side: "l", river: "yuanshui" }, // 壶头山
  { id: 35, x: 440, y: 788, side: "l", river: "yuanshui" }, // 明月山
  { id: 36, x: 440, y: 820, side: "l", river: "yuanshui" }, // 龙兴讲寺
  { id: 37, x: 440, y: 852, side: "l", river: "yuanshui" }, // 武陵桥
  { id: 38, x: 440, y: 884, side: "l", river: "yuanshui" }, // 凤凰山
  { id: 39, x: 440, y: 916, side: "l", river: "yuanshui" }, // 二酉山
  { id: 40, x: 1215, y: 560, side: "b", river: "qiantang" }, // 杭州
  { id: 41, x: 1160, y: 560, side: "b", river: "qiantang" }, // 一半勾留
  { id: 42, x: 1105, y: 560, side: "b", river: "qiantang" }, // 西湖十景
  { id: 43, x: 1180, y: 75, side: "r", river: "songhua" }, // 长白山
  { id: 44, x: 130, y: 700, side: "b", river: "lasa" }, // 布达拉宫
  { id: 45, x: 110, y: 235, side: "r", river: "dangquan" }, // 莫高窟
];

/** 窄屏的目录：从入海口往上读，支流缩进一层。数字是 places.id */
export type TreeNode = number | { river: string; nodes: TreeNode[] };

export const TREE: { river: string; nodes: TreeNode[] }[] = [
  {
    river: "长江",
    nodes: [
      9,
      {
        river: "滁河",
        nodes: [10],
      },
      11,
      {
        river: "赣江",
        nodes: [14, 15, 16],
      },
      12,
      17,
      {
        river: "湘江",
        nodes: [
          18,
          19,
          20,
          21,
          {
            river: "浏阳河",
            nodes: [29],
          },
          22,
          23,
          24,
          25,
          26,
          27,
          28,
        ],
      },
      {
        river: "沅水",
        nodes: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
      },
      13,
    ],
  },
  {
    river: "钱塘江",
    nodes: [40, 41, 42],
  },
  {
    river: "海岸",
    nodes: [5, 4],
  },
  {
    river: "古汴水",
    nodes: [6],
  },
  {
    river: "黄河",
    nodes: [
      {
        river: "洛河",
        nodes: [7],
      },
      {
        river: "渭河",
        nodes: [8],
      },
    ],
  },
  {
    river: "海河",
    nodes: [1, 2, 3],
  },
  {
    river: "松花江",
    nodes: [43],
  },
  {
    river: "拉萨河",
    nodes: [44],
  },
  {
    river: "宕泉",
    nodes: [45],
  },
];
