-- 普通用户的写操作统一经服务端接口、用 service 连接执行（与 comments、users 同一做法）：
--   collections     收藏 / 取消收藏      /api/public/collections
--   comment_likes   赞 / 取消赞          /api/public/comments/[id]/like（能不能赞在接口里查）
--   quiz_results    保存 / 删除测验结果  /api/public/quiz-results（结果在服务端重算）
--   user_requests   提交反馈与申请       /api/public/requests（长度、重复申请在接口里查）
--
-- 收回 authenticated 的写权限、删掉对应策略，拿着用户令牌直连 PostgREST 写不进去。
-- 读自己数据的 SELECT 策略保留。user_requests 的 UPDATE 留给管理员回复（按 JWT 里的
-- is_admin / is_super 判断）。
--
-- 需要先上线「这几个接口改用 service 连接」的那版代码，否则旧代码写入会被拒。

-- 收藏
drop policy if exists "Enable users to insert their own data only" on public.collections;
drop policy if exists "Enable users to update their own data only" on public.collections;
drop policy if exists "Enable users to delete their own data only" on public.collections;
revoke insert, update, delete, truncate, references, trigger
  on table public.collections from authenticated;

-- 点赞
drop policy if exists "comment_likes_insert" on public.comment_likes;
drop policy if exists "comment_likes_delete" on public.comment_likes;
revoke insert, delete, truncate, references, trigger
  on table public.comment_likes from authenticated;
revoke all on table public.comment_likes from anon;

-- 测验结果
drop policy if exists "quiz_results_insert_own" on public.quiz_results;
drop policy if exists "quiz_results_delete_own" on public.quiz_results;
revoke insert, delete, truncate, references, trigger
  on table public.quiz_results from authenticated;
revoke all on table public.quiz_results from anon;

-- 反馈与申请
drop policy if exists "Users can create their own requests" on public.user_requests;
revoke insert, delete, truncate, references, trigger
  on table public.user_requests from authenticated;
