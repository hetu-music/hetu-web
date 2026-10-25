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
        text: "爬上屋顶看远处的山，满天星斗，只等天亮出发",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["山"],
      },
      {
        text: "陪家中老人喝茶，听那些讲了许多遍的旧事",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "在老树上刻下今天——不管多少年，总要回来刻第二道",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "独坐空屋到深夜，想着一个不会来送你的人",
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
        text: "挂在堂上多年的那柄剑，终于取下来了",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["剑"],
      },
      {
        text: "一截带着晨露的柳枝，插在哪里都能活",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["柳"],
      },
      {
        text: "一封那人多年前的信，读了无数遍，还是要带上",
        dims: { guangyin: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "一本前人的游记，写到的地方，如今大半已不在了",
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
        text: "不躲了，淋着雨大步赶路——年少时不就该这样",
        dims: { guangyin: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "躲进路边古寺，听老僧讲寺里的来历",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "要一坛烈酒，和邻桌的陌生人对饮，骂这世道",
        dims: { renjian: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "看着雨渐渐变成雪，落满路边的枯枝",
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
        text: "通往那座高楼的路，满院海棠，楼上正有人唱歌",
        dims: { loutai: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "绕远的那条，经过儿时的村子，顺路和旧邻说说话",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "逆着江水一路向北，去那座被攻破过的城关",
        dims: { shanhe: 2, loutai: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "那人当年离开时走的那条，那天也下着雨",
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
        text: "城里正下初雪，去街上买串糖葫芦，看孩子们打雪仗",
        dims: { tianxiang: 2, qiyong: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "城隍庙前的旧书摊，翻一本比你年纪还大的书",
        dims: { guangyin: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "去马市挑一匹最快的马，追一个不告而别的人",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "住进临街客栈，隔窗看人来人往，一个也不认识",
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
        text: "一把院门钥匙，笑着说：「下回来，直接进门！」",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一匹跟了主人半辈子的老马，说它认得回来的路",
        dims: { caomu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["马"],
      },
      {
        text: "一句话：「塞外月冷，你也别回头」",
        dims: { tianxiang: 2, shanhe: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["月"],
      },
      {
        text: "一方旧砚，说是祖上传下来的，从此再没人用了",
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
        text: "千年古树上挂满祈愿的红绸，在日光里翻飞",
        dims: { diangu: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "清溪边并肩坐着的两个人，谁也没说话",
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
    title: "旧梦",
    stem: "夜宿荒驿，你梦见自己回到——",
    options: [
      {
        text: "那年和那人在花下追着跑，笑得停不下来",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "儿时的屋檐下，风吹得檐铃轻响",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["风"],
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
    title: "题壁",
    stem: "驿站的墙上满是前人题的诗。你也提笔，写下——",
    options: [
      {
        text: "「乘风万里，四海皆是故人」",
        dims: { tianxiang: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["风"],
      },
      {
        text: "「此间小住三日，晴，甚好」",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "「便是化成石头，也站在这里等」",
        dims: { qingsi: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "「一盏冷茶，半窗落花，无人来」",
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
        text: "「大江东去，我也算其中一朵浪」",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "「剑挂在桃树上，不再取下来了」",
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
    stem: "旅途将尽。如果能换一种活法，你想成为——",
    options: [
      {
        text: "走到哪儿都有朋友的游侠，天下就是家",
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
        text: "传说里守护神木的人，一守就是一生",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "独守观星台、对着月亮过完一生的人",
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
        text: "化作一颗星，让后人编成传说",
        dims: { diangu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "绣在给那人的帕子一角，小小的，只那人知道",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "刻在战友的墓碑旁，年年回来描一遍",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "刻在深山里一棵树上，等树长高，就再没人看得见",
        dims: { shanhe: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["山"],
      },
    ],
  },
];
