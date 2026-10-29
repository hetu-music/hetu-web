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
export const QUIZ_VERSION = "0.4.4";

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    title: "临行",
    stem: "明日便要远行。今夜，你会——",
    options: [
      {
        text: "望着远方山峦上的繁星，想象一路上会遇到的人和事",
        dims: { shanhe: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["山"],
      },
      {
        text: "再逛一逛这座熟悉的小城，记下它的来历，和它灯火点点的样子",
        dims: { diangu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "为陪伴自己长大的老马准备草料，让它好好等自己回来",
        dims: { guangyin: 2, caomu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["马"],
      },
      {
        text: "什么也不做，坐在院子里盯着老屋的檐角发呆",
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
        text: "挂在堂上多年的剑，说不定可以用来扮演侠客",
        dims: { qiyong: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["剑"],
      },
      {
        text: "一截带着晨露的柳枝，所谓灞陵别柳，这样就够了",
        dims: { caomu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["柳"],
      },
      {
        text: "幼时玩伴送的小陶埙，若有缘再见也好起个话头",
        dims: { guangyin: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "一本前朝的游记，时移事易，也不知能看到几处旧时风景",
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
        text: "去古寺避雨，听说那里有很多碑刻，正好借机品读",
        dims: { loutai: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "到野店要一坛酒，听同来避雨的南北行客闲谈各自的漂泊",
        dims: { renjian: 2, qiyong: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["酒"],
      },
      {
        text: "找棵大树暂避一下，看雨渐渐化成雪，埋了来时的路",
        dims: { tianxiang: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雪"],
      },
    ],
  },
  {
    title: "渡口",
    stem: "雨势渐微，前方是一处水陆交汇的津渡。候船间隙，你的目光落在——",
    options: [
      {
        text: "远处的朱楼，在花柳的掩映下颇具气象",
        dims: { loutai: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "路旁的集市。正值归棹，那里人来人往很是嘈杂，满是市井气息",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "江对岸的一座城楼，看起来废弃很久了，不过仍然非常雄伟",
        dims: { shanhe: 2, loutai: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "水天相接的地方，烟雨迷蒙，什么都看不太清楚",
        dims: { qingsi: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "古城",
    stem: "弃舟登岸，你走进一座古城。略作休息之后，你会想——",
    options: [
      {
        text: "趁着雪后去逛下此处有名的灯会，买些有趣的小物件留念",
        dims: { tianxiang: 2, qiyong: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "找一间书屋，这座城历史悠久，应当有一些少见的典志",
        dims: { guangyin: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "去那座草木深处的祠堂，它的传说你早有耳闻，当去一见",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "找家临街的客栈住下，倚在窗边静静地看街上的人来来往往",
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
        text: "一幅手绘长卷，画着你们登城远眺",
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
        text: "一首诗，月冷路远，但行莫回头",
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
        text: "坐在清溪边的两个人，静听水声潺潺",
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
        text: "「长风浩荡排云去，笑语喧阗逐客来」",
        dims: { tianxiang: 2, renjian: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["风"],
      },
      {
        text: "「小阁凭栏分晚照，晴轩欹枕借新凉」",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "「回文织就无人读，断句题残未肯休」",
        dims: { qingsi: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "「一盏寒茶凝夜色，半窗落木上秋声」",
        dims: { caomu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "旧梦",
    stem: "夜深人静，合眼沉睡。梦里，你又回到——",
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
        text: "写进志怪传奇里，与天上星宿并列",
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
    stem: "回望来路，若为这一程写一句收尾——",
    options: [
      {
        text: "「六朝烟水一舟轻，江声吞赤壁，帆影过金陵」",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "「收旧剑，挂桃枝，春林深处好栖迟」",
        dims: { qiyong: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["剑"],
      },
      {
        text: "「朝也留，暮也留，留到阶前草几秋，有人犹倚楼」",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "「梦里旧时同路。回顾，回顾，唯有来途如故」",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
    ],
  },
  {
    title: "浮生",
    stem: "千帆过尽。如果能选一种活法，你想成为——",
    options: [
      {
        text: "走遍天南地北、处处有人共饮的人",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一灯一卷，把日子慢慢过旧的人",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "扫去一春落花，在残瓣上题写前人旧句的人",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "夜对空庭，等一轮清月照亮瓦檐的人",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
    ],
  },
];
