# 河图站点设计语言

改动公开页面（`src/app/[locale]/(public)/**` 及其组件）的界面前先读本文件。歌曲详情页（`src/components/detail/**`）是这套风格的样板：拿不准时，照它的写法做，不要另起一套。后台（`/admin`）不在此列，除非明确要求。主页的结构与例外另见 `DESIGN-HOME.md`。

## 一、总体气质：一本书，而不是一个应用

页面是一部作品的「卷」：有卷首、正文、手记、评点、版记。版式靠字体、字距、留白与细线分层，不靠卡片、色块、阴影和图标。

判断一个设计是否合格，问三件事：

1. 去掉所有边框和底色，层次还清楚吗？清楚才对，层次应该来自字号、字重、字距和留白。
2. 有没有一处是为了「像个应用」而加的装饰（徽章、渐变按钮、图标标题、彩色卡片）？有就删掉。
3. 中文读起来像书上的用语吗？（「卷首」「版记」「呈评」，而不是「详情」「信息」「提交」。）

## 二、颜色

### 底色与文字

- 页面底色：`bg-[#FAFAFA] dark:bg-[#0B0F19]`。浮层（下拉、底部面板）用同一底色，不用纯白。
- 文字只用 slate 一个色阶，按层级取用，每个颜色都要配 `dark:`：

| 用途                 | 浅色                                  | 深色                                     |
| -------------------- | ------------------------------------- | ---------------------------------------- |
| 标题                 | `text-slate-900`                      | `dark:text-slate-50` / `dark:text-white` |
| 正文                 | `text-slate-800`                      | `dark:text-slate-200`                    |
| 诗文、手记、批注正文 | `text-slate-700`                      | `dark:text-slate-300`                    |
| 次要信息             | `text-slate-500`、`text-slate-600`    | `dark:text-slate-400`                    |
| 标签、落款、元信息   | `text-slate-400`                      | `dark:text-slate-500`                    |
| 细线                 | `bg-slate-200`、`border-slate-200/70` | `dark:bg-slate-800`                      |

### 强调色 `--tone`

- 全页只有一个强调色，写作 `text-(--tone)`、`bg-(--tone)`、`border-(--tone)/40`。不要直接写 `blue-500` 之类的固定色。
- 有封面的页面：从封面取色（`src/lib/utils/utils-tone.ts` 的 `toneFromImage`）。在根容器上设 `--tone-light` 与 `--tone-dark`，再用 `[--tone:var(--tone-light)] dark:[--tone:var(--tone-dark)]` 切换。封面色还可以用 `wash` 在页面顶部铺两团极淡的径向渐变，取到颜色后用 1.4s 淡入。
- 没有封面的页面（首页、个人中心、登录、加载、404、出错等）：统一用墨蓝 `INK_TONE`（浅色 `#394c7f`，深色 `#95a8da`）。`globals.css` 已在 `:root` / `.dark` 上把它设为 `--tone` 的默认值，所以播放器、浮层这类挂在页面之外的共享组件也能直接写 `text-(--tone)`；页面想更明确，也可以在根容器上再设一次。`NEUTRAL_TONE` 只留给封面几乎无彩色时的兜底，太灰，当不了强调色。
- 共享组件里不要写死 `blue-*`，一律用 `--tone`。实心强调色底上的字写 `text-white dark:text-slate-900`：深色主题下 `--tone` 是浅色。
- 强调色只用在：章节题头、当前项、可操作的文字按钮、进度条、选中状态。不要大面积铺色。

### 固定语义色（仅限以下场合）

- 意象一级分类：必须用 `src/lib/imagery/palette.ts`，全站同一类别同一颜色。
- 警示、争议资料：amber（参考 `DisputeNotice`），这是全页唯一允许的带底色提示块。
- 删除确认、已收藏：rose。
- 站标：顶栏站名「河图 | 作品勘鉴」中间的竖线固定用 `bg-blue-600`。它是站标的一部分，不是强调色，不随 `--tone` 变。顶栏的用户图标在已登录时也用这个颜色（`text-blue-600`），与竖线呼应。
- 迁移旧页面时，把 `blue-*` 系列强调色一律改成 `--tone`（站标竖线和已登录的用户图标除外）。

