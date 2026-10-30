import type { QuizQuestion } from "./types";

/**
 * 寻曲测验题目（简体原文，繁体由服务端转换）。
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
        text: "山寺的那面斑驳壁画渐渐清晰，你化身故事的主角，正要为旧怨做个了断",
        dims: { diangu: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "炉上的残酒早已散尽了热气，抬头驿馆已不知何处，只剩暮色里苍茫的远水",
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
        text: "亲眼看到了书中记载的奇异天光，漫天云霞终日不散，仿佛身在另一个世间",
        dims: { diangu: 2, tianxiang: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "漏窗里摆着旧木案与粗瓷茶具，样式寻常，却莫名像极了你曾向往的某处旧居",
        dims: { qingsi: 2, qiyong: 1 },
        mood: { tone: 1, energy: -1 },
      },
      {
        text: "人们对你的称呼渐渐改变，原来光阴已在脚下走过。好在想见的人间，都已见过了",
        dims: { renjian: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
      },
      {
        text: "所见山川草木日渐相似，或许继续前行也只是昨日的重复，不如就此停下",
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
        text: "沿着江边走村串巷，兴起时呼喝两句船家口口相传的古老水调",
        dims: { shanhe: 2, diangu: 1 },
        mood: { tone: 1, energy: 1 },
        imagery: ["江河"],
      },
      {
        text: "拿着旧剑进林子采摘山果草药，拨枝斩蛇，倒比赶路时用得更勤",
        dims: { qiyong: 2, caomu: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["剑"],
      },
      {
        text: "在深夜一边听着城中谯楼传来的报更声，一边写一些无关紧要的往事",
        dims: { loutai: 2, guangyin: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["楼"],
      },
      {
        text: "与街坊邻里闲谈琐事时突然失神，觉得眼下的安稳像一场大梦",
        dims: { qingsi: 2, renjian: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["梦"],
      },
    ],
  },
  {
    title: "又行",
    stem: "又一年春深，你又动了远行的念头。这一回，你打算——",
    options: [
      {
        text: "搭上南下出海的远洋商船，与操着各色口音的行商一道，去见识更辽阔的世外",
        dims: { renjian: 2, shanhe: 1 },
        mood: { tone: 1, energy: 1 },
      },
      {
        text: "寻访一位封炉已久的师傅，学着灯下看火候、试釉色，亲手烧几件称心的瓷器",
        dims: { qiyong: 2, guangyin: 1 },
        mood: { tone: 1, energy: -1 },
        imagery: ["灯"],
      },
      {
        text: "深入西南密林，尝试移栽培育几种药书中记载过、却罕见于世的奇花异草",
        dims: { caomu: 2, diangu: 1 },
        mood: { tone: -1, energy: 1 },
        imagery: ["花"],
      },
      {
        text: "去茫茫沙漠寻找被掩埋的断壁残垣，去看看那清月照旧城透出的罕见荒凉",
        dims: { tianxiang: 2, loutai: 1 },
        mood: { tone: -1, energy: -1 },
        imagery: ["月"],
      },
    ],
  },
];
