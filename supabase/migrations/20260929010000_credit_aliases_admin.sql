-- ════════════════════════════════════════════════════════════════════════════
-- 署名别名：后台读写（管理员与超级管理员）
--
-- 后台以用户会话写入，由 RLS 按 JWT 的 app_metadata.is_admin 放行；
-- 超级管理员同样带 is_admin（见 server-auth 的 withAuth）。
-- 用户会话写入，审计触发器才能记下是谁改的。
-- 依赖 20260929000000_credit_aliases.sql 先执行。
-- ════════════════════════════════════════════════════════════════════════════

create policy credit_aliases_admin on public.credit_aliases
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

grant select, insert, update, delete on public.credit_aliases to authenticated;

-- 与 imagery、temp 一样记入 audit_logs：在 Database → Triggers 里照 imagery 表
-- 的审计触发器给 credit_aliases 加一条（after insert or update or delete, for each row）。
