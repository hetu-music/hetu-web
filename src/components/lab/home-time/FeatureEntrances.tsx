export interface FeatureEntranceItem {
  id: string;
  href: string;
  title: string;
  tag: string;
  desc: string;
  accentLight: string;
  accentDark: string;
  /** 实体特辑别册的布面/纸面深色（方向 A 同架别册用） */
  folioBg: string;
  /** 别册书脊色（斜立时露出的一线矿色） */
  spineColor: string;
}

export const CORE_FEATURES: FeatureEntranceItem[] = [
  {
    id: "qjtx",
    href: "/story/qjtx",
    title: "倾尽天下",
    tag: "互动长卷",
    desc: "一曲长歌，随乐声缓步展开江山旧梦",
    accentLight: "#9E3636",
    accentDark: "#E46A6A",
    folioBg: "#5B2323",
    spineColor: "#8C3333",
  },
  {
    id: "imagery",
    href: "/imagery",
    title: "意象词云",
    tag: "词中万象",
    desc: "从长安白雪到孤城旧梦，漫游词中谱系",
    accentLight: "#286B62",
    accentDark: "#52BCAE",
    folioBg: "#1F443F",
    spineColor: "#2F6E65",
  },
  {
    id: "quiz",
    href: "/quiz",
    title: "寻曲",
    tag: "十二问寻歌",
    desc: "十二个问题，一段旅程，寻一首懂你的歌",
    accentLight: "#9A6728",
    accentDark: "#DFA95B",
    folioBg: "#593D1E",
    spineColor: "#93632A",
  },
];
