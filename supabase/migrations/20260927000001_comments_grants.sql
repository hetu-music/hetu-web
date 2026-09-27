-- ════════════════════════════════════════════════════════════════════════════
-- 评点：表级授权
--
-- 本项目新建的表不会自动授权给各角色（与已有各表一致：anon 一律无权限），
-- 需要逐一授予；行级的可见与可写范围仍由 RLS 与数据库函数把关。
--
--   service_role  服务端读取批注、作者名与点赞（绕过 RLS）
--   authenticated 用户会话：写批注、查自己一分钟内的条数（限流）、赞与取消赞
--
-- 标识列（generated always as identity）取号不需要序列权限。
-- ════════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.comment_likes to service_role;

grant select, insert on public.comments to authenticated;
grant select, insert, delete on public.comment_likes to authenticated;
