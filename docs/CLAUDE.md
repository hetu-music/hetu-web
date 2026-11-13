@AGENTS.md

改动公开页面的界面前，先读 `DESIGN.md`（全站设计语言，以歌曲详情页为样板）。

读写歌曲表（`temp` / `music`）或新增挂在歌上的数据前，先读 `SONGS.md`（暂存表与正式表的分工、谁读谁写、外键挂哪张）。

改动意象数据、分类或标注逻辑前，先读 `IMAGERY.md`（标注规范与母题体系）。

改动曲库页（首页）的渲染、筛选或搜索前，先读 `LIBRARY.md`（重构方案、问题清单与待讨论事项）。

改动接口的缓存头、页面的 `revalidate`、`unstable_cache`、Service Worker 的缓存规则或 CDN 上的规则前，先读 `CACHE.md`（各层缓存、哪些接口缓存、Cloudflare 规则与待办）。