## 三、字体

| 类                 | 字体                             | 用在哪里                                                             |
| ------------------ | -------------------------------- | -------------------------------------------------------------------- |
| `font-serif`       | Playfair Display + Noto Serif SC | 标题、歌名、歌词正文、章节题头、作品名                               |
| `font-kaiti`       | 楷体                             | 创作手记、批注与评点正文、「共有」意象、空状态文案——凡是「人写的话」 |
| `font-calligraphy` | 刻本                             | 意象名、卷首竖排摘句；只用于少量大字                                 |
| `font-sans`        | Inter + Noto Sans SC             | 界面小字：按钮、标签、元信息                                         |
| `font-mono`        | 等宽                             | LRC 原文等「原始数据」                                               |

歌词分两种：歌曲页里成篇排出的是正文，用 `font-serif`；播放条里随播放切换的当前句是摘句，用 `font-kaiti`，与歌名的衬线体拉开层次。

字距是这套风格的主要层级手段：

- 章节题头：`font-serif text-sm tracking-[0.4em] text-(--tone)`，用 `h2`，随 `globals.css` 的标题样式加粗（700），不要另写 `font-normal`。浮层题头同样加粗，只是字号小一档（`text-xs`）。
- 节内分组的题头（如个人中心的「公开资料」「登录邮箱」）：用 `GroupHeading`，与章节题头同一结构，但题名后接的是点线（像目录引线），不是实线，低一档，衬线、`text-[13px]`、加粗、`tracking-[0.3em]`、次要信息的灰（`text-slate-600 dark:text-slate-400`），不能比强调色的章节题头显眼；组距 `space-y-20`。不要写成和字段标签一样的灰色小字，也不要在组间单放一道分隔线：实线和输入框底线同形，会混。
- 眉题（类型 · 流派 · 年份）：`text-xs tracking-[0.35em] text-(--tone)`。
- 字段标签：`text-xs tracking-[0.2em]`–`tracking-[0.3em] text-slate-400`。
- 文字按钮、切换：`text-xs tracking-widest`。
- 大标题反而收紧：`font-serif text-5xl md:text-6xl xl:text-7xl font-semibold leading-[1.1] tracking-tight text-balance`。

行高：歌词 `leading-[2.2]`，手记 `leading-[2.05]`，批注 `leading-[1.85]`。要和正文对齐的旁注，按行高精确计算（见 `CommentGutter` 的 `NOTE_LINE_HEIGHT`）。

## 四、版式

- 顶栏：全站（含后台）只用 `TopBar`（`src/components/shared/topbar/`），不要另写。`fixed h-20`，底色 `/80` 加 `backdrop-blur-md`，底边 `border-slate-200/50`，内容区 `max-w-7xl mx-auto px-4 sm:px-6`。高度记在 `globals.css` 的 `--nav-h`，吸顶的二级栏写 `sticky top-(--nav-h)`，样式统一为页面底色 `/95` 加 `backdrop-blur-sm` 与一道底部细线。意象词云页的分类栏是例外：保留它自己的 `/40` 半透明、`backdrop-blur-2xl` 与几乎看不见的底线，属于该页的独特设计。
  - 出口（`exit`）只有两种：入口页（首页、意象、测试、登录注册）放站名，旁边自动常驻「关于」；内页（歌曲、个人中心、后台）放「返回 · 回主页」，窄屏回主页收进「更多」。
  - 本页导航（`nav`）：有多个去处的用 `PlaceNav`「题名 / 当前项 ▾」，宽屏下拉、窄屏底部面板（歌曲页目录、后台板块）；只有一个题名的直接放题名。
  - 右侧顺序固定：常驻按钮（`pinned`）→ 用户 → 本页操作（`actions`）→ 安装 → 文字 → 主题。窄屏只留常驻按钮与用户，其余进「更多」。
  - 常驻的标准：会显示状态的（收藏、用户），或本页的核心入口（「关于」、后台的使用说明）。窄屏放得下的常驻按钮至多两个。
