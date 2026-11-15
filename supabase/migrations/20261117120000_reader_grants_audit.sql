-- 第三段：小项（见 docs/DATABASE.md 第六节、第八节、第九节「第三段」）
--
-- 1. 读者表的用户外键统一指 public.users：collections、user_requests、quiz_results。
-- 2. collections 去掉 uuid 主键，主键改为 (user_id, song_id)。
-- 3. comments 的 status、visibility 由数字改为文本：normal / pending / hidden / deleted、public / private。
-- 4. stream_grants.song_id 改 bigint，加外键指 songs；claim_stream_grant 的参数跟着改。
-- 5. user_requests 的 varchar 改 text。quiz_results.song_ids 是快照，不加外键，写进列注释。
-- 6. 表上的权限：anon、authenticated 全部收回，再逐表写明（第一、二段已写明的也在这里重写一遍，
--    这里是唯一的清单）。默认权限一并收回，以后新建的表不再自动带权限。
-- 7. 审计触发器补到 imagery_motifs、emotions、credit_aliases。

-- ════════════════════════════════════════════════════════════════════════════
-- 前提检查：任何一条不满足就停下，整个迁移回滚
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  n bigint;
begin
  select count(*) into n from (
    select user_id from public.collections
    union all select user_id from public.user_requests
    union all select user_id from public.quiz_results
  ) r
  where not exists (select 1 from public.users u where u.id = r.user_id);
  if n > 0 then
    raise exception '有 % 行读者数据的 user_id 在 users 里找不到', n;
  end if;

  select count(*) into n from public.stream_grants g
  where not exists (select 1 from public.songs s where s.id = g.song_id);
  if n > 0 then
    raise exception '有 % 行 stream_grants 的 song_id 在 songs 里找不到', n;
  end if;

  select count(*) into n from public.comments
  where status not in (0, 1, 2, 3) or visibility not in (0, 1);
  if n > 0 then
    raise exception '有 % 条评论的 status / visibility 不认识', n;
  end if;
end;
$$;

create temp table phase3_counts on commit drop as
select
  (select count(*) from public.collections) as collections,
  (select count(*) from public.comments) as comments,
  (select count(*) from public.comments where status = 0 and visibility = 0) as comments_public,
  (select count(*) from public.comments where status = 3) as comments_deleted,
  (select count(*) from public.user_requests) as user_requests,
  (select count(*) from public.quiz_results) as quiz_results,
  (select count(*) from public.stream_grants) as stream_grants;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. 用户外键
-- ════════════════════════════════════════════════════════════════════════════
-- public.users 跟着 auth.users 级联删除，读者数据再跟着 public.users 删

alter table public.collections drop constraint collections_user_id_fkey;
alter table public.collections
  add constraint collections_user_id_fkey foreign key (user_id)
  references public.users (id) on delete cascade;

alter table public.user_requests drop constraint user_requests_user_id_fkey;
alter table public.user_requests
  add constraint user_requests_user_id_fkey foreign key (user_id)
  references public.users (id) on delete cascade;

alter table public.quiz_results drop constraint quiz_results_user_id_fkey;
alter table public.quiz_results
  add constraint quiz_results_user_id_fkey foreign key (user_id)
  references public.users (id) on delete cascade;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. collections 的主键
-- ════════════════════════════════════════════════════════════════════════════

