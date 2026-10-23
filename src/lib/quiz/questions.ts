import type { QuizQuestion } from "./types";

/**
 * 寻曲测验题目（简体原文，繁体由服务端转换）。
 *
 * 十二题是一段旅程：临行、上路、进城、出城、入山、夜宿，再回望与收束。
 *
 * 出题约定：
 * - 维度：主维度 2、副维度 1。每题四个选项的主维度各不相同；
 *   各维度出现频次不必严格均衡——匹配前会按均匀作答的解析分布做标准化。
 * - 情绪 mood：明 +1 / 暗 -1，扬 +1 / 抑 -1，只参与匹配、不展示。
 *   情绪要写进选项文字里，而不是凭题意揣测；每题四个选项分占明扬、明抑、暗扬、暗抑，
 *   同一维度在不同题里也要配不同情绪，否则情绪会和维度绑在一起。
 * - 意象 imagery：只标选项里被「看」的对象，背景和修饰不标；
 *   题干已经写到的意象（逢雨的雨、旧梦的梦、山行的山）不标，否则人人都会选中。
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
        text: "温一壶酒，和旧友笑闹到半夜",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "听了一夜的风，迟迟睡不着",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["风"],
      },
      {
        text: "摊开舆图，一寸一寸量过要走的山川",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["山"],
      },
      {
        text: "把没说出口的话写成信，写完，又烧了",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "行囊",
    stem: "天亮出门前，你往行囊里多放了一样东西——",
    options: [
      {
        text: "一柄剑。世道不太平，总要防身",
        dims: { renjian: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["剑"],
      },
      {
        text: "一册空白的诗本，打算一路写满",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一包故乡的土，想家了就闻一闻",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "一枝院里的柳。古人折柳送别，如今没人送你",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["柳"],
      },
    ],
  },
  {
    title: "逢雨",
    stem: "行至半途，忽然落起雨来。你会——",
    options: [
      {
        text: "躲进路边茶寮，听檐角滴答了一下午",
        dims: { loutai: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "冒雨策马，去追一个不辞而别的人",
        dims: { shanhe: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "站在雨里数雨声，想这场雨已下了多少年",
        dims: { guangyin: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "想起那年也是这样的雨，和那人笑着跑了一路",
        dims: { qingsi: 2, guangyin: 1 },
        mood: { tone: 1, energy: 1 },
      },
    ],
  },
  {
    title: "歧路",
    stem: "前面分出几条路。你走哪一条？",
    options: [
      {
        text: "沿江而下的水路，顺流一日千里",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "穿过花林的小径，花都谢了，落了满地",
        dims: { caomu: 2, guangyin: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["花"],
      },
      {
        text: "古战场上的旧官道，据说夜里还听得见金戈声",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "绕远的那条，经过故人住的村子，顺路讨碗茶喝",
        dims: { renjian: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
      },
    ],
  },
  {
    title: "古城",
    stem: "黄昏时分，你走进一座古城。最先去哪里？",
    options: [
      {
        text: "登上城楼，看暮色里万家灯火一盏盏亮起",
        dims: { loutai: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["楼", "灯"],
      },
      {
        text: "钻进酒肆，和素不相识的人拼桌痛饮",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "茶馆，听说书人拍案讲到亡国那一段",
        dims: { renjian: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "城外渡口，看江水流向何方",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["江河"],
      },
    ],
  },
  {
    title: "赠别",
    stem: "住了几日，又要上路。送你出城的人，临别给了你——",
    options: [
      {
        text: "一枝带雪的红梅，开得正盛，像要烧起来",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "一盏旧灯笼，说夜里冷，好歹有点光",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "一封信，说等你走远了再拆，拆了也别回来",
        dims: { qingsi: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "一把旧伞，说这一路的雨，只能替你挡这一程了",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "山行",
    stem: "出了城，路渐渐进了山。若能让一个景象永远停住，你选——",
    options: [
      {
        text: "云海无声，一直铺到天边",
        dims: { tianxiang: 2, shanhe: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "大雪封山，万籁俱寂",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雪"],
      },
      {
        text: "满坡野花，蜂蝶闹成一片",
        dims: { caomu: 2, guangyin: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "一个少年与你擦肩，说要去报十年前的仇",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
    ],
  },
  {
    title: "旧梦",
    stem: "夜宿荒驿，你梦见自己回到——",
    options: [
      {
        text: "一座没人住的旧宅，门虚掩着",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "少年时那条江上，船顺流而下，快得像飞",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
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
    title: "题壁",
    stem: "驿站的墙上满是前人题的诗。你也提笔，写下——",
    options: [
      {
        text: "「一杯酒，一身伤，此去不问归期」",
        dims: { qiyong: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "「今夜月色正好，抄一份寄给远方」",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["月"],
      },
      {
        text: "「北至大漠，南到海边，我都来过」",
        dims: { shanhe: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "「此处曾有一人，等过一个人」",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "回望",
    stem: "回望来路，总有一段过往放不下。若为它写一句收尾——",
    options: [
      {
        text: "此后风雪，与我无关",
        dims: { tianxiang: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["风", "雪"],
      },
      {
        text: "那年花开，我们都还年少",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["花"],
      },
      {
        text: "江湖路远，后会有期",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "人去楼空，灯也熄了",
        dims: { loutai: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["楼", "灯"],
      },
    ],
  },
  {
    title: "此生",
    stem: "旅途将尽。如果能换一种活法，你想成为——",
    options: [
      {
        text: "鲜衣怒马、仗剑远游的侠客",
        dims: { renjian: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["马", "剑"],
      },
      {
        text: "隐居山林的琴师",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["山"],
      },
      {
        text: "守着一座楼，等一个人回来，等多久都行",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "替一个时代写完最后一页的史官",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "留名",
    stem: "此行的最后，你想把自己的名字写在哪里？",
    options: [
      {
        text: "刻进城墙的砖里，让后来人都看得见",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "写在一场梦里，醒来就忘了",
        dims: { guangyin: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["梦"],
      },
      {
        text: "夹进一本旧诗集，没人会再翻开",
        dims: { diangu: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
      },
      {
        text: "刻在随身那柄剑上——剑在，人就在",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["剑"],
      },
    ],
  },
];
