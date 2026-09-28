-- ════════════════════════════════════════════════════════════════════════════
-- 曲库口径：「计入曲库的歌」只在这里定义一次。
--
--   music                        全部已发布的歌：详情页、收藏、纠错选歌、后台
--   music_catalog                计入曲库的歌：意象统计、同有此意、寻曲
--   imagery_occurrences_catalog  只含 music_catalog 歌曲的意象出处
--   imagery_summary              意象词云的次数，改为基于上面的视图计数
--
-- 目前的规则是「资料无争议」（dispute_note 为空）。规则要变，只改 music_catalog。
-- 依赖 20260928010000_dispute_note.sql 先执行。
-- ════════════════════════════════════════════════════════════════════════════

-- select * 在建视图时展开成固定列：以后给 music 加列，需要重建这个视图才会带上
create view public.music_catalog
with (security_invoker = true) as
  select * from public.music
  where dispute_note is null;

create view public.imagery_occurrences_catalog
with (security_invoker = true) as
  select o.*
  from public.imagery_occurrences o
  join public.music_catalog m on m.id = o.song_id;

-- 列与原定义完全一致，只把 imagery_occurrences 换成 _catalog；原有授权保留
create or replace view public.imagery_summary as
  select i.id,
    i.name,
    count(o.id)::integer as count,
    coalesce(
      array_agg(distinct o.category_id) filter (where o.category_id is not null),
      '{}'::bigint[]
    ) as "categoryIds"
  from public.imagery i
    left join public.imagery_occurrences_catalog o on i.id = o.imagery_id
  group by i.id, i.name;

-- 新对象不会自动授权（anon 对现有表也没有权限，这里保持一致）
grant select on public.music_catalog to service_role;
grant select on public.imagery_occurrences_catalog to service_role;
