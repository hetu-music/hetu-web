-- Supabase 性能检查（db advisors）：
--   auth_rls_initplan             策略里直接调 auth.jwt() / auth.uid() 会逐行重算；
--                                 包一层 (select ...) 后整条查询只算一次
--   multiple_permissive_policies  user_requests 同一动作有多条宽松策略，每条都要算；
--                                 合并成一条，放行范围不变
--
-- 前面几个迁移已删掉的策略（users 更新、各表插入、audit_logs、imagery_category_map）不在这里。

-- 管理员 / 超级管理员（JWT 里由 sync_user_claims_to_auth 同步的 app_metadata）
-- is_admin: ((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
-- is_super: ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true

-- 1. 「管理员或超级管理员」可读写的表 ───────────────────────────────────────

alter policy "Admins and supers can view" on public.imagery
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can insert" on public.imagery
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can update" on public.imagery
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

alter policy "Admins and supers can view" on public.imagery_categories
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can insert" on public.imagery_categories
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can update" on public.imagery_categories
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

alter policy "Admins and supers can view" on public.imagery_occurrences
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can insert" on public.imagery_occurrences
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can update" on public.imagery_occurrences
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

alter policy "Admins and supers can view" on public.temp
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can insert" on public.temp
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
alter policy "Admins and supers can update" on public.temp
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
           or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

alter policy "Admins and supers can view" on public.music
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

-- 2. 只限管理员的表 ──────────────────────────────────────────────────────────

alter policy "imagery_categories_admin_delete" on public.imagery_categories
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

alter policy "credit_aliases_admin" on public.credit_aliases
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

alter policy "emotions_admin" on public.emotions
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

alter policy "imagery_motifs_admin" on public.imagery_motifs
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

alter policy "song_collations_admin" on public.song_collations
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

alter policy "song_emotions_admin" on public.song_emotions
  using (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true);

-- 3. 用户读自己的数据 ────────────────────────────────────────────────────────

alter policy "Enable users and super admins to view data" on public.users
  using ((select auth.uid()) = id
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

alter policy "comments_select" on public.comments
  using ((status = 0 and visibility = 0)
      or (user_id = (select auth.uid()) and status in (0, 1)));

alter policy "comment_likes_select" on public.comment_likes
  using (user_id = (select auth.uid()));

-- 4. user_requests：多条宽松策略合并 ─────────────────────────────────────────
-- 读：本人的；管理员看歌曲纠错；超级管理员看全部
-- 改：管理员回复歌曲纠错（改完仍须是歌曲纠错）；超级管理员改全部

drop policy "Users can view their own requests" on public.user_requests;
drop policy "Admins can view song feedbacks" on public.user_requests;
drop policy "Super admins can view all requests" on public.user_requests;
create policy "user_requests_select" on public.user_requests
  for select to authenticated
  using (user_id = (select auth.uid())
      or (((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
          and type = 'song_feedback')
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);

drop policy "Admins can reply to song feedbacks" on public.user_requests;
drop policy "Super admins can update all requests" on public.user_requests;
create policy "user_requests_update" on public.user_requests
  for update to authenticated
  using ((((select auth.jwt()) -> 'app_metadata' ->> 'is_admin')::boolean is true
          and type = 'song_feedback')
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true)
  with check (type = 'song_feedback'
      or ((select auth.jwt()) -> 'app_metadata' ->> 'is_super')::boolean is true);
