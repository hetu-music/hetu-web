-- users 只能经服务端接口修改：本人改名字和简介走 /api/auth/account，管理员改他人走
-- /api/admin/users，都用 service 连接。原来本人可以拿令牌直连 PostgREST 改自己整行，
-- 绕过接口把 display 打开、改 sort_order，挂到「关于」页的维护团队里。
--
-- 收回 authenticated 的写权限、删掉两条更新策略，保留读自己资料的 SELECT。
-- prevent_role_tampering、users_guard_can_stream 两个触发器留作兜底。
--
-- 需要先上线「/api/auth/account 改用 service 连接」的那版代码，否则旧代码改资料会被拒。

drop policy if exists "Enable users to update their own data" on public.users;
drop policy if exists "Enable super admins to update any user roles" on public.users;

revoke insert, update, delete, truncate, references, trigger
  on table public.users from authenticated;
