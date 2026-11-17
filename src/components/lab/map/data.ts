/**
 * 水系图原型的数据：地点与词句来自用户整理的打卡表，坐标是手工排的示意位置。
 *
 * 坐标不按真实比例：只保留西东、南北的大致方向和「谁连着谁」，
 * 否则湖南的二十多处会挤成一团。同一条河上的站点次序也只是示意，定稿前要核对。
 */

export type Side = "l" | "r" | "a" | "b";

export interface Entry {
  song: string;
  /** 引句，一句一项，不带引号 */
  lines: string[];
  note?: string;
}

export interface Stop {
  id: string;
  /** 图上的短名 */
  name: string;
  /** 表里的全名，与短名相同时不写 */
  full?: string;
  region: string;
  x: number;
  y: number;
  /** 地名写在河的哪一边：左右用横排，上下用竖排 */
  side: Side;
  river: string;
  entries: Entry[];
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

export const STOPS: Stop[] = [
  // 海河
  {
    id: "wenchangge",
    name: "文昌阁",
    region: "北京",
    x: 1120,
    y: 150,
    side: "a",
    river: "haihe",
    entries: [
      {
        song: "落笔生花",
        lines: ["我欲文风昌盛，诗词歌赋，水墨丹青，满庭芳华。"],
      },
    ],
  },
  {
    id: "niaochao",
    name: "鸟巢",
    full: "鸟巢国家体育场",
    region: "北京",
    x: 1060,
    y: 150,
    side: "a",
    river: "haihe",
    entries: [
      {
        song: "唱给你的歌",
        lines: ["诺言都兑现，万人欢呼的场面。"],
        note: "2016 年心时纪河图现场，2018 年国风极乐夜河图现场",
      },
    ],
  },
  {
    id: "wumen",
    name: "故宫午门",
    full: "故宫博物院·午门",
    region: "北京",
    x: 1000,
    y: 150,
    side: "a",
    river: "haihe",
    entries: [
      { song: "立心", lines: ["一双眼，风雪扑满，紫禁朱门百年逝川。"] },
    ],
  },
  // 海岸
  {
    id: "penglai",
    name: "蓬莱阁",
    full: "蓬莱阁景区",
    region: "山东 · 烟台 · 蓬莱",
    x: 1270,
    y: 258,
    side: "r",
    river: "coast",
    entries: [
      {
        song: "人间入怀",
        lines: ["他们说神仙存在，已乘云去了千载，只留下这岛屿称作蓬莱。"],
      },
    ],
  },
  {
    id: "baota",
    name: "宝塔镇",
    region: "江苏 · 盐城",
    x: 1270,
    y: 378,
    side: "r",
    river: "coast",
    entries: [
      {
        song: "宝塔镇河妖",
        lines: ["伶仃身素衣袍，天上云逐飞鸟，我许过你暮暮与朝朝。"],
      },
    ],
  },
  // 古汴水
  {
    id: "xuzhou",
    name: "徐州",
    full: "徐州市",
    region: "江苏 · 徐州",
    x: 1130,
    y: 320,
    side: "a",
    river: "bianshui",
    entries: [
      {
        song: "水调歌头·徐州中秋",
        lines: ["岂意彭城山下，同泛清河古汴，船上载凉州。"],
      },
    ],
  },
  // 黄河的支流
  {
    id: "luoyang",
    name: "洛阳",
    full: "洛阳市",
    region: "河南 · 洛阳",
    x: 755,
    y: 265,
    side: "b",
    river: "luohe",
    entries: [
      {
        song: "长安李白",
        lines: ["到了洛阳赏牡丹，得知己千杯不停盏。"],
      },
    ],
  },
  {
    id: "xian",
    name: "西安",
    full: "西安市",
    region: "陕西 · 西安",
    x: 540,
    y: 265,
    side: "b",
    river: "weihe",
    entries: [{ song: "不见长安", lines: ["我开始疯狂想念，故事里的长安。"] }],
  },
  // 长江干流，从海往上
  {
    id: "huangpu",
    name: "黄浦江",
    region: "上海",
    x: 1180,
    y: 500,
    side: "r",
    river: "huangpu",
    entries: [
      {
        song: "从北国到南国",
        lines: ["黄浦江渔船来来往往，大概是因为你爱的人也去了远方。"],
      },
    ],
  },
  {
    id: "chuzhou",
    name: "滁州",
    full: "滁州市",
    region: "安徽 · 滁州",
    x: 990,
    y: 395,
    side: "a",
    river: "chuhe",
    entries: [{ song: "明珠山河歌", lines: ["一点滁州，四面山色。"] }],
  },
  {
    id: "nanjing",
    name: "南京",
    full: "南京市",
    region: "江苏 · 南京",
    x: 1010,
    y: 430,
    side: "b",
    river: "changjiang",
    entries: [
      {
        song: "金陵秦淮夜",
        lines: ["金陵城灯火萧瑟秋意，青丝换霜雨。"],
      },
    ],
  },
  {
    id: "wenchibi",
    name: "文赤壁",
    region: "湖北 · 黄冈 · 黄州",
    x: 690,
    y: 500,
    side: "a",
    river: "changjiang",
    entries: [
      { song: "江海余生", lines: ["歌且当歌，莫托遗响于悲风。"] },
      { song: "赤壁沧浪曲", lines: ["盛衰青史终有断，世人如蜉蝣。"] },
    ],
  },
  {
    id: "jiangyang",
    name: "江阳",
    region: "四川 · 泸州 · 江阳",
    x: 170,
    y: 400,
    side: "a",
    river: "changjiang",
    entries: [
      {
        song: "荔枝春",
        lines: ["江阳城酒旗高悬风正暖，那一年她折花小河畔。"],
      },
    ],
  },
  // 赣江
  {
    id: "bajing",
    name: "八境台",
    region: "江西 · 赣州 · 章贡",
    x: 850,
    y: 770,
    side: "r",
    river: "ganjiang",
    entries: [{ song: "浮生记·岁晏烟火帖", lines: ["平沙潮，推过八境滩。"] }],
  },
  {
    id: "ciyun",
    name: "慈云塔",
    region: "江西 · 赣州 · 章贡",
    x: 850,
    y: 802,
    side: "r",
    river: "ganjiang",
    entries: [
      {
        song: "浮生记·岁晏烟火帖",
        lines: ["晨钟声敲开铜门环，慈云塔早市，有晴风暖软。"],
      },
    ],
  },
  {
    id: "yugu",
    name: "郁孤台",
    full: "郁孤台公园",
    region: "江西 · 赣州 · 章贡",
    x: 850,
    y: 834,
    side: "r",
    river: "ganjiang",
    entries: [
      {
        song: "郁孤行·八境长歌",
        lines: ["郁孤台前清江，浮桥影下寒浪。"],
      },
    ],
  },
  // 洞庭
  {
    id: "dongting",
    name: "洞庭湖",
    region: "湖南 · 岳阳 · 湘阴",
    x: 560,
    y: 510,
    side: "r",
    river: "dongting",
    entries: [{ song: "画外", lines: ["千里飞渡，巫山云，洞庭波。"] }],
  },
  // 湘江：左右按大致的东西两岸写
  {
    id: "zuogong",
    name: "左公故里",
    region: "湖南 · 岳阳 · 湘阴",
    x: 560,
    y: 575,
    side: "r",
    river: "xiangjiang",
    entries: [
      {
        song: "左公柳",
        lines: ["剑锋所指旌旗漫卷黄沙，八千里征鞍碾过胡杨枝桠。"],
      },
    ],
  },
  {
    id: "qiaokou",
    name: "乔口镇",
    region: "湖南 · 长沙 · 望城",
    x: 560,
    y: 605,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "自渡·乔口",
        lines: ["三湘缈，乔口漂，春泥百草，我前路遥遥。"],
      },
    ],
  },
  {
    id: "tongguan",
    name: "铜官古镇",
    region: "湖南 · 长沙 · 望城",
    x: 560,
    y: 635,
    side: "r",
    river: "xiangjiang",
    entries: [
      {
        song: "铜官寻梦",
        lines: ["可知我寻你黄泉碧落人海间，你向我挥手转身却消散尘烟。"],
      },
    ],
  },
  {
    id: "xiangjiang",
    name: "湘江",
    region: "湖南 · 长沙 · 开福",
    x: 560,
    y: 665,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "赫曦台上",
        lines: ["岳麓巍巍，摘星作烟台，湘江泼墨化云霭。"],
      },
    ],
  },
  {
    id: "yuyang",
    name: "渔阳墓",
    full: "西汉长沙王后渔阳墓",
    region: "湖南 · 长沙 · 岳麓",
    x: 560,
    y: 697,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "渔阳公主",
        lines: ["时光里走出渔阳公主，不染风霜的眉目。"],
      },
    ],
  },
  {
    id: "yuelu",
    name: "岳麓山",
    region: "湖南 · 长沙 · 岳麓",
    x: 560,
    y: 729,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "你好岳麓山",
        lines: ["千秋照我，人间声色，明月逐风千里万里行。"],
      },
    ],
  },
  {
    id: "duge",
    name: "杜甫江阁",
    region: "湖南 · 长沙 · 天心",
    x: 560,
    y: 729,
    side: "r",
    river: "xiangjiang",
    entries: [
      {
        song: "过杜甫江阁",
        lines: ["谁倚阁楼边，坐看云霞起，离别曲唱在相逢时。"],
      },
    ],
  },
  {
    id: "hexi",
    name: "赫曦台",
    region: "湖南 · 长沙 · 岳麓",
    x: 560,
    y: 761,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "赫曦台上",
        lines: ["清荷摇曳披月白，赫曦台上育英才。"],
      },
    ],
  },
  {
    id: "dingwang",
    name: "定王台",
    region: "湖南 · 长沙 · 芙蓉",
    x: 560,
    y: 761,
    side: "r",
    river: "xiangjiang",
    entries: [
      {
        song: "定王台",
        lines: ["他也曾年少夕阳渐远登高台，少年思亲不语默默独徘徊。"],
      },
    ],
  },
  {
    id: "zibei",
    name: "自卑亭",
    region: "湖南 · 长沙 · 岳麓",
    x: 560,
    y: 793,
    side: "l",
    river: "xiangjiang",
    entries: [
      {
        song: "自卑亭记",
        lines: ["青山可题跋，四海可为家，位卑亦敢忧天下。"],
      },
    ],
  },
  {
    id: "pingdao",
    name: "蘋岛",
    region: "湖南 · 永州",
    x: 560,
    y: 925,
    side: "r",
    river: "xiangjiang",
    entries: [
      {
        song: "我从蘋岛来",
        lines: ["我从蘋岛来，看尽人间的百态。"],
      },
    ],
  },
  {
    id: "tansitong",
    name: "谭嗣同故居",
    region: "湖南 · 长沙 · 浏阳",
    x: 675,
    y: 700,
    side: "b",
    river: "liuyang",
    entries: [
      {
        song: "如见",
        lines: ["祠堂泪滴穿沉默的牌匾，莲花愿在淤泥中皎洁。"],
      },
    ],
  },
  // 沅水
  {
    id: "yuanjiang",
    name: "沅江",
    region: "湖南",
    x: 490,
    y: 590,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "沅水谣", lines: ["登楼凭栏望沅江，沅水犹浩荡。"] }],
  },
  {
    id: "wuqiangxi",
    name: "五强溪古栈道",
    full: "五强溪镇明代古栈道遗址",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 660,
    side: "l",
    river: "yuanshui",
    entries: [
      {
        song: "清浪滩上",
        lines: ["终见铁链百丈 锁住一江潮。", "峰窝岩下路远，远路寻几遭。"],
      },
    ],
  },
  {
    id: "wengzi",
    name: "瓮子洞",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 692,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "清浪滩上", lines: ["瓮子洞前滩险，险滩望未了。"] }],
  },
  {
    id: "qinglang",
    name: "清浪乡",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 724,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "沅水谣", lines: ["吊脚楼醒窗前影，清浪滩现云上帆。"] }],
  },
  {
    id: "hutou",
    name: "壶头山",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 756,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "沅水谣", lines: ["壶头映月江北冷，马革裹尸梦里还。"] }],
  },
  {
    id: "mingyue",
    name: "明月山",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 788,
    side: "l",
    river: "yuanshui",
    entries: [
      { song: "沅水谣", lines: ["顺母桥人老桥未老，明月山月圆梦难圆。"] },
    ],
  },
  {
    id: "longxing",
    name: "龙兴讲寺",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 820,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "沅水谣", lines: ["凤凰山不见凤凰，龙兴讲寺谁留客。"] }],
  },
  {
    id: "wulingqiao",
    name: "武陵桥",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 852,
    side: "l",
    river: "yuanshui",
    entries: [
      { song: "武陵桥觅得眼泪", lines: ["武陵桥觅得眼泪，大雪纷飞。"] },
    ],
  },
  {
    id: "fenghuang",
    name: "凤凰山",
    full: "凤凰山森林公园",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 884,
    side: "l",
    river: "yuanshui",
    entries: [{ song: "沅水谣", lines: ["凤凰山不见凤凰，龙兴讲寺谁留客。"] }],
  },
  {
    id: "eryou",
    name: "二酉山",
    full: "二酉山古藏书洞",
    region: "湖南 · 怀化 · 沅陵",
    x: 440,
    y: 916,
    side: "l",
    river: "yuanshui",
    entries: [
      {
        song: "二酉藏书洞的传说",
        lines: ["而今山下人如海，学富五车通二酉天下来。"],
      },
    ],
  },
  // 钱塘江
  {
    id: "hangzhou",
    name: "杭州",
    region: "浙江 · 杭州",
    x: 1215,
    y: 560,
    side: "b",
    river: "qiantang",
    entries: [{ song: "离人醉杭州", lines: ["奈何西风怕，人言柳叶似离愁。"] }],
  },
  {
    id: "yiban",
    name: "一半勾留",
    region: "浙江 · 杭州",
    x: 1160,
    y: 560,
    side: "b",
    river: "qiantang",
    entries: [
      {
        song: "一半勾留",
        lines: ["但听凭轮回造物一半勾留一半掩埋，最兴之所至的青睐。"],
      },
    ],
  },
  {
    id: "xihu",
    name: "西湖十景",
    region: "浙江 · 杭州",
    x: 1105,
    y: 560,
    side: "b",
    river: "qiantang",
    entries: [
      {
        song: "依山观澜",
        lines: ["抱剑观花西湖畔。"],
        note: "该歌曲融合全部西湖十景，不一一列举",
      },
    ],
  },
  // 不入海的短线
  {
    id: "changbai",
    name: "长白山",
    full: "长白山国家自然保护区",
    region: "吉林 · 白山 · 抚松",
    x: 1180,
    y: 75,
    side: "r",
    river: "songhua",
    entries: [{ song: "山脉", lines: ["他是山脉，隐于长白。"] }],
  },
  {
    id: "budala",
    name: "布达拉宫",
    region: "西藏 · 拉萨",
    x: 130,
    y: 700,
    side: "b",
    river: "lasa",
    entries: [
      {
        song: "拉萨乱雪",
        lines: [
          "拉萨雪纷乱了几千年，安静的堆积到红尘湮灭。",
          "她坐在布达拉宫的身边，想了半天。",
        ],
      },
    ],
  },
  {
    id: "mogao",
    name: "莫高窟",
    region: "甘肃 · 敦煌",
    x: 110,
    y: 235,
    side: "r",
    river: "dangquan",
    entries: [{ song: "画外", lines: ["山丘苍翠，眉边云鹤一抹。"] }],
  },
];

