-- ════════════════════════════════════════════════════════════════════════════
-- 评点：歌曲详情页的批注
--
-- 顶层批注挂在页面上的某个位置（anchor）：
--   song   总评，挂在整首歌上
--   notes  创作手记的某一段
--   lyrics 某一句歌词
--   score  乐谱
-- 回复只允许一层，没有自己的位置，跟随所回复的批注显示，且总是公开。
--
-- 位置不能只记序号：歌词或手记一经修改，序号就会错位。
-- 这里同时记下原文（anchor_quote）与歌词时间戳（anchor_time），
-- 前端先按原文找回那一句，重复的句子再用时间戳取最近的一处；
-- 原文找不到时降级为总评，并连同当时引用的原文一起显示。
-- ════════════════════════════════════════════════════════════════════════════

create table public.comments (
  id           bigint generated always as identity primary key,
  song_id      bigint not null references public.music (id) on delete cascade,
  user_id      uuid   not null references public.users (id) on delete cascade,
  parent_id    bigint references public.comments (id) on delete cascade,

  anchor       text,
  anchor_index integer,        -- 段落或行的序号，仅作重新定位时的参考
  anchor_time  numeric(8, 3),  -- 歌词时间戳（秒），区分重复的副歌
  anchor_quote text,           -- 被批的原文

  body         text     not null,
  visibility   smallint not null default 0,  -- 0 公开，1 仅自己可见（私批）
  status       smallint not null default 0,  -- 0 正常，1 待审，2 隐藏，3 已删
  like_count   integer  not null default 0,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,

  constraint comments_anchor_check
    check (anchor in ('song', 'notes', 'lyrics', 'score')),
  -- 顶层批注必须有位置；回复没有位置，且总是公开
  constraint comments_reply_shape check (
    (parent_id is null and anchor is not null)
    or (
      parent_id is not null
      and anchor is null
      and anchor_index is null
      and anchor_time is null
      and anchor_quote is null
      and visibility = 0
    )
  ),
  -- 已删的批注清空内容，只为留住下面的回复
  constraint comments_body_length
    check (status = 3 or char_length(body) between 1 and 1000),
  constraint comments_quote_length check (char_length(anchor_quote) <= 200),
  constraint comments_visibility_check check (visibility in (0, 1)),
  constraint comments_status_check check (status in (0, 1, 2, 3))
);

create index comments_song_idx on public.comments (song_id, created_at);
create index comments_parent_idx on public.comments (parent_id)
  where parent_id is not null;
create index comments_user_idx on public.comments (user_id, created_at desc);

-- 回复只能挂在同一首歌、公开且正常的顶层批注下
create function public.comments_check_reply()
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
     or p.visibility <> 0
     or p.status <> 0 then
    raise exception 'invalid parent comment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger comments_check_reply
  before insert on public.comments
  for each row execute function public.comments_check_reply();

-- ─── 点赞 ────────────────────────────────────────────────────────────────────

create table public.comment_likes (
  comment_id bigint not null references public.comments (id) on delete cascade,
  user_id    uuid   not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_user_idx on public.comment_likes (user_id);

-- like_count 由触发器维护；用户没有 comments 的 update 权限，只能经由这里改
create function public.comment_likes_sync_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
      set like_count = like_count + 1
      where id = new.comment_id;
  else
    update public.comments
      set like_count = greatest(like_count - 1, 0)
      where id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_sync_count
  after insert or delete on public.comment_likes
  for each row execute function public.comment_likes_sync_count();

-- ─── 行级权限 ────────────────────────────────────────────────────────────────
--
-- 读取走服务端（需要一并取作者名），这里的 select 策略是兜底：
-- 公开且正常的人人可见，自己的（含私批、待审）自己可见。
-- 写入只开放 insert；编辑与删除走下面的函数，不开放直接 update/delete。

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

create policy comments_select on public.comments
  for select
  using (
    (status = 0 and visibility = 0)
    or (user_id = auth.uid() and status in (0, 1))
  );

-- 新批注的状态目前直接为 0；以后启用先审后发时改为 1 即可
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 0
    and like_count = 0
    and edited_at is null
  );

create policy comment_likes_select on public.comment_likes
  for select to authenticated
  using (user_id = auth.uid());

create policy comment_likes_insert on public.comment_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comments c
      where c.id = comment_id and c.status = 0 and c.visibility = 0
    )
  );

create policy comment_likes_delete on public.comment_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ─── 编辑与删除 ──────────────────────────────────────────────────────────────

create function public.edit_comment(p_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
    set body = p_body, edited_at = now()
    where id = p_id and user_id = auth.uid() and status in (0, 1);
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end;
$$;

-- 有回复的批注只清空内容、标为已删，好让回复有所依附；
-- 没有回复的直接删除。删掉最后一条回复时，已删的父批注一并清理。
create function public.delete_comment(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.comments;
begin
  select * into c from public.comments
    where id = p_id and user_id = auth.uid() and status <> 3;
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.comments where parent_id = p_id) then
    update public.comments
      set status = 3, body = '', edited_at = now()
      where id = p_id;
  else
    delete from public.comments where id = p_id;
    if c.parent_id is not null then
      delete from public.comments p
        where p.id = c.parent_id
          and p.status = 3
          and not exists (
            select 1 from public.comments r where r.parent_id = p.id
          );
    end if;
  end if;
end;
$$;

revoke all on function public.edit_comment(bigint, text) from public, anon;
revoke all on function public.delete_comment(bigint) from public, anon;
grant execute on function public.edit_comment(bigint, text) to authenticated;
grant execute on function public.delete_comment(bigint) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 旧的私人评论（collections.review）由私批取代。
-- 线上旧代码还在读这一列，务必在新代码部署之后再单独执行：
--
--   alter table public.collections drop column review;
-- ════════════════════════════════════════════════════════════════════════════
