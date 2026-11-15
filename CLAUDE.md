@AGENTS.md

改动公开页面的界面前，先读 `docs/DESIGN.md`（全站设计语言，以歌曲详情页为样板）。

新建表、改表结构或新增挂在别的数据上的表前，先读 `docs/DATABASE.md`（设计原则、结构、约定与改表流程）。完整的表结构看 `supabase/schema.sql`。

改动意象数据、分类或标注逻辑前，先读 `docs/IMAGERY.md`（标注规范与母题体系）。

改动曲库页（首页）的渲染、筛选或搜索前，先读 `docs/LIBRARY.md`（加载方式、地址栏格式、筛选与搜索）。

改动接口的缓存头、页面的 `revalidate`、`unstable_cache`、Service Worker 的缓存规则或 CDN 上的规则前，先读 `docs/CACHE.md`（各层缓存、哪些接口缓存、Cloudflare 规则）。

改 `/quiz` 的题目、选项文案或标注前，先读 `docs/QUIZ.md`（出题约束与题目蓝图）。