/** 窄屏的目录：从入海口往上读，支流缩进一层 */
export type TreeNode = string | { river: string; nodes: TreeNode[] };

export const TREE: { river: string; nodes: TreeNode[] }[] = [
  {
    river: "长江",
    nodes: [
      "huangpu",
      { river: "滁河", nodes: ["chuzhou"] },
      "nanjing",
      { river: "赣江", nodes: ["bajing", "ciyun", "yugu"] },
      "wenchibi",
      "dongting",
      {
        river: "湘江",
        nodes: [
          "zuogong",
          "qiaokou",
          "tongguan",
          "xiangjiang",
          { river: "浏阳河", nodes: ["tansitong"] },
          "yuyang",
          "yuelu",
          "duge",
          "hexi",
          "dingwang",
          "zibei",
          "pingdao",
        ],
      },
      {
        river: "沅水",
        nodes: [
          "yuanjiang",
          "wuqiangxi",
          "wengzi",
          "qinglang",
          "hutou",
          "mingyue",
          "longxing",
          "wulingqiao",
          "fenghuang",
          "eryou",
        ],
      },
      "jiangyang",
    ],
  },
  { river: "钱塘江", nodes: ["hangzhou", "yiban", "xihu"] },
  { river: "海岸", nodes: ["baota", "penglai"] },
  { river: "古汴水", nodes: ["xuzhou"] },
  {
    river: "黄河",
    nodes: [
      { river: "洛河", nodes: ["luoyang"] },
      { river: "渭河", nodes: ["xian"] },
    ],
  },
  { river: "海河", nodes: ["wenchangge", "niaochao", "wumen"] },
  { river: "松花江", nodes: ["changbai"] },
  { river: "拉萨河", nodes: ["budala"] },
  { river: "宕泉", nodes: ["mogao"] },
];
