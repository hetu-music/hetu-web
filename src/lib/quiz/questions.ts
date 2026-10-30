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
export const QUIZ_VERSION = "0.4.5";

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
        text: "为陪伴自己长大的老马再准备一次草料，让它好好等自己回来",
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
        text: "幼时玩伴送的小陶埙，若有缘再见，也好起个话头",
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
        text: "去古寺避雨，听说那里有很多前人碑刻，正好借机品读",
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
        text: "找棵大树暂避一时，看雨渐渐化成雪，埋了来时的路",
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
        text: "趁着雪后去逛下此地有名的灯会，买些有趣的小物件留念",
        dims: { tianxiang: 2, qiyong: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["雪"],
      },
      {
        text: "找家书肆，这座城历史悠久，应当有一些少见的典志",
        dims: { guangyin: 2, diangu: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "城角有座草木繁茂的祠堂，它的传说你早有耳闻，当去一见",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "找家临街的客栈住下，倚在窗边静静地看街上来来往往的行人",
        dims: { renjian: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "赠别",
    stem: "盘桓几日，又到了启程之时。送你出城的人，临别给了你——",
    options: [
      {
        text: "画着你们登楼远眺的长卷，气韵生动，看得出费了不少心思",
        dims: { qingsi: 2, loutai: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "一匹温驯的瘦马，说旅途漫长，有个生灵作伴总不至于太孤单",
        dims: { caomu: 2, renjian: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["马"],
      },
      {
        text: "字迹瘦削的一首诗，写着前路月冷山遥，但只管前行、不必回头",
        dims: { tianxiang: 2, shanhe: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["月"],
      },
      {
        text: "一方造型精美的古砚，但来历已不可考，只在凹处沉着化不开的旧墨痕",
        dims: { diangu: 2, qiyong: 1 },
        mood: { tone: -1, energy: -1 },
      },
    ],
  },
  {
    title: "山行",
    stem: "出城入山，景物多变。最让你难忘的一幕是——",
    options: [
      {
        text: "日光下翻飞的红绸。因传山神有灵，至今已几乎看不到绸下的古树了",
        dims: { diangu: 2, caomu: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "隔谷相望的两座青峰，明明相距甚远，倒影却在谷底清潭里叠在了一处",
        dims: { shanhe: 2, qingsi: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "山寺中独建一室的长明灯，据说乃是一人所奉，三十年来昼夜未熄",
        dims: { qiyong: 2, renjian: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["灯"],
      },
      {
        text: "山背的幽谷。虽处晴日，仍在淅淅沥沥地下着不知积了多久的冷雨",
        dims: { guangyin: 2, tianxiang: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["雨"],
      },
    ],
  },
  {
    title: "题壁",
    stem: "借宿荒驿，墙上满是前人的诗。你也提笔，写下——",
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
    title: "入梦",
    stem: "夜深人静，听着风声缓缓睡去。恍惚间，你梦见——",
    options: [
      {
        text: "院里那株象征好运的树花满枝头，你正满心欢喜地仰头去接飞舞的落英",
        dims: { caomu: 2, qingsi: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "午后的阳光晒得人昏昏欲睡，叮铃一声，睁眼便看到屋下随风摇动的檐铃",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "山寺的那面斑驳壁画在梦里渐渐清晰，你是故事的主角，正要为旧怨做个了断",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "炉上的残酒早已散尽了热气，抬头不见四壁，只剩暮色里苍茫的远水",
        dims: { qiyong: 2, shanhe: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["酒"],
      },
    ],
  },
  {
    title: "驻足",
    stem: "不知走了多久，你忽然觉得不必再前行了。留住你脚步的是——",
    options: [
      {
        text: "古卷里记载过的那片奇异天光，漫天云霞终日不散，真如传说中的世外仙境一般",
        dims: { diangu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "临水小院里一方干净的旧木案与粗瓷茶具，让人一见便觉安心，只想坐下来安放一路的心事",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "溪水里映出的自己那双略显疲惫却依然明亮的眼睛，走了这么多个寒暑，是时候歇一歇了",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "四面静默合拢的苍茫群山，漫山遍野的荒草隔绝了尘世，安静得像是大地真正的尽头",
        dims: { shanhe: 2, caomu: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["山"],
      },
    ],
  },
  {
    title: "久居",
    stem: "于是你在这里住了下来。日子久了，你常常——",
    options: [
      {
        text: "去大江边看潮起潮落，对照着地方旧志，寻访沿岸那些流传已久的奇闻旧事",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "在院里种了一架青藤，搬把竹椅坐在廊下，看翠绿的藤蔓一天天爬上壁间挂着的旧剑鞘",
        dims: { qiyong: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["剑"],
      },
      {
        text: "在黄昏时登上那座历经百年风雨的古楼，虽已朱漆剥落，看飞檐刺破暮色却依然豪气不减",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "在夜里梦见一路上擦肩而过的那些面孔，可每次醒来，却连一个名字也想不起来",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
    ],
  },
  {
    title: "又行",
    stem: "又一年春深，你又动了远行的念头。这一回，你想去——",
    options: [
      {
        text: "南来北往的商道上，跟着浩浩荡荡的驼队走一程，去见识天南地北的风土与豪客",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "深山里一座藏书万卷的古老书院，在青灯下安安静静读上几年闲书",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "古籍里提过的那片绝域花海，哪怕前人说它早已湮灭，也要亲自去印证一回",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "荒原尽头那座废弃已久的观星台，在空旷的高处，独自看一轮清月升起又落下",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
    ],
  },
];
