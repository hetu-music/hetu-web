-- ════════════════════════════════════════════════════════════════════════════
-- 删掉代码里已经不读的两个意象视图
--
--   imagery_summary              旧意象页按词汇总（标注条数）。意象词云改成以母题为单位，
--                                由 service-imagery-cloud 按歌去重自己算，不再读它
--   imagery_occurrences_catalog  只含曲库歌曲的标注，原来只有寻曲候选池读。
--                                详情页、意象词云、寻曲现在共用一份意象索引（imagery-index），
--                                读 imagery_occurrences 全表，按 music_catalog 在代码里过滤
--
-- 保留：imagery_summary_all（后台词典）、music_catalog（多处在用）。
--
-- 先删 imagery_summary：它建在 imagery_occurrences_catalog 之上。
-- 不加 cascade：万一还有别的对象依赖它们，宁可报错停下。
--
-- 部署：先部署代码（已不再读这两个视图），再执行本文件。
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop view if exists public.imagery_summary;
drop view if exists public.imagery_occurrences_catalog;

commit;
