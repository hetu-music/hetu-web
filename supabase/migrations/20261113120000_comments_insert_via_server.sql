-- 评论只能经 /api/public/comments 写入：接口里有每分钟限流和内容校验，用 service 连接插入。
-- 收回 authenticated 的插入权限、删掉对应策略，拿着用户令牌直连 PostgREST 插不进来。
--
-- 需要先上线「接口改用 service 连接」的那版代码，否则旧代码发评论会被拒。

drop policy if exists "comments_insert" on public.comments;

revoke insert on table public.comments from authenticated;