- 页脚：需要落款的页面只放 `SiteMark`（「河图作品勘鉴 · © 年份」，等宽小字），不另写版权行。
- 正文容器：`max-w-6xl mx-auto px-6 pt-32 md:pt-40 pb-32`。
- 章节：`<section id="…" className="py-16 md:py-20">`，开头放 `<SectionHeading label=…>`（一行小字加一道细线，右侧可放本节的切换项），正文从 `mt-12` 开始。
- 宽屏两栏：`lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-x-16`。左栏放元信息、说明、旁注，右栏放正文。不用栅格的正文用 `lg:ml-[26rem]`（22rem 加 4rem 间距）与右栏对齐。
- 正文行宽：`max-w-[40em]`。
- 分隔方式，按优先级：留白 → 细线（`h-px` / `w-px h-3`）→ 间隔点 `·`。不用卡片框住内容。
- 列表写成一行行文字（`dl` 里 `dt` 小字、`dd` 正文），参考 `SongColophon`、`SongHero` 的署名。
- 超长内容用渐隐折叠：`max-h-*` 加 `overflow-y-clip`，底部用 `bg-linear-to-t from-[#FAFAFA] dark:from-[#0B0F19]` 渐隐，再放一个「展开全文」文字按钮。

## 五、组件写法

### 按钮

- 顶栏图标按钮：统一用 `NAV_BUTTON_CLASS`（`src/components/shared/nav-button.ts`），图标 20px。
- 文字按钮是默认形态：`text-xs tracking-widest`，常态 `text-slate-400 hover:text-slate-700`（深色 `dark:text-slate-500 dark:hover:text-slate-200`），主操作用 `text-(--tone)`。
- 选中与开关状态只改文字颜色，并带 `aria-pressed` / `aria-current`，不加底色块。
- 危险操作两步确认：文字从「删除」变成 rose 色的「确认删除」，3 秒内不点就复原。不用确认弹窗。
- 悬停才出现的操作（如句旁的「批」），只在宽屏用（`hidden lg:flex`，`opacity-0 group-hover:opacity-60`），并保留 `focus-visible` 可见。

### 输入框

- 只有一道底线：`border-0 border-b border-slate-300 focus:border-(--tone) bg-transparent px-0`，正文用楷体。
- 默认一行高，随内容长高：写 `field-sizing-content`，并为 Safari 加 JS 兜底（参考 `CommentComposer`）。
- 字数计数只在接近上限时出现。

### 图片与封面

- `rounded-md` 加 `ring-1 ring-slate-900/5 dark:ring-white/10`。只有主封面带大阴影。
- 缩略图：`grayscale-[35%]`，悬停时变回彩色，同时 `scale-[1.03]`–`[1.04]`，`duration-700`。

### 浮层

