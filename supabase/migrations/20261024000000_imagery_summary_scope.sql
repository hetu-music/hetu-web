-- ════════════════════════════════════════════════════════════════════════════
-- 意象汇总按用途拆成两个视图，并删掉已经没有标注的词
--
--   imagery_summary      公开意象页用：只列在曲库歌曲里出现过的词，次数只算曲库
--                        （原来 LEFT JOIN，只出现在争议歌曲里的词、没有标注的词也会以 0 次列出）
--   imagery_summary_all  后台用：列全部词，次数算全部已发布的歌（含争议歌曲），没有标注的为 0
--
-- 层次：music → music_catalog（去掉争议歌曲）
--       imagery_occurrences → imagery_occurrences_catalog（只留曲库歌曲的标注）→ imagery_summary
--       imagery_occurrences → imagery_summary_all
--
-- 部署：执行本文件后紧接着部署代码（后台改读 imagery_summary_all）。
-- 两者之间后台的词典里暂时看不到那些只在争议歌曲里出现的词。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 1. 公开：LEFT JOIN 改成 JOIN。列不变，原地替换，授权与选项保留
create or replace view public.imagery_summary as
select i.id,
       i.name,
       count(o.id)::integer as count,
       coalesce(
         array_agg(distinct o.category_id) filter (where o.category_id is not null),
         '{}'::bigint[]
       ) as "categoryIds"
  from public.imagery i
  join public.imagery_occurrences_catalog o on i.id = o.imagery_id
 group by i.id, i.name;

-- 2. 后台：全部词，次数含争议歌曲
create view public.imagery_summary_all as
select i.id,
       i.name,
       count(o.id)::integer as count,
       coalesce(
         array_agg(distinct o.category_id) filter (where o.category_id is not null),
         '{}'::bigint[]
       ) as "categoryIds"
  from public.imagery i
  left join public.imagery_occurrences o on i.id = o.imagery_id
 group by i.id, i.name;

-- 与 imagery_summary 一致：只给服务端密钥读，匿名与登录用户都读不到
revoke all on public.imagery_summary_all from anon, authenticated;
grant select on public.imagery_summary_all to service_role;

-- 3. 删掉已经没有任何标注的词（2026-10 整批重标后不再用到的旧词，如人、天、心、电光石火）
--    imagery_motifs 对 imagery 是级联删除，母题登记随之删掉
delete from public.imagery i
 where not exists (
   select 1 from public.imagery_occurrences o where o.imagery_id = i.id
 );

commit;
