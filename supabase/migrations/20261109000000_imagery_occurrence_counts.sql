-- ════════════════════════════════════════════════════════════════════════════
-- 后台首页、歌曲列表要「每首歌有几条意象标注」。
--
-- 原来把 imagery_occurrences 的 song_id 整列读回来在服务端计数：一万多行、PostgREST
-- 每次最多一千行，要串行翻十几页，进后台光这一步就要好几秒。项目没开 PostgREST 的聚合
-- 函数，这里用一个函数在库里 group by，一次往返拿回几百行。
--
-- 只给 service_role（服务端 getServiceClient 调用）；本项目新对象不会自动授权。
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.imagery_occurrence_counts()
returns table (song_id bigint, n bigint)
language sql
stable
set search_path = ''
as $$
  select o.song_id::bigint, count(*)::bigint
  from public.imagery_occurrences o
  group by o.song_id
$$;

revoke all on function public.imagery_occurrence_counts() from public, anon, authenticated;
grant execute on function public.imagery_occurrence_counts() to service_role;
