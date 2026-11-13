@AGENTS.md

改动公开页面的界面前，先读 `DESIGN.md`（全站设计语言，以歌曲详情页为样板）。

新建表、改表结构或新增挂在别的数据上的表前，先读 `DATABASE.md`（设计原则、目标结构、迁移计划）。迁移完成前，读写歌曲表（`temp` / `music`）的现行规则见 `SONGS.md`。

改动意象数据、分类或标注逻辑前，先读 `IMAGERY.md`（标注规范与母题体系）。

改动曲库页（首页）的渲染、筛选或搜索前，先读 `LIBRARY.md`（重构方案、问题清单与待讨论事项）。

改动接口的缓存头、页面的 `revalidate`、`unstable_cache`、Service Worker 的缓存规则或 CDN 上的规则前，先读 `CACHE.md`（各层缓存、哪些接口缓存、Cloudflare 规则与待办）。
