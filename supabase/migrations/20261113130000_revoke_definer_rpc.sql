-- 收回三个 SECURITY DEFINER 函数对 anon / authenticated 的执行权限。
--
-- SECURITY DEFINER 以属主身份执行、不受 RLS 约束，public schema 里的函数又都经
-- PostgREST 暴露在 /rest/v1/rpc/ 下，所以拿着前端公开的 anon key 就能调：
--   approve_music_sync(temp_id)  把任意一首 temp 里未审批的改动推上正式表
--   sync_music_from_temp()       把整张 temp 镜像到 music（含删除）
--   claim_stream_grant(...)      替任意用户登记取流，把别人的额度刷满
-- 三个函数都只由服务端用 service role 调用（admin-actions、navidrome/stream-url），
-- 每日同步的 cron 以 postgres 身份执行，都不受影响。

revoke execute on function public.approve_music_sync(bigint) from public, anon, authenticated;
revoke execute on function public.sync_music_from_temp() from public, anon, authenticated;
revoke execute on function public.claim_stream_grant(uuid, integer, integer, integer) from public, anon, authenticated;

-- 以后新建的函数不再默认给 anon / authenticated 执行权限，需要的在 migration 里显式 grant
-- （与表的做法一致，见 20261113120700_cleanup.sql）。已有函数的权限不变。
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
