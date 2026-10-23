import type { QuizQuestion } from "./types";

/**
 * 寻曲测验题目（简体原文，繁体由服务端转换）。
 *
 * 十二题按一段旅程排列：临行、途中、停留、夜宿，再回望与收束。
 *
 * 选项权重约定：主维度 2、副维度 1；imagery 指向招牌意象；
 * mood 是选项流露的情绪（明 +1 / 暗 -1，扬 +1 / 抑 -1，说不清记 0），只参与匹配、不展示。
 * 情绪要写进选项文字里，而不是凭题意揣测；每题四个选项尽量分占明扬、明抑、暗扬、暗抑，
 * 同一维度在不同题里也要配不同情绪，否则情绪会和维度绑在一起。
 * 各维度出现频次不必严格均衡——匹配前会按均匀作答的解析分布做标准化。
 *
 * 修改题目或权重会改变测验结果，需同步更新 QUIZ_VERSION 与测试快照。
 * 作答短串按题目顺序逐位编码，调整顺序后旧的分享链接会对应到别的题。
 */
export const QUIZ_VERSION = "0.3.0";

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    title: "临行",
    stem: "明日便要远行。今夜，你在做什么？",
    options: [
      {
        text: "推开窗，看了一夜的月，迟迟睡不着",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
      {
        text: "温一壶酒，与旧友笑闹到半夜",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "摊开舆图，一寸一寸量过要走的山川",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["山"],
      },
      {
        text: "折一枝院里的花夹进行囊，此去未必还回来",
        dims: { caomu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["花"],
      },
    ],
  },
  {
    title: "案头",
    stem: "出发前，你最后看了一眼书桌。上面最可能摆着——",
    options: [
      {
        text: "一方砚，墨迹未干，是昨夜兴起写下的狂草",
        dims: { qiyong: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一盆兰草，刚抽了新叶",
        dims: { caomu: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "一叠信笺，写了又揉，揉了又写",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "一只旧沙漏，沙快漏完了",
        dims: { guangyin: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "逢雨",
    stem: "行至半途，忽然落起雨来。你会——",
    options: [
      {
        text: "躲进路边茶寮，听雨打檐角",
        dims: { loutai: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["雨"],
      },
      {
        text: "冒雨策马，赶在天黑前过江",
        dims: { shanhe: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "望着雨中垂柳，忽然想起一个人",
        dims: { qingsi: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["柳"],
      },
      {
        text: "站在雨里不躲——反正这些年，也淋惯了",
        dims: { guangyin: 2, tianxiang: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "古城",
    stem: "雨停了，前面是一座古城。你最先去哪里？",
    options: [
      {
        text: "城楼，登高看尽万家灯火",
        dims: { loutai: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["灯"],
      },
      {
        text: "旧书肆，翻一册志怪，一坐就是一下午",
        dims: { diangu: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "城外渡口，看江水流向何方",
        dims: { shanhe: 2, guangyin: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "茶楼，听说书人拍案讲到亡国那一段",
        dims: { renjian: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "时辰",
    stem: "你在城里住了几日。一天之中，最喜欢哪个时辰？",
    options: [
      {
        text: "破晓，第一缕天光照上城头",
        dims: { tianxiang: 2, guangyin: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "黄昏，看满街的人各自归家",
        dims: { renjian: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "深夜，一灯如豆",
        dims: { loutai: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "午后，日影慢慢移过窗台",
        dims: { guangyin: 2, loutai: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["窗"],
      },
    ],
  },
  {
    title: "赠礼",
    stem: "离城那日，有人要赠你一件东西。你最希望是——",
    options: [
      {
        text: "一柄好剑，正好带着上路",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一枝带雪的梅，香气一路都跟着你",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["雪"],
      },
      {
        text: "一封信，嘱你走远了再拆",
        dims: { qingsi: 2, guangyin: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "一卷前人的手稿，字字都是不平之气",
        dims: { diangu: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "留景",
    stem: "出了城，又走了很远。若能让一个景象永远停住，你选——",
    options: [
      {
        text: "漫天星河，静静悬在头顶",
        dims: { tianxiang: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["星辰"],
      },
      {
        text: "大雪封山，万籁俱寂",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雪"],
      },
      {
        text: "漫山花开，一路都是踏青的人",
        dims: { caomu: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "那人远去前，终于回过头来的那一刻",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "旧梦",
    stem: "夜宿荒驿，你梦见自己回到——",
    options: [
      {
        text: "一座没有人的旧宅，门虚掩着",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
      {
        text: "少年时那条江上，船顺流而下，快得像飞",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一个再也见不到的人身边，那人还笑着同你说家常",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "一个从未去过、却莫名熟悉的朝代，城下正鼓角齐鸣",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "诗体",
    stem: "若把这一路的你写成一首诗，你希望是哪一种？",
    options: [
      {
        text: "边塞诗：醉卧沙场，古来征战几人回",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "咏物诗：一花一木，皆有寄托",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "闺怨词：一字一句，都是心事",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "怀古诗：大江东去，浪淘尽千古风流",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: 1, energy: 1 },
      },
    ],
  },
  {
    title: "收尾",
    stem: "回望来路，总有一段过往放不下。若为它写一句收尾——",
    options: [
      {
        text: "此后风雪，与我无关",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["风"],
      },
      {
        text: "那年花开，我们都还年少",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "灯下旧物，一件件收好",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "江湖路远，后会有期",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
    ],
  },
  {
    title: "此生",
    stem: "旅途将尽。如果能换一种活法，你想成为——",
    options: [
      {
        text: "仗剑远游的侠客",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "隐居山林的琴师",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["山"],
      },
      {
        text: "守着一座楼、等一个人回来的人",
        dims: { loutai: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "宁死也要秉笔直书的史官",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "留名",
    stem: "此行的最后，你想把自己的名字写在哪里？",
    options: [
      {
        text: "写在云上，风一吹就散",
        dims: { tianxiang: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["云"],
      },
      {
        text: "刻进城墙的砖里，让后来人都看得见",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "夹进一本旧诗集，没人会再翻开",
        dims: { diangu: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "写给一个人，让那人一辈子都忘不掉",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
];
