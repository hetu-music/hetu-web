import { notFound } from "next/navigation";

// 语言路由下没有匹配的路径都落到这里，交给 [locale]/not-found：
// 否则会掉到根目录的 not-found，那里没有语言布局（字体、深色模式、繁体文案）
export default function CatchAllPage() {
  notFound();
}
