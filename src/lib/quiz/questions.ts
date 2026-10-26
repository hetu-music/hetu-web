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
    stem: "明日便要远行。今夜，你要——",
    options: [
      {
        text: "远望山峦与群星，只等天亮出发",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["山"],
      },
      {
        text: "趁夜走过熟悉的街巷，与亲友一一道别",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "抚过相伴多年的老马，约定未知的归期",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "独倚栏杆，想一个不会来送行的人",
        dims: { loutai: 2, qingsi: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "行囊",
    stem: "出门前，你往行囊里多放了一样东西——",
    options: [
      {
        text: "一柄挂在堂上多年的剑",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["剑"],
      },
      {
        text: "一截带着晨露的柳枝",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["柳"],
      },
      {
        text: "一封珍藏多年的信",
        dims: { guangyin: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "一本来自前朝的游记",
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
        text: "迎着雨大步赶路，趁天色尚早，能走几里是几里",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "躲进路边古寺，借机品读前人的碑刻",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "在野店要一坛酒，与满身风尘的行客对饮",
        dims: { renjian: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "停在荒野枯林边，看雨渐渐化雪，埋了来时的路",
        dims: { tianxiang: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雪"],
      },
    ],
  },
  {
    title: "歧路",
    stem: "前面分出几条路。你选择——",
    options: [
      {
        text: "尽头似有绿柳朱楼的那条，远远望去颇具气象",
        dims: { loutai: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "通向渡口集市的那条，或可一睹渔舟唱晚",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "沿着江水那条，去那座被攻破过的城关",
        dims: { shanhe: 2, loutai: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "雨幕无人那条，远方皆是一片模糊",
        dims: { qingsi: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "古城",
    stem: "黄昏时分，你走进一座古城。最先去——",
    options: [
      {
        text: "夜市踏雪，买一盏精巧的花灯",
        dims: { tianxiang: 2, qiyong: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "庙前书摊，翻看那些泛黄的书",
        dims: { guangyin: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "城角旧园，探看草木掩映的旧誓",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "临街客栈，隔窗看陌生的过客",
        dims: { renjian: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "赠别",
    stem: "倏忽几日，又要上路。送你出城的人，临别给了你——",
    options: [
      {
        text: "一幅手绘的城中明楼长卷",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一匹温驯的瘦马，缰绳尚带掌心温热",
        dims: { caomu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["马"],
      },
      {
        text: "一首诗，月冷路远，山川广大",
        dims: { tianxiang: 2, shanhe: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["月"],
      },
      {
        text: "一方古砚，虽残了一角，墨痕犹沉",
        dims: { diangu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "山行",
    stem: "出城入山，峰回路转。最触动你心境的一幕是——",
    options: [
      {
        text: "千年古树上挂满祈愿的红绸，在日光里翻飞",
        dims: { diangu: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "清溪边并肩而坐的两个人，谁也没说话",
        dims: { shanhe: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "山寺里那盏长明灯，有人守了它三十年",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["灯"],
      },
      {
        text: "暮色里的一场山雨，下了很久，一直没停",
        dims: { guangyin: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "题壁",
    stem: "暂宿荒驿，墙上满是前人的诗。你也提笔，写下——",
    options: [
      {
        text: "「万里长风吹客袖，四海相逢皆故人」",
        dims: { tianxiang: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["风"],
      },
      {
        text: "「小阁凭栏留数日，晴光满榻不知年」",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "「客榻难分庄蝶梦，挑灯细认旧时名」",
        dims: { qingsi: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "「一盏寒茶尘满案，半窗落木悄无声」",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "旧梦",
    stem: "夜深风止，合眼沉睡。梦里，你又回到——",
    options: [
      {
        text: "落满繁花的庭院，嬉闹追逐，笑声不绝",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "儿时的屋檐下，晒着太阳，听檐铃轻响",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "千年前的一座城，城破那夜，鼓声响了一整晚",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "渡口边一张旧桌，两杯冷酒，只有你一个人",
        dims: { qiyong: 2, shanhe: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["酒"],
      },
    ],
  },
  {
    title: "留名",
    stem: "旅途将尽，你想把自己的名字写在哪里？",
    options: [
      {
        text: "写进志怪传奇里，让后人编成传说",
        dims: { diangu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "隐刻在古琴腹底，借每一次拨弦，无声呼应心意",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "留在一路相逢的行客心中，纵使终会被遗忘",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "留在荒山绝壁上，任青苔荒草掩没，与山同寂",
        dims: { shanhe: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["山"],
      },
    ],
  },
  {
    title: "回望",
    stem: "回望来路，若为它写一句收尾——",
    options: [
      {
        text: "「大江东去，我也算其中一朵浪」",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "「宝剑挂桃枝，休问恩仇，且共桃花老」",
        dims: { qiyong: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["剑"],
      },
      {
        text: "「那座楼我替你守着，守到哪一年都行」",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "「就当是一场梦，醒来各自是陌生人」",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
    ],
  },
  {
    title: "此生",
    stem: "千帆过尽。如果能换一种活法，你想成为——",
    options: [
      {
        text: "",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "在巷口卖了一辈子灯笼的手艺人",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "守着传说中那株千年不谢的花，一守就是一生",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "独守观星台、对着月亮过完一生的人",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
    ],
  },
];