alter table public.collections drop constraint collections_pkey;
alter table public.collections drop constraint collections_user_song_key;
alter table public.collections drop column id;
alter table public.collections add primary key (user_id, song_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. comments 的文本枚举
-- ════════════════════════════════════════════════════════════════════════════
-- 用到这两列的策略、约束先拿掉，改完类型再按文本值建回来

drop policy comments_select on public.comments;
alter table public.comments
  drop constraint comments_body_length,
  drop constraint comments_reply_shape,
  drop constraint comments_status_check,
  drop constraint comments_visibility_check;

alter table public.comments
  alter column status drop default,
  alter column visibility drop default;
alter table public.comments
  alter column status type text using (
    case status when 0 then 'normal' when 1 then 'pending' when 2 then 'hidden' when 3 then 'deleted' end
  ),
  alter column visibility type text using (
    case visibility when 0 then 'public' when 1 then 'private' end
  );
alter table public.comments
  alter column status set default 'normal',
  alter column visibility set default 'public';

alter table public.comments
  add constraint comments_status_check
    check (status in ('normal', 'pending', 'hidden', 'deleted')),
  add constraint comments_visibility_check
    check (visibility in ('public', 'private')),
  add constraint comments_body_length
    check (status = 'deleted' or char_length(body) between 1 and 1000),
  add constraint comments_reply_shape
    check (
      (parent_id is null and anchor is not null)
      or (parent_id is not null and anchor is null and anchor_index is null
          and anchor_time is null and anchor_quote is null and visibility = 'public')
    );

comment on column public.comments.status is
  'normal 正常；pending 待审（只有作者看得到）；hidden 被管理员隐藏；deleted 作者删了但还有回复，内容已清空，留作占位';
comment on column public.comments.visibility is 'public 公开；private 只有作者看得到。回复一律 public';

create policy comments_select on public.comments
  for select to authenticated
  using (
    (status = 'normal' and visibility = 'public')
    or (user_id = (select auth.uid()) and status in ('normal', 'pending'))
  );

create or replace function public.comments_check_reply()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into p from public.comments where id = new.parent_id;
  if not found
     or p.parent_id is not null
     or p.song_id <> new.song_id
     or p.visibility <> 'public'
     or p.status <> 'normal' then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.edit_comment(p_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
    set body = p_body, edited_at = now()
    where id = p_id and user_id = auth.uid() and status in ('normal', 'pending');
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_comment(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.comments;
begin
  select * into c from public.comments
    where id = p_id and user_id = auth.uid() and status <> 'deleted';
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.comments where parent_id = p_id) then
    update public.comments
      set status = 'deleted', body = '', edited_at = now()
      where id = p_id;
  else
    delete from public.comments where id = p_id;
    if c.parent_id is not null then
      delete from public.comments p
        where p.id = c.parent_id
          and p.status = 'deleted'
          and not exists (
            select 1 from public.comments r where r.parent_id = p.id
          );
    end if;
  end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. stream_grants.song_id
-- ════════════════════════════════════════════════════════════════════════════

alter table public.stream_grants alter column song_id type bigint;
alter table public.stream_grants
  add constraint stream_grants_song_id_fkey foreign key (song_id)
  references public.songs (id) on delete cascade;
create index stream_grants_song_id on public.stream_grants (song_id);

-- 参数类型变了，只能删了重建
drop function public.claim_stream_grant(uuid, integer, integer, integer);
create function public.claim_stream_grant(
  p_user_id uuid, p_song_id bigint, p_hour_limit integer, p_day_limit integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from stream_grants
    where user_id = p_user_id and song_id = p_song_id
      and issued_at > now() - interval '1 hour'
  ) and (
    select count(distinct song_id) from stream_grants
    where user_id = p_user_id and issued_at > now() - interval '1 hour'
  ) >= p_hour_limit then
    return 'hour';
  end if;

  if not exists (
    select 1 from stream_grants
    where user_id = p_user_id and song_id = p_song_id
      and issued_at > now() - interval '1 day'
  ) and (
    select count(distinct song_id) from stream_grants
    where user_id = p_user_id and issued_at > now() - interval '1 day'
  ) >= p_day_limit then
    return 'day';
  end if;

  insert into stream_grants (user_id, song_id) values (p_user_id, p_song_id);

  delete from stream_grants
  where user_id = p_user_id and issued_at < now() - interval '7 days';

  return 'ok';
end;
$$;
revoke all on function public.claim_stream_grant(uuid, bigint, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_stream_grant(uuid, bigint, integer, integer) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. user_requests、quiz_results
-- ════════════════════════════════════════════════════════════════════════════
-- 策略与约束用到了 type、status，先拿掉，改完类型再建回来

drop policy user_requests_select on public.user_requests;
drop policy user_requests_update on public.user_requests;
alter table public.user_requests
  drop constraint chk_request_status,
  drop constraint chk_request_type;

alter table public.user_requests alter column status drop default;
alter table public.user_requests
  alter column type type text,
  alter column category type text,
  alter column status type text;
alter table public.user_requests alter column status set default 'pending';

alter table public.user_requests
  add constraint user_requests_type_check
    check (type in ('song_feedback', 'benefit_apply', 'admin_apply')),
  add constraint user_requests_status_check
    check (status in ('pending', 'replied', 'approved', 'rejected'));

create policy user_requests_select on public.user_requests
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or ((select public.jwt_role()) = 'admin' and type = 'song_feedback')
    or (select public.jwt_role()) = 'super'
  );
create policy user_requests_update on public.user_requests
  for update to authenticated
  using (
    ((select public.jwt_role()) = 'admin' and type = 'song_feedback')
    or (select public.jwt_role()) = 'super'
  )
  with check (type = 'song_feedback' or (select public.jwt_role()) = 'super');

comment on column public.quiz_results.song_ids is
  '测验结果的快照：当时推荐的歌。不加外键，歌改了、删了也照原样保留';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. 权限
-- ════════════════════════════════════════════════════════════════════════════
-- 公开端用 service role 读；后台与 agent 用本人的 JWT（authenticated），经 RLS；
-- 普通用户的写入经服务端接口，用 service role。anon 什么都没有。
-- 只放开代码里用本人 JWT 做的事；有 RLS 策略但没有授权的，策略一并删掉。

revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- 歌曲与编校（第一段）。草稿只能改资料列；新建、开草稿、发布、删除都经函数
grant select on public.songs, public.song_audio, public.song_versions,
  public.song_collation_revisers,
  public.published_songs, public.catalog, public.working_songs,
  public.published_song_imagery, public.published_song_emotions,
  public.working_song_imagery, public.imagery_summary_all
  to authenticated;
grant update (
  title, date, album, track, tracktotal, discnumber, disctotal,
  artist, lyricist, composer, arranger, albumartist, genre, type, length,
  lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status
) on public.song_versions to authenticated;
grant select, insert, update, delete on public.song_links, public.song_emotions to authenticated;
grant select, delete on public.song_imagery to authenticated;
grant insert (version_id, imagery_id, motif_id), update (imagery_id, motif_id)
  on public.song_imagery to authenticated;
-- 校者、订者由触发器按会话写，不让客户端填
grant select, delete on public.song_collations to authenticated;
grant insert (version_id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body, date),
  update (anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body, date)
  on public.song_collations to authenticated;

-- 意象体系（第二段）。类别固定，只读；词不删
grant select on public.imagery_categories to authenticated;
grant select, insert, update, delete on public.motifs, public.imagery_motifs to authenticated;
grant select, insert, update on public.imagery to authenticated;

-- 署名别名：后台增删
grant select, insert, update, delete on public.credit_aliases to authenticated;

-- 读者数据：本人的读走 RLS；写都经服务端接口
grant select on public.users, public.collections, public.comments, public.quiz_results
  to authenticated;
-- 用户请求：管理员回复
grant select on public.user_requests to authenticated;
grant update (reply, status, replied_by, replied_at, updated_at)
  on public.user_requests to authenticated;

-- 没有授权、策略也就用不上：赞只经服务端写读；基调词表由服务端读写
drop policy comment_likes_select on public.comment_likes;
drop policy emotions_admin on public.emotions;

-- 评论的两个函数要登录才有意义
revoke execute on function public.edit_comment(bigint, text) from anon;
revoke execute on function public.delete_comment(bigint) from anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. 审计
-- ════════════════════════════════════════════════════════════════════════════

create trigger imagery_motifs_audit
  after insert or update or delete on public.imagery_motifs
  for each row execute function public.record_audit_log();
create trigger emotions_audit
  after insert or update or delete on public.emotions
  for each row execute function public.record_audit_log();
create trigger credit_aliases_audit
  after insert or update or delete on public.credit_aliases
  for each row execute function public.record_audit_log();

-- ════════════════════════════════════════════════════════════════════════════
-- 断言
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  c record;
  bad text;
begin
  select * into c from phase3_counts;
  if (select count(*) from public.collections) <> c.collections
     or (select count(*) from public.comments) <> c.comments
     or (select count(*) from public.comments where status = 'normal' and visibility = 'public') <> c.comments_public
     or (select count(*) from public.comments where status = 'deleted') <> c.comments_deleted
     or (select count(*) from public.user_requests) <> c.user_requests
     or (select count(*) from public.quiz_results) <> c.quiz_results
     or (select count(*) from public.stream_grants) <> c.stream_grants then
    raise exception '行数对不上';
  end if;

  -- anon 在 public 下的表、视图、列上没有任何权限
  select string_agg(distinct cl.relname, ', ') into bad
  from pg_class cl
  join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
  where cl.relkind in ('r', 'v', 'm', 'p')
    and (
      exists (select 1 from aclexplode(cl.relacl) a where a.grantee = 'anon'::regrole)
      or exists (
        select 1 from pg_attribute att, aclexplode(att.attacl) a
        where att.attrelid = cl.oid and a.grantee = 'anon'::regrole
      )
    );
  if bad is not null then
    raise exception 'anon 仍有权限：%', bad;
  end if;

  -- 每张表、视图 service_role 都能读
  select string_agg(cl.relname, ', ') into bad
  from pg_class cl
  join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
  where cl.relkind in ('r', 'v', 'm', 'p')
    and not has_table_privilege('service_role', cl.oid, 'select');
  if bad is not null then
    raise exception 'service_role 读不了：%', bad;
  end if;
end;
$$;
