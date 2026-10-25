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
export const QUIZ_VERSION = "0.4.1";

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    title: "临行",
    stem: "明日便要远行。今夜，你在做什么？",
    options: [
      {
        text: "【明扬】山河＋天象｜山",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["山"],
      },
      {
        text: "【明抑】典故＋人间",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】光阴＋草木",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】楼台＋情思",
        dims: { loutai: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "行囊",
    stem: "天亮出门前，你往行囊里多放了一样东西——",
    options: [
      {
        text: "【明扬】器用＋楼台｜剑",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["剑"],
      },
      {
        text: "【明抑】草木＋天象｜柳",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["柳"],
      },
      {
        text: "【暗扬】光阴＋情思",
        dims: { guangyin: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】典故＋山河",
        dims: { diangu: 2, shanhe: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "逢雨",
    stem: "行至半途，忽然落起雨来。你会——",
    options: [
      {
        text: "【明扬】光阴＋山河",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "【明抑】楼台＋典故",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】人间＋器用｜酒",
        dims: { renjian: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "【暗抑】天象＋草木｜雪",
        dims: { tianxiang: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雪"],
      },
    ],
  },
  {
    title: "歧路",
    stem: "前面分出几条路。你走哪一条？",
    options: [
      {
        text: "【明扬】楼台＋草木｜楼",
        dims: { loutai: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "【明抑】人间＋光阴",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】山河＋楼台｜江河",
        dims: { shanhe: 2, loutai: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "【暗抑】情思＋天象｜雨",
        dims: { qingsi: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "古城",
    stem: "黄昏时分，你走进一座古城。最先去哪里？",
    options: [
      {
        text: "【明扬】天象＋器用｜雪",
        dims: { tianxiang: 2, qiyong: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "【明抑】光阴＋典故",
        dims: { guangyin: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】草木＋情思｜马",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "【暗抑】人间＋楼台",
        dims: { renjian: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "赠别",
    stem: "住了几日，又要上路。送你出城的人，临别给了你——",
    options: [
      {
        text: "【明扬】情思＋楼台",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "【明抑】草木＋人间｜马",
        dims: { caomu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["马"],
      },
      {
        text: "【暗扬】天象＋山河｜月",
        dims: { tianxiang: 2, shanhe: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["月"],
      },
      {
        text: "【暗抑】典故＋器用",
        dims: { diangu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "山行",
    stem: "出了城，路渐渐进了山。若能让一个景象永远停住，你选——",
    options: [
      {
        text: "【明扬】典故＋草木",
        dims: { diangu: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "【明抑】山河＋情思",
        dims: { shanhe: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】器用＋人间｜灯",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["灯"],
      },
      {
        text: "【暗抑】光阴＋天象｜雨",
        dims: { guangyin: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "旧梦",
    stem: "夜宿荒驿，你梦见自己回到——",
    options: [
      {
        text: "【明扬】草木＋情思｜花",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "【明抑】天象＋楼台｜风",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["风"],
      },
      {
        text: "【暗扬】典故＋光阴",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】器用＋山河｜酒",
        dims: { qiyong: 2, shanhe: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["酒"],
      },
    ],
  },
  {
    title: "题壁",
    stem: "驿站的墙上满是前人题的诗。你也提笔，写下——",
    options: [
      {
        text: "【明扬】天象＋人间｜风",
        dims: { tianxiang: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["风"],
      },
      {
        text: "【明抑】楼台＋光阴",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】情思＋典故",
        dims: { qingsi: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】草木＋器用｜花",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["花"],
      },
    ],
  },
  {
    title: "回望",
    stem: "回望来路，总有一段过往放不下。若为它写一句收尾——",
    options: [
      {
        text: "【明扬】山河＋典故｜江河",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "【明抑】器用＋草木｜剑",
        dims: { qiyong: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["剑"],
      },
      {
        text: "【暗扬】楼台＋光阴｜楼",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "【暗抑】情思＋人间｜梦",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
    ],
  },
  {
    title: "此生",
    stem: "旅途将尽。如果能换一种活法，你想成为——",
    options: [
      {
        text: "【明扬】人间＋山河",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "【明抑】器用＋光阴｜灯",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "【暗扬】草木＋典故",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】天象＋楼台｜月",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
    ],
  },
  {
    title: "留名",
    stem: "此行的最后，你想把自己的名字写在哪里？",
    options: [
      {
        text: "【明扬】典故＋天象",
        dims: { diangu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "【明抑】情思＋器用",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "【暗扬】人间＋光阴",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "【暗抑】山河＋草木｜山",
        dims: { shanhe: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["山"],
      },
    ],
  },
];