- 浮层的行为（焦点、Esc、点外面收起、锁滚动、拖动收起）一律交给 Base UI，样式只在 `src/components/ui/` 的封装里写一次，业务组件不直接用库，也不手写遮罩和 `fixed` 面板：
  - 宽屏下拉：`ui/popover.tsx`。页面底色，`rounded-xl border border-slate-200/70 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)]`；选项用 `topbar/menu.tsx` 的 `MenuList`。
  - 窄屏底部面板：`ui/drawer.tsx`。页面底色、`rounded-t-2xl`、背后一层轻遮罩（顶栏那一截裁掉，交界落在顶栏下沿，状态栏不用跟着变），往下拖可以收起。题头一行加粗的衬线小字，内容写成一行行文字；成组的选项（主题、文字）写成 `dl`，选项用 `·` 隔开的文字按钮（`InlineOptions`）。不用毛玻璃、分段卡片、徽章。
  - 「宽屏下拉、窄屏底部面板」的组合：`ui/responsive-panel.tsx`。
  - 居中弹窗：`ui/dialog.tsx`，题头与底部面板同一种（`PanelHeader`）。
  - 操作结果提示：`ui/toast.tsx`（Base UI Toast，全局一个 `toastManager`，组件外也能 `addToast`）。底部居中，页面底色加细框，出错只把字换成 rose。
  - 带搜索的选择（只能从候选里选）：`ui/combobox.tsx`。可以挂在输入框下方（`ComboboxPopup`，如反馈表单选歌），也可以 inline 放进别的浮层（如首页筛选）。能自由输入文字的搜索框才用 Autocomplete。
  - 浮层的进出场只用 CSS 过渡（`data-starting-style` / `data-ending-style`，缓动 `ease-page`），不用 framer-motion：底部面板拖动时的位移由 Base UI 写进 `transform`，JS 动画会和它抢。
- 右下角浮动按钮：只用竖向胶囊 `FloatingActionButtons`，不另加圆形按钮。胶囊用页面底色（`/95`）加细描边和阴影，不做毛玻璃。播放条开关在最下面，跳转按钮在它上方伸缩。
- 强调某个对象的说明条，从顶栏下沿展开（参考 `ImageryCaption`），不另起弹窗。

### 空状态与提示

- 一句楷体灰字（`font-kaiti text-slate-400`），不配插图，不配大图标。

## 六、动效

- 缓动统一 `[0.23, 1, 0.32, 1]`。界面反馈 200–400ms，内容出现 500–700ms，氛围性的变化（取色铺底）1000–1400ms。
- 展开与收起：framer-motion `AnimatePresence` 做 `height: 0 → auto`，或用 CSS `grid-rows-[0fr] → [1fr]`。
- 不做弹跳、旋转入场、视差这类表演性动画。

## 七、响应式与交互

- 断点只用 `md`（768）与 `lg`（1024）。旁注、悬停操作、左栏都只在 `lg` 以上出现。
- 窄屏没有悬停：先点一下选中，在下方展开操作栏，再选操作。
- 顶栏放不下的操作传给 `TopBar` 的 `actions`，窄屏自动收进「更多」，不要挤窄图标间距。
- 窄屏横向不能出现滚动条：长串文字加 `wrap-break-word`，flex 子项加 `min-w-0`。

## 八、文案

- 用书籍和评点的术语：卷首、正文、创作手记、评点（对整首）、批注（对字句）、夹批、私批、版记、呈评、同有此意。
- 短，不用感叹号，不用 emoji。
- 所有文案都进 `messages/zh-CN` 与 `messages/zh-TW`，两边同步加。

## 九、技术约束（踩过的坑）

- 带 `backdrop-filter` 的元素（如顶栏）会把其中的 `fixed` 子元素困在自己里面。`ui/` 的浮层封装都挂到 `TopBar` 旁边的挂载点（`ui/overlay-host.ts`），不挂 `body`，否则拿不到页面根容器上的 `--tone`。
- 层级只用下面这几档，不要另起数值。页面外面那层容器（`app/[locale]/layout.tsx`）不能带 z-index，否则自成层级上下文，里面的浮层再高也压不过外面的播放条：

| 层 | z | 用在哪里 |
| --- | --- | --- |
| 页内 | 0–30 | 内容自己的叠放 |
| 吸顶栏 | 40 | 首页筛选栏、后台工具栏 |
| 常驻外框 | 50 | 顶栏、播放条、浮动按钮、全屏加载页 |
| 浮层 | 60 | `components/ui/` 的全部浮层、图片查看器、悬停提示 |
| 提示条 | 70 | 操作结果提示，要压在弹窗上面 |
| 特例 | 100 | 故事页的沉浸遮罩 |

