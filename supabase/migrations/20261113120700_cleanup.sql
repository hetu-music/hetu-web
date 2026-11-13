-- 清理：不再使用的表、多余的权限、用不到的策略和扩展，补几个外键索引。

-- 1. 不再使用的表 ────────────────────────────────────────────────────────────
--   test                  开发时复制的 temp，代码里没有引用
--   imagery_category_map  旧的意象→分类映射，2026-10 起改由 imagery_motifs 记录
drop table public.test;
drop table public.imagery_category_map;

-- 2. 多余的权限 ──────────────────────────────────────────────────────────────
-- anon / authenticated 只经 PostgREST 访问，用不到 TRUNCATE、TRIGGER、REFERENCES。
-- 表上的 identity 列取号不需要序列权限，序列上的权限一并收回。
-- 默认权限也改掉，以后新建的表和序列不再自动带上这些。
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- 3. 用不到的策略 ────────────────────────────────────────────────────────────
-- audit_logs 只由后台用 service 连接读；authenticated 在这张表上本就没有权限，
-- 这条按写死的用户 id 放行的策略不会生效
drop policy if exists "Enable read access for root" on public.audit_logs;

-- 4. 外键索引 ────────────────────────────────────────────────────────────────
-- 按意象、按母题查标注，删歌时按 song_id 级联删收藏
create index if not exists imagery_occurrences_imagery_id on public.imagery_occurrences (imagery_id);
create index if not exists imagery_occurrences_category_id on public.imagery_occurrences (category_id);
create index if not exists collections_song_id on public.collections (song_id);

-- 5. 用不到的扩展 ────────────────────────────────────────────────────────────
-- 代码不用 GraphQL；停掉后 /graphql/v1 不再对外提供
drop extension if exists pg_graphql;
