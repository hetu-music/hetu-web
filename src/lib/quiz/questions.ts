import type { QuizQuestion } from "./types";

/**
 * 寻曲测验题目（简体原文，繁体由服务端转换）。
 *
 * 选项权重约定：主维度 2、副维度 1；imagery 指向招牌意象。
 * 各维度出现频次不必严格均衡——匹配前会按均匀作答的解析分布做标准化。
 *
 * 修改题目或权重会改变测验结果，需同步更新 QUIZ_VERSION 与测试快照。
 */
export const QUIZ_VERSION = "0.1.0";

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    title: "临行",
    stem: "明日便要远行。今夜，你在做什么？",
    options: [
      {
        text: "推开窗，看了一夜的月",
        dims: { tianxiang: 2, qingsi: 1 },
        imagery: ["月"],
      },
      {
        text: "温一壶酒，与旧友话别",
        dims: { qiyong: 2, renjian: 1 },
        imagery: ["酒"],
      },
      {
        text: "摊开舆图，一寸一寸量过要走的山川",
        dims: { shanhe: 2, diangu: 1 },
        imagery: ["山"],
      },
      {
        text: "把院里那株花的开落，记进日记",
        dims: { caomu: 2, guangyin: 1 },
        imagery: ["花"],
      },
    ],
  },
  {
    title: "逢雨",
    stem: "半路落了一场雨，你会——",
    options: [
      {
        text: "躲进路边茶寮，听雨打檐角",
        dims: { loutai: 2, qiyong: 1 },
        imagery: ["雨"],
      },
      {
        text: "冒雨策马，赶在天黑前过江",
        dims: { shanhe: 2, renjian: 1 },
        imagery: ["马"],
      },
      {
        text: "望着雨中垂柳，忽然想起一个人",
        dims: { qingsi: 2, caomu: 1 },
        imagery: ["柳"],
      },
      {
        text: "数着雨声，想这场雨已下了多少年",
        dims: { guangyin: 2, tianxiang: 1 },
      },
    ],
  },
  {
    title: "古城",
    stem: "途经一座古城，你最先去哪里？",
    options: [
      {
        text: "城楼，登高看尽万家灯火",
        dims: { loutai: 2, renjian: 1 },
        imagery: ["灯"],
      },
      { text: "旧书肆，翻一册无人问津的志怪", dims: { diangu: 2, qiyong: 1 } },
      { text: "城外渡口，看江水流向何方", dims: { shanhe: 2, guangyin: 1 } },
      { text: "茶楼，听说书人讲前朝旧事", dims: { renjian: 2, diangu: 1 } },
    ],
  },
  {
    title: "赠礼",
    stem: "有人要赠你一件东西，你最希望是——",
    options: [
      { text: "一柄旧剑", dims: { qiyong: 2, renjian: 1 } },
      {
        text: "一枝带雪的梅",
        dims: { caomu: 2, tianxiang: 1 },
        imagery: ["雪"],
      },
      {
        text: "一封写了很久、却始终未寄出的信",
        dims: { qingsi: 2, guangyin: 1 },
      },
      { text: "一卷前人的手抄诗稿", dims: { diangu: 2, qiyong: 1 } },
    ],
  },
  {
    title: "时辰",
    stem: "一天之中，你最喜欢哪个时辰？",
    options: [
      { text: "破晓，天边刚刚泛白", dims: { tianxiang: 2, guangyin: 1 } },
      { text: "黄昏，炊烟四起，行人归家", dims: { renjian: 2, loutai: 1 } },
      {
        text: "深夜，一灯如豆",
        dims: { loutai: 2, qingsi: 1 },
        imagery: ["灯"],
      },
      {
        text: "午后，日影慢慢移过窗台",
        dims: { guangyin: 2, loutai: 1 },
        imagery: ["窗"],
      },
    ],
  },
  {
    title: "留景",
    stem: "若能让一个景象永远停住，你选——",
    options: [
      {
        text: "漫天星河",
        dims: { tianxiang: 2, guangyin: 1 },
        imagery: ["星辰"],
      },
      { text: "大雪封山", dims: { shanhe: 2, tianxiang: 1 }, imagery: ["雪"] },
      { text: "满城飞花", dims: { caomu: 2, renjian: 1 }, imagery: ["花"] },
      { text: "故人回眸的那一刻", dims: { qingsi: 2, renjian: 1 } },
    ],
  },
  {
    title: "诗体",
    stem: "朋友说你像一首诗，你希望是哪一种？",
    options: [
      { text: "边塞诗：大漠孤烟，长河落日", dims: { shanhe: 2, diangu: 1 } },
      { text: "咏物诗：一花一木，皆有寄托", dims: { caomu: 2, qiyong: 1 } },
      { text: "闺怨词：一字一句，都是心事", dims: { qingsi: 2, loutai: 1 } },
      { text: "怀古诗：凭吊千年兴亡", dims: { diangu: 2, guangyin: 1 } },
    ],
  },
  {
    title: "旧梦",
    stem: "梦里，你常常回到——",
    options: [
      {
        text: "一座没有人的旧宅",
        dims: { loutai: 2, guangyin: 1 },
        imagery: ["梦"],
      },
      { text: "一条望不到尽头的江", dims: { shanhe: 2, tianxiang: 1 } },
      { text: "一个再也见不到的人身边", dims: { qingsi: 2, renjian: 1 } },
      {
        text: "一个从未去过、却莫名熟悉的朝代",
        dims: { diangu: 2, guangyin: 1 },
      },
    ],
  },
  {
    title: "收尾",
    stem: "要为一段感情写一句收尾，你会写——",
    options: [
      {
        text: "此后风雪，与我无关",
        dims: { tianxiang: 2, qingsi: 1 },
        imagery: ["风"],
      },
      { text: "那年花开，我们都还年少", dims: { guangyin: 2, caomu: 1 } },
      { text: "灯下旧物，一件件收好", dims: { qiyong: 2, loutai: 1 } },
      { text: "江湖路远，各自珍重", dims: { renjian: 2, shanhe: 1 } },
    ],
  },
  {
    title: "案头",
    stem: "你的书桌上，最可能摆着——",
    options: [
      { text: "一方砚台、几支毛笔", dims: { qiyong: 2, diangu: 1 } },
      { text: "一盆兰草", dims: { caomu: 2, guangyin: 1 } },
      { text: "一叠写满心事的信笺", dims: { qingsi: 2, qiyong: 1 } },
      { text: "一只旧沙漏", dims: { guangyin: 2, qiyong: 1 } },
    ],
  },
  {
    title: "此生",
    stem: "如果能换一种活法，你想成为——",
    options: [
      {
        text: "仗剑远游的侠客",
        dims: { renjian: 2, shanhe: 1 },
        imagery: ["马"],
      },
      {
        text: "隐居山林的琴师",
        dims: { caomu: 2, qiyong: 1 },
        imagery: ["山"],
      },
      { text: "守着一座楼、等一个人回来的人", dims: { loutai: 2, qingsi: 1 } },
      { text: "替一个时代留下记录的史官", dims: { diangu: 2, guangyin: 1 } },
    ],
  },
  {
    title: "留名",
    stem: "最后，你想把自己的名字写在哪里？",
    options: [
      {
        text: "写在云上，风一吹就散",
        dims: { tianxiang: 2, guangyin: 1 },
        imagery: ["云"],
      },
      { text: "刻进城墙的一块砖里", dims: { loutai: 2, diangu: 1 } },
      { text: "夹进一本旧诗集", dims: { diangu: 2, qingsi: 1 } },
      { text: "写给一个人，只让那个人知道", dims: { qingsi: 2, renjian: 1 } },
    ],
  },
];
