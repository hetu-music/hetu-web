-- ════════════════════════════════════════════════════════════════════════════
-- 删掉公开意象页用的 imagery_summary 视图
--
-- 意象词云改成以母题为单位（见 IMAGERY.md），数据由 service-imagery-cloud 从
-- imagery_occurrences 与 music_catalog 直接聚合，不再读按词汇总的视图。
-- 后台词典用的 imagery_summary_all 保留；寻曲用的 imagery_occurrences_catalog 保留。
--
-- 不加 cascade：万一还有别的对象依赖它，宁可报错停下。
--
-- 部署：先部署代码（已不再读 imagery_summary），再执行本文件。
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop view if exists public.imagery_summary;

commit;