- 模态浮层一定要放 `Backdrop`，不想要遮罩就做成透明的。Base UI 模态时只把点在遮罩上算作「点外面」；不放的话它自己垫的那层没有 z-index，页面里带层级的元素会压在上面，点下去既不收起浮层，还会点到后面的东西。
- iOS 26 的 Safari 拿贴着屏幕上下沿的 `fixed` 元素给状态栏、底栏涂一整块纯色，不会过渡，压暗的页面和它总接不齐。所以窄屏的模态浮层一律做成底部面板（底栏取面板的颜色，遮罩避开顶栏），带压暗的居中弹窗只在宽屏用；规则见 `ui/browser-chrome.tsx`，新写贴边的 `fixed` 元素前先看那里的说明。
- 滚动条的位置由 `html` 上的 `scrollbar-gutter: stable` 留出。Base UI 锁滚动时不会再补右边距，所以浮层打开时页面不抖；不要换回会补边距的库（Radix、vaul）。
- 服务端和客户端渲染出的结果必须一致：依赖运行环境的计算（如 `Intl.Segmenter` 分词）放到服务端，算好再作为 props 传下去；只在客户端才有的状态用 `useSyncExternalStore` 判断是否已挂载。
- Tailwind v4 的 `scale-*`、`rotate-*`、`translate-*` 用的是独立的 CSS 属性，不会与内联的 `transform` 合并。需要由 JS 控制的变换，直接写内联 `style.transform`。
- Safari 查找着重号字形时，不会去下载按字符分片的网页字体。用 `text-emphasis` 时，要按字体逐个 `document.fonts.load(…, "•")`（参考 `LyricsFolio`）。
- 在 iPhone 上调试：用局域网 IP 启动 dev（`next dev -H <IP>`），`src/proxy.ts` 在开发环境已放开 https 升级与 `eval`。

## 十、代码习惯

- 注释用中文，写「为什么」，不写「做了什么」。
- 重复出现的样式抽成常量或组件（`NAV_BUTTON_CLASS`、`SectionHeading`），不要复制粘贴长 className。
- 新的共享样式先找 `src/components/shared` 与 `src/components/detail` 里有没有现成的。

## 十一、迁移一个页面时的检查清单

1. 根容器用页面底色，并设好 `--tone`。
2. 顶栏用 `TopBar`，选对出口，常驻按钮按第四节的标准。
3. 每一节都是 `section` 加 `SectionHeading`，节距 `py-16 md:py-20`。
4. 去掉卡片、渐变、图标标题、彩色徽章；`blue-*` 换成 `--tone`。
5. 字体按第三节归位：人写的话用楷体，标题与作品名用衬线体。
6. 选中状态只改颜色；危险操作改成两步确认。
7. 窄屏检查：没有横向滚动，悬停操作有点按的替代方式，浮层是底部面板。
8. 深色模式逐项检查。
9. 在 Safari（iPhone）上看一遍。

## 参考实现

- 整体结构：`src/components/detail/SongDetailClient.tsx`
- 卷首与署名：`SongHero.tsx`
- 章节题头：`SectionHeading.tsx`
- 正文与旁注：`LyricsFolio.tsx`、`comments/CommentGutter.tsx`
- 文字列表：`SongColophon.tsx`
- 作品卡：`src/components/shared/WorkCard.tsx`（主页图录与「同有此意」共用，不另写）
- 竖排摘句：`src/components/shared/VerticalExcerpt.tsx`
- 主页：结构、灯与展室见 `DESIGN-HOME.md`，原型在 `src/components/lab/HomeProto.tsx`
- 顶栏：`src/components/shared/topbar/TopBar.tsx`；目录跳转与阅读进度：`SectionNav.tsx`
- 浮动按钮：`src/components/shared/FloatingActionButtons.tsx`
- 取色：`src/lib/utils/utils-tone.ts`
