-- 第一段：歌曲、版本、编校与角色（设计见 docs/DATABASE.md）
--
--   temp + music          → songs（身份）+ song_versions（资料，一个版本一行）
--   链接三列               → song_links（挂在歌上，保存即生效）
--   navid_song + has_audio → song_audio（has_audio 由视图算出）
--   imagery_occurrences    → song_imagery    ┐
--   song_emotions          → song_emotions   ├ 改挂版本；行的 id 在各版本间不变，主键 (version_id, id)
--   song_collations(+订者) → song_collations ┘
--   users.is_admin / is_super → users.role（user / bot / admin / super）
--
-- 允许整站中断：本迁移与代码一起上线，不保留旧表与兼容写法。
-- 整个文件在一个事务里，任何一处断言失败都整体回滚，线上数据不变。

-- ════════════════════════════════════════════════════════════════════════════
-- 0. 迁移前核对
-- ════════════════════════════════════════════════════════════════════════════

-- 正式表的歌都应在暂存表里（每日同步会删掉暂存表没有的歌）
do $$
declare
  orphans text;
begin
  select string_agg(m.id::text, ', ' order by m.id) into orphans
  from public.music m
  where not exists (select 1 from public.temp t where t.id = m.id);
  if orphans is not null then
    raise exception '这些歌在正式表里、不在暂存表里：%', orphans;
  end if;
end $$;

-- 已发布的歌，暂存表与正式表内容一致（2026-11-15 已人工核对）。
-- 不一致就停下：回填只建一个冻结版本，不猜该用哪一份
do $$
declare
  diffs text;
begin
  select string_agg(t.id::text, ', ' order by t.id) into diffs
  from public.temp t
  join public.music m on m.id = t.id
  where (t.date, t.title, t.track, t.tracktotal, t.artist, t.lyricist, t.composer,
         t.arranger, t.lyrics, t.genre, t.album, t.albumartist, t.comment, t.length,
         t.discnumber, t.disctotal, t.kugolink, t.type, t.hascover, t.qmlink, t.nelink,
         t.nmn_status, t.lyrics_start, t.dispute_note)
    is distinct from
        (m.date, m.title, m.track, m.tracktotal, m.artist, m.lyricist, m.composer,
         m.arranger, m.lyrics, m.genre, m.album, m.albumartist, m.comment, m.length,
         m.discnumber, m.disctotal, m.kugolink, m.type, m.hascover, m.qmlink, m.nelink,
         m.nmn_status, m.lyrics_start, m.dispute_note);
  if diffs is not null then
    raise exception '这些歌的暂存表与正式表内容不同，先发布或放弃改动再迁移：%', diffs;
  end if;
end $$;

-- 同一个平台链接不能挂在两首歌上（song_links 有唯一约束）
do $$
declare
  dups text;
begin
  select string_agg(format('%s %s → %s', platform, url, ids), '; ') into dups
  from (
    select platform, url, string_agg(id::text, ',' order by id) as ids
    from (
      select id, 'netease' as platform, btrim(nelink) as url from public.temp
      union all select id, 'qq', btrim(qmlink) from public.temp
      union all select id, 'kugou', btrim(kugolink) from public.temp
    ) l
    where url is not null and url <> ''
    group by platform, url
    having count(*) > 1
  ) d;
  if dups is not null then
    raise exception '这些平台链接挂在多首歌上，先改掉再迁移：%', dups;
  end if;
end $$;

-- 旧数据留一份到事务结束，回填与核对行数都从这里读
create temp table old_temp on commit drop as select * from public.temp;
create temp table old_music on commit drop as select * from public.music;
create temp table old_occ on commit drop as select * from public.imagery_occurrences;
create temp table old_emotions on commit drop as select * from public.song_emotions;
create temp table old_collations on commit drop as select * from public.song_collations;
create temp table old_revisers on commit drop as select * from public.song_collation_revisers;
create temp table old_audio on commit drop as select * from public.navid_song;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. 角色：users.role 取代 is_admin / is_super
-- ════════════════════════════════════════════════════════════════════════════

alter table public.users
  add column role text not null default 'user'
    check (role in ('user', 'bot', 'admin', 'super'));

comment on column public.users.role is
  '逐级包含：bot 能读写后台但不能发布、下架、删歌，不处理用户请求；admin 再加发布与放弃草稿；super 再加下架、删歌与用户管理。同步到 JWT 的 app_metadata.role';

update public.users
set role = case when is_super then 'super' when is_admin then 'admin' else 'user' end;

-- 读 JWT 里的角色；RLS 策略与生命周期函数都用它
create function public.jwt_role() returns text
  language sql stable
  set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', 'user')
$$;

grant execute on function public.jwt_role() to authenticated, service_role;

-- 引用旧列的策略先删，删列之后按 role 重建（第 9 节）
drop policy "Admins and supers can insert" on public.imagery;
drop policy "Admins and supers can update" on public.imagery;
drop policy "Admins and supers can view" on public.imagery;
drop policy "Admins and supers can insert" on public.imagery_categories;
drop policy "Admins and supers can update" on public.imagery_categories;
drop policy "Admins and supers can view" on public.imagery_categories;
drop policy "imagery_categories_admin_delete" on public.imagery_categories;
drop policy "imagery_motifs_admin" on public.imagery_motifs;
drop policy "credit_aliases_admin" on public.credit_aliases;
drop policy "emotions_admin" on public.emotions;
drop policy "Enable users and super admins to view data" on public.users;
drop policy "user_requests_select" on public.user_requests;
drop policy "user_requests_update" on public.user_requests;

drop trigger trg_prevent_role_tampering on public.users;
drop trigger on_user_role_change on public.users;
drop function public.prevent_role_tampering();

alter table public.users drop column is_admin, drop column is_super;

-- 普通用户与匿名身份改不了自己的角色（authenticated 本就没有 users 的写权限，这里是兜底）
create function public.users_guard_role() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.role is distinct from old.role then
    raise exception '角色只能由超级管理员修改' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger users_guard_role
  before update of role on public.users
  for each row execute function public.users_guard_role();

-- 角色同步进 JWT 的 app_metadata；顺手去掉旧的两个字段
create or replace function public.sync_user_claims_to_auth() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = (coalesce(raw_app_meta_data, '{}'::jsonb) - 'is_admin' - 'is_super')
    || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;

create trigger on_user_role_change
  after insert or update of role on public.users
  for each row execute function public.sync_user_claims_to_auth();

update auth.users u
set raw_app_meta_data = (coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'is_admin' - 'is_super')
  || jsonb_build_object('role', p.role)
from public.users p
where p.id = u.id;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. 歌与版本
-- ════════════════════════════════════════════════════════════════════════════

create table public.songs (
  id bigint generated by default as identity primary key,
  live_version_id bigint,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.users (id) on delete set null
);

comment on table public.songs is
  '歌的身份。live_version_id 指向线上版本，为空表示不在线上（从未发布或已下架）。读者数据、链接、音频挂在这里';

create table public.song_versions (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs (id) on delete cascade,
  title text not null,
  date date,
  album text,
  track bigint default 1,
  tracktotal bigint default 1,
  discnumber bigint default 1,
  disctotal bigint default 1,
  artist text[],
  lyricist text[],
  composer text[],
  arranger text[],
  albumartist text[],
  genre text[] default '{古风}'::text[],
  type text[] not null default '{原创}'::text[],
  length bigint,
  lyrics text,
  lyrics_start text,
  comment text,
  dispute_note text,
  hascover boolean,
  nmn_status boolean default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  unique (song_id, id)
);

comment on table public.song_versions is
  '歌的资料，一个版本一行。published_at 为空是草稿（每首歌至多一个，保存即覆盖），非空是已冻结的版本，历史全部保留';

create unique index song_versions_one_draft
  on public.song_versions (song_id) where published_at is null;

alter table public.songs
  add constraint songs_live_version_fkey
  foreign key (id, live_version_id) references public.song_versions (song_id, id);

create table public.song_links (
  song_id bigint not null references public.songs (id) on delete cascade,
  platform text not null check (platform in ('netease', 'qq', 'kugou')),
  url text not null check (url <> ''),
  created_at timestamptz not null default now(),
  primary key (song_id, platform),
  unique (platform, url)
);

comment on table public.song_links is '各平台上的这首歌。挂在歌上，不随版本，保存即生效';

create table public.song_audio (
  song_id bigint primary key references public.songs (id) on delete cascade,
  navid_id text not null unique,
  suffix text,
  duration integer,
  created_at timestamptz not null default now()
);

comment on table public.song_audio is 'Navidrome 上的音频（原 navid_song）。has_audio 由视图按有没有这一行算出';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. 编校数据：改挂版本
-- ════════════════════════════════════════════════════════════════════════════

drop table public.imagery_occurrences cascade;   -- 连带 imagery_summary_all
drop table public.song_emotions;
drop table public.song_collation_revisers;
drop table public.song_collations;

-- 行的 id 在各版本间不变：开草稿时连 id 一起复制，后台拿着的 id 一直有效
create table public.song_imagery (
  version_id bigint not null references public.song_versions (id) on delete cascade,
  id bigint generated by default as identity,
  imagery_id bigint not null references public.imagery (id) on delete cascade,
  category_id bigint not null references public.imagery_categories (id) on delete cascade,
  lyric_timetag jsonb[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  primary key (version_id, id),
  unique (version_id, imagery_id, category_id)
);

comment on table public.song_imagery is '意象标注（原 imagery_occurrences），挂在版本上。lyric_timetag 第二段起改为读时计算';

create index song_imagery_imagery_id on public.song_imagery (imagery_id);
create index song_imagery_category_id on public.song_imagery (category_id);

create table public.song_emotions (
  version_id bigint not null references public.song_versions (id) on delete cascade,
  emotion_id smallint not null references public.emotions (id),
  rank smallint not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  primary key (version_id, emotion_id),
  unique (version_id, rank)
);

comment on table public.song_emotions is '歌的基调：rank 1 为主基调，2、3 为副基调。挂在版本上';

create index song_emotions_emotion on public.song_emotions (emotion_id);

create table public.song_collations (
  version_id bigint not null references public.song_versions (id) on delete cascade,
  id bigint generated by default as identity,
  anchor text not null default 'lyrics'
    check (anchor in ('song', 'notes', 'lyrics', 'score')),
  anchor_index integer,
  anchor_time numeric,
  anchor_quote text check (char_length(anchor_quote) <= 200),
  kind text not null,
  quote text check (char_length(quote) between 1 and 100),
  sung text check (char_length(sung) between 1 and 100),
  body text not null default '' check (char_length(body) <= 4000),
  date text check (date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, id),
  check (sung is null or quote is not null),
  check (body <> '' or sung is not null),
  check (
    (anchor = 'lyrics' and kind in ('slip', 'sung', 'version', 'note'))
    or (anchor = 'song' and kind in ('release', 'draft', 'note'))
  )
);

comment on table public.song_collations is '校记（anchor = lyrics）与补遗（anchor = song），挂在版本上';

create table public.song_collation_revisers (
  version_id bigint not null,
  collation_id bigint not null,
  user_id uuid not null references public.users (id) on delete cascade,
  first_at timestamptz not null default now(),
  primary key (version_id, collation_id, user_id),
  foreign key (version_id, collation_id)
    references public.song_collations (version_id, id) on delete cascade
);

create index song_collation_revisers_user on public.song_collation_revisers (user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. 回填（触发器在回填之后才建，回填不受冻结与审计影响）
-- ════════════════════════════════════════════════════════════════════════════

insert into public.songs (id, created_at, created_by)
select t.id, t.created_at, null
from old_temp t;

-- 已发布的歌：以正式表的内容建一个冻结版本（内容与暂存表一致，见第 0 节）
insert into public.song_versions (
  song_id, title, date, album, track, tracktotal, discnumber, disctotal,
  artist, lyricist, composer, arranger, albumartist, genre, type, length,
  lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
  published_at, created_at, created_by, updated_at, updated_by
)
select
  m.id, m.title, m.date, m.album, m.track, m.tracktotal, m.discnumber, m.disctotal,
  m.artist, m.lyricist, m.composer, m.arranger, m.albumartist, m.genre, m.type, m.length,
  m.lyrics, m.lyrics_start, m.comment, m.dispute_note, m.hascover, m.nmn_status,
  m.updated_at, t.created_at, null, t.updated_at,
  (select u.id from public.users u where u.id = t.updated_by)
from old_music m
join old_temp t on t.id = m.id;

update public.songs s
set live_version_id = v.id
from public.song_versions v
where v.song_id = s.id;

-- 没发布过的歌：以暂存表的内容建草稿
insert into public.song_versions (
  song_id, title, date, album, track, tracktotal, discnumber, disctotal,
  artist, lyricist, composer, arranger, albumartist, genre, type, length,
  lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
  published_at, created_at, created_by, updated_at, updated_by
)
select
  t.id, t.title, t.date, t.album, t.track, t.tracktotal, t.discnumber, t.disctotal,
  t.artist, t.lyricist, t.composer, t.arranger, t.albumartist, t.genre, t.type, t.length,
  t.lyrics, t.lyrics_start, t.comment, t.dispute_note, t.hascover, t.nmn_status,
  null, t.created_at, null, t.updated_at,
  (select u.id from public.users u where u.id = t.updated_by)
from old_temp t
where not exists (select 1 from old_music m where m.id = t.id);

insert into public.song_links (song_id, platform, url)
select id, platform, url
from (
  select id, 'netease' as platform, btrim(nelink) as url from old_temp
  union all select id, 'qq', btrim(qmlink) from old_temp
  union all select id, 'kugou', btrim(kugolink) from old_temp
) l
where url is not null and url <> '';

insert into public.song_audio (song_id, navid_id, suffix, duration, created_at)
select id, navid_id, suffix, duration, created_at
from old_audio;

-- 编校数据原先挂在正式表上，都属于线上版本。「同时算进」补写的行、时间标签照原样搬
insert into public.song_imagery (
  version_id, id, imagery_id, category_id, lyric_timetag, created_at, created_by
)
select s.live_version_id, o.id, o.imagery_id, o.category_id, o.lyric_timetag, o.created_at, null
from old_occ o
join public.songs s on s.id = o.song_id;

insert into public.song_emotions (version_id, emotion_id, rank, created_at, created_by)
select s.live_version_id, e.emotion_id, e.rank, e.created_at, null
from old_emotions e
join public.songs s on s.id = e.song_id;

insert into public.song_collations (
  version_id, id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote,
  sung, body, date, created_by, updated_by, created_at, updated_at
)
select
  s.live_version_id, c.id, c.anchor, c.anchor_index, c.anchor_time, c.anchor_quote,
  c.kind, c.quote, c.sung, c.body, c.date, c.created_by, c.updated_by,
  c.created_at, c.updated_at
from old_collations c
join public.songs s on s.id = c.song_id;

insert into public.song_collation_revisers (version_id, collation_id, user_id, first_at)
select s.live_version_id, r.collation_id, r.user_id, r.first_at
from old_revisers r
join old_collations c on c.id = r.collation_id
join public.songs s on s.id = c.song_id;

-- 自增从现有的最大 id 往后接
select setval(pg_get_serial_sequence('public.songs', 'id'),
              greatest((select max(id) from public.songs), 1));
select setval(pg_get_serial_sequence('public.song_imagery', 'id'),
              greatest((select max(id) from public.song_imagery), 1));
select setval(pg_get_serial_sequence('public.song_collations', 'id'),
              greatest((select max(id) from public.song_collations), 1));

-- 核对行数，对不上整体回滚
do $$
declare
  expected bigint;
  actual bigint;
begin
  select count(*) into expected from old_temp;
  select count(*) into actual from public.songs;
  if actual <> expected then
    raise exception 'songs 行数 % ≠ 原 temp 行数 %', actual, expected;
  end if;

  select count(*) into expected from old_music;
  select count(*) into actual from public.songs where live_version_id is not null;
  if actual <> expected then
    raise exception '在线的歌 % ≠ 原 music 行数 %', actual, expected;
  end if;

  select count(*) into expected from old_temp;
  select count(*) into actual from public.song_versions;
  if actual <> expected then
    raise exception 'song_versions 行数 % ≠ 歌数 %', actual, expected;
  end if;

  select count(*) into expected from old_occ;
  select count(*) into actual from public.song_imagery;
  if actual <> expected then
    raise exception 'song_imagery 行数 % ≠ 原 imagery_occurrences 行数 %', actual, expected;
  end if;

  select count(*) into expected from old_emotions;
  select count(*) into actual from public.song_emotions;
  if actual <> expected then
    raise exception 'song_emotions 行数 % ≠ 原行数 %', actual, expected;
  end if;

  select count(*) into expected from old_collations;
  select count(*) into actual from public.song_collations;
  if actual <> expected then
    raise exception 'song_collations 行数 % ≠ 原行数 %', actual, expected;
  end if;

  select count(*) into expected from old_revisers;
  select count(*) into actual from public.song_collation_revisers;
  if actual <> expected then
    raise exception 'song_collation_revisers 行数 % ≠ 原行数 %', actual, expected;
  end if;

  select count(*) into expected from old_audio;
  select count(*) into actual from public.song_audio;
  if actual <> expected then
    raise exception 'song_audio 行数 % ≠ 原 navid_song 行数 %', actual, expected;
  end if;

  select count(*) into expected
  from (
    select nelink as url from old_temp
    union all select qmlink from old_temp
    union all select kugolink from old_temp
  ) l
  where url is not null and btrim(url) <> '';
  select count(*) into actual from public.song_links;
  if actual <> expected then
    raise exception 'song_links 行数 % ≠ 原链接数 %', actual, expected;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. 读者数据改指 songs；删旧表与每日同步
-- ════════════════════════════════════════════════════════════════════════════

alter table public.comments
  drop constraint comments_song_id_fkey,
  add constraint comments_song_id_fkey
    foreign key (song_id) references public.songs (id) on delete cascade;

alter table public.collections
  drop constraint collections_song_id_fkey,
  add constraint collections_song_id_fkey
    foreign key (song_id) references public.songs (id) on delete cascade;

alter table public.user_requests
  drop constraint user_requests_song_id_fkey,
  add constraint user_requests_song_id_fkey
    foreign key (song_id) references public.songs (id) on delete set null;

select cron.unschedule(jobid) from cron.job where jobname = 'Update music';

drop function public.approve_music_sync(bigint);
drop function public.sync_music_from_temp();
drop view public.music_catalog;
drop table public.navid_song;               -- 连带 trigger_sync_has_audio
drop function public.update_music_has_audio();
drop table public.music;
drop table public.temp;                     -- 连带 temp_audit_trigger、updated_at、updated_by 触发器
drop function public.updated_by();
drop function public.imagery_occurrence_counts();

-- ════════════════════════════════════════════════════════════════════════════
-- 6. 视图（只是存起来的查询，不另存数据；写明列名）
-- ════════════════════════════════════════════════════════════════════════════

-- 线上的歌：列与原 music 一致，公开端代码只换表名
create view public.published_songs with (security_invoker = true) as
select
  s.id,
  v.date,
  v.title,
  v.track,
  v.tracktotal,
  v.artist,
  v.lyricist,
  v.composer,
  v.arranger,
  v.lyrics,
  v.genre,
  v.album,
  v.albumartist,
  v.comment,
  v.length,
  v.discnumber,
  v.disctotal,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'kugou') as kugolink,
  v.type,
  v.hascover,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'qq') as qmlink,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'netease') as nelink,
  v.nmn_status,
  exists (select 1 from public.song_audio a where a.song_id = s.id) as has_audio,
  v.published_at as updated_at,
  v.lyrics_start,
  v.dispute_note,
  v.id as version_id
from public.songs s
join public.song_versions v on v.id = s.live_version_id;

comment on view public.published_songs is
  '线上的歌：线上版本的资料 + 链接 + has_audio。updated_at 是这一版的发布时间';

-- 计入曲库的歌：去掉有争议的。统计、推荐、寻曲、意象索引读它
create view public.catalog with (security_invoker = true) as
select
  id, date, title, track, tracktotal, artist, lyricist, composer, arranger, lyrics,
  genre, album, albumartist, comment, length, discnumber, disctotal, kugolink, type,
  hascover, qmlink, nelink, nmn_status, has_audio, updated_at, lyrics_start,
  dispute_note, version_id
from public.published_songs
where dispute_note is null;

-- 每首歌的工作版本：有草稿用草稿，否则用最新的冻结版本。后台与 agent 读它
create view public.working_songs with (security_invoker = true) as
select
  s.id,
  v.date,
  v.title,
  v.track,
  v.tracktotal,
  v.artist,
  v.lyricist,
  v.composer,
  v.arranger,
  v.lyrics,
  v.genre,
  v.album,
  v.albumartist,
  v.comment,
  v.length,
  v.discnumber,
  v.disctotal,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'kugou') as kugolink,
  v.type,
  v.hascover,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'qq') as qmlink,
  (select l.url from public.song_links l where l.song_id = s.id and l.platform = 'netease') as nelink,
  v.nmn_status,
  exists (select 1 from public.song_audio a where a.song_id = s.id) as has_audio,
  v.updated_at,
  v.updated_by,
  v.lyrics_start,
  v.dispute_note,
  s.created_at,
  v.id as version_id,
  s.live_version_id is not null as is_live,
  v.published_at is null as has_draft,
  exists (
    select 1 from public.song_versions f
    where f.song_id = s.id and f.published_at is not null
  ) as ever_published
from public.songs s
join lateral (
  select *
  from public.song_versions x
  where x.song_id = s.id
  order by x.published_at desc nulls first
  limit 1
) v on true;

comment on view public.working_songs is
  '每首歌的工作版本（有草稿用草稿，否则用最新冻结版本）。is_live 在线；has_draft 有未发布的改动；ever_published 发布过';

-- 线上版本的意象标注（含争议歌曲；以曲库为整体的统计再按 catalog 过滤）
create view public.published_song_imagery with (security_invoker = true) as
select
  s.id as song_id,
  i.version_id,
  i.id,
  i.imagery_id,
  i.category_id,
  i.lyric_timetag,
  i.created_at
from public.songs s
join public.song_imagery i on i.version_id = s.live_version_id;

-- 线上版本的基调
create view public.published_song_emotions with (security_invoker = true) as
select
  s.id as song_id,
  e.version_id,
  e.emotion_id,
  e.rank
from public.songs s
join public.song_emotions e on e.version_id = s.live_version_id;

-- 工作版本的意象标注，带歌名、词名、母题名（后台意象库按词查标在哪些歌里）
create view public.working_song_imagery with (security_invoker = true) as
select
  w.id as song_id,
  w.title as song_title,
  w.album as song_album,
  i.version_id,
  i.id,
  i.imagery_id,
  im.name as imagery_name,
  i.category_id,
  c.name as category_name,
  i.lyric_timetag,
  i.created_at
from public.working_songs w
join public.song_imagery i on i.version_id = w.version_id
join public.imagery im on im.id = i.imagery_id
join public.imagery_categories c on c.id = i.category_id;

-- 后台词典：全部词及标注次数（按工作版本，含争议歌曲）
create view public.imagery_summary_all with (security_invoker = true) as
select
  im.id,
  im.name,
  count(i.id)::integer as count,
  coalesce(array_agg(distinct i.category_id) filter (where i.category_id is not null), '{}'::bigint[]) as "categoryIds"
from public.imagery im
left join public.working_song_imagery i on i.imagery_id = im.id
group by im.id, im.name;

-- 每首歌（工作版本）的标注条数，后台歌曲列表用
create function public.imagery_occurrence_counts()
  returns table (song_id bigint, n bigint)
  language sql stable
  set search_path = ''
as $$
  select i.song_id, count(*)::bigint
  from public.working_song_imagery i
  group by i.song_id
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. 冻结、盖章与审计的触发器
-- ════════════════════════════════════════════════════════════════════════════

-- 已发布的版本不能改、不能删；删歌时的级联删除除外（经级联触发时 pg_trigger_depth() > 1）。
-- 草稿的保存盖上时间与保存人；发布那一下（published_at 由空变非空）不盖，免得乐观锁误报冲突
create function public.song_versions_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null and pg_trigger_depth() = 1 then
      raise exception '已发布的版本不能删除' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.published_at is not null then
    raise exception '已发布的版本不能修改，先开草稿' using errcode = '42501';
  end if;
  if new.song_id is distinct from old.song_id then
    raise exception '版本不能换歌' using errcode = '42501';
  end if;
  if new.published_at is distinct from old.published_at then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger song_versions_guard
  before update or delete on public.song_versions
  for each row execute function public.song_versions_guard();

-- 编校数据只能写在草稿上；级联删除（删歌、放弃草稿、删词、删母题）放行
create function public.editorial_guard() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  vid bigint;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    vid := old.version_id;
  else
    if tg_op = 'UPDATE' and new.version_id is distinct from old.version_id then
      raise exception '编校数据不能换版本' using errcode = '42501';
    end if;
    vid := new.version_id;
  end if;

  if exists (
    select 1 from public.song_versions v
    where v.id = vid and v.published_at is not null
  ) then
    raise exception '已发布的版本不能修改，先开草稿' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger song_imagery_guard
  before insert or update or delete on public.song_imagery
  for each row execute function public.editorial_guard();
create trigger song_emotions_guard
  before insert or update or delete on public.song_emotions
  for each row execute function public.editorial_guard();
create trigger song_collations_guard
  before insert or update or delete on public.song_collations
  for each row execute function public.editorial_guard();
create trigger song_collation_revisers_guard
  before insert or update or delete on public.song_collation_revisers
  for each row execute function public.editorial_guard();

-- 校者、订者：开草稿时整份复制（hetu.copying = on），照原样保留，不按当前会话改写
create or replace function public.song_collations_stamp() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_setting('hetu.copying', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := null;
  elsif auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.song_collations_record_reviser() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.created_by then
    insert into public.song_collation_revisers (version_id, collation_id, user_id)
    values (new.version_id, new.id, auth.uid())
    on conflict do nothing;
  end if;
  return null;
end $$;

create trigger song_collations_stamp
  before insert or update on public.song_collations
  for each row execute function public.song_collations_stamp();

create trigger song_collations_record_reviser
  after update on public.song_collations
  for each row
  when (
    old.kind is distinct from new.kind
    or old.date is distinct from new.date
    or old.quote is distinct from new.quote
    or old.sung is distinct from new.sung
    or old.body is distinct from new.body
    or old.anchor_quote is distinct from new.anchor_quote
  )
  execute function public.song_collations_record_reviser();

-- 审计：开草稿时的整份复制、删歌与放弃草稿连带删掉的行不记（只记人直接做的改动）。
-- 级联删除的 AFTER 触发器要等整条语句结束才执行，这时 pg_trigger_depth() 已回到 1，
-- 只能看所属的版本、歌还在不在来判断
create or replace function public.record_audit_log() returns trigger
  language plpgsql security definer
  set search_path = ''
as $$
declare
  row_data jsonb;
begin
  if current_setting('hetu.copying', true) = 'on' then
    return null;
  end if;
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    if (row_data ? 'version_id' and not exists (
          select 1 from public.song_versions where id = (row_data ->> 'version_id')::bigint))
       or (tg_table_name = 'song_links' and not exists (
          select 1 from public.songs where id = (row_data ->> 'song_id')::bigint)) then
      return null;
    end if;
  end if;
  if tg_op = 'DELETE' then
    insert into public.audit_logs (table_name, action_type, user_id, old_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (table_name, action_type, user_id, old_data, new_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_logs (table_name, action_type, user_id, new_data)
    values (tg_table_name::text, tg_op, auth.uid(), to_jsonb(new));
  end if;
  return null;
end;
$$;

create trigger song_versions_audit
  after update on public.song_versions
  for each row
  when (old.published_at is not distinct from new.published_at)
  execute function public.record_audit_log();
create trigger song_imagery_audit
  after insert or update or delete on public.song_imagery
  for each row execute function public.record_audit_log();
create trigger song_emotions_audit
  after insert or update or delete on public.song_emotions
  for each row execute function public.record_audit_log();
create trigger song_collations_audit
  after insert or update or delete on public.song_collations
  for each row execute function public.record_audit_log();
create trigger song_links_audit
  after insert or update or delete on public.song_links
  for each row execute function public.record_audit_log();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. 生命周期函数（SECURITY DEFINER，函数里按 JWT 的角色检查）
-- ════════════════════════════════════════════════════════════════════════════

create function public.assert_role(allowed text[]) returns void
  language plpgsql stable
  set search_path = ''
as $$
begin
  if not (public.jwt_role() = any (allowed)) then
    raise exception '没有权限' using errcode = '42501';
  end if;
end;
$$;

-- 生命周期操作各记一条审计
create function public.log_song_event(p_action text, p_song_id bigint, p_version_id bigint)
  returns void
  language sql
  set search_path = ''
as $$
  insert into public.audit_logs (table_name, action_type, user_id, new_data)
  values ('songs', p_action, auth.uid(),
          jsonb_build_object('song_id', p_song_id, 'version_id', p_version_id))
$$;

-- 新建：一首歌 + 它的草稿。p_fields 是资料各列（键名同 song_versions 的列）
create function public.create_song(p_fields jsonb) returns bigint
  language plpgsql security definer
  set search_path = ''
as $$
declare
  f public.song_versions;
  sid bigint;
  vid bigint;
begin
  perform public.assert_role(array['bot', 'admin', 'super']);
  f := jsonb_populate_record(null::public.song_versions, p_fields);

  insert into public.songs (created_by) values (auth.uid()) returning id into sid;
  insert into public.song_versions (
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    created_by, updated_by
  ) values (
    -- 没给的列用表上的默认值；明确给了 null 的照存 null（与原先往 temp 里 insert 一致）
    sid, f.title, f.date, f.album,
    case when p_fields ? 'track' then f.track else 1 end,
    case when p_fields ? 'tracktotal' then f.tracktotal else 1 end,
    case when p_fields ? 'discnumber' then f.discnumber else 1 end,
    case when p_fields ? 'disctotal' then f.disctotal else 1 end,
    f.artist, f.lyricist, f.composer, f.arranger, f.albumartist,
    case when p_fields ? 'genre' then f.genre else '{古风}'::text[] end,
    coalesce(f.type, '{原创}'::text[]),
    f.length, f.lyrics, f.lyrics_start, f.comment, f.dispute_note, f.hascover,
    case when p_fields ? 'nmn_status' then f.nmn_status else false end,
    auth.uid(), auth.uid()
  ) returning id into vid;

  perform public.log_song_event('CREATE', sid, vid);
  return sid;
end;
$$;

-- 开草稿：已有就返回它；没有就复制最新冻结版本的资料与全部编校数据（连 id 一起）
create function public.ensure_draft(p_song_id bigint) returns bigint
  language plpgsql security definer
  set search_path = ''
as $$
declare
  draft bigint;
  src bigint;
begin
  perform public.assert_role(array['bot', 'admin', 'super']);

  -- 锁住这首歌，两个请求同时开草稿时只开一份
  perform 1 from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;
  if found then
    return draft;
  end if;

  select id into src
  from public.song_versions
  where song_id = p_song_id
  order by published_at desc
  limit 1;
  if src is null then
    raise exception '这首歌没有任何版本' using errcode = 'P0002';
  end if;

  perform set_config('hetu.copying', 'on', true);

  insert into public.song_versions (
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    created_by, updated_at, updated_by
  )
  select
    song_id, title, date, album, track, tracktotal, discnumber, disctotal,
    artist, lyricist, composer, arranger, albumartist, genre, type, length,
    lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status,
    auth.uid(), updated_at, updated_by     -- 沿用源版本的 updated_at：打开着的表单不会误报冲突
  from public.song_versions
  where id = src
  returning id into draft;

  insert into public.song_imagery (version_id, id, imagery_id, category_id, lyric_timetag, created_at, created_by)
  select draft, id, imagery_id, category_id, lyric_timetag, created_at, created_by
  from public.song_imagery where version_id = src;

  insert into public.song_emotions (version_id, emotion_id, rank, created_at, created_by)
  select draft, emotion_id, rank, created_at, created_by
  from public.song_emotions where version_id = src;

  insert into public.song_collations (
    version_id, id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote,
    sung, body, date, created_by, updated_by, created_at, updated_at
  )
  select
    draft, id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote,
    sung, body, date, created_by, updated_by, created_at, updated_at
  from public.song_collations where version_id = src;

  insert into public.song_collation_revisers (version_id, collation_id, user_id, first_at)
  select draft, collation_id, user_id, first_at
  from public.song_collation_revisers where version_id = src;

  perform set_config('hetu.copying', 'off', true);
  return draft;
end;
$$;

-- 发布：草稿冻结并成为线上版本；没有草稿而已下架时，重新上线最新的冻结版本。只有人能发布
create function public.publish_song(p_song_id bigint) returns bigint
  language plpgsql security definer
  set search_path = ''
as $$
declare
  draft bigint;
  latest bigint;
  live bigint;
begin
  perform public.assert_role(array['admin', 'super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;

  if draft is not null then
    update public.song_versions set published_at = now() where id = draft;
    update public.songs set live_version_id = draft where id = p_song_id;
    perform public.log_song_event('PUBLISH', p_song_id, draft);
    return draft;
  end if;

  if live is null then
    select id into latest
    from public.song_versions
    where song_id = p_song_id
    order by published_at desc
    limit 1;
    update public.songs set live_version_id = latest where id = p_song_id;
    perform public.log_song_event('REPUBLISH', p_song_id, latest);
    return latest;
  end if;

  raise exception '没有要发布的改动' using errcode = 'P0001';
end;
$$;

-- 放弃草稿：删掉草稿及其编校数据，回到最新的冻结版本。从没发布过的歌要用「删除」
create function public.discard_draft(p_song_id bigint) returns void
  language plpgsql security definer
  set search_path = ''
as $$
declare
  draft bigint;
begin
  perform public.assert_role(array['admin', 'super']);
  perform 1 from public.songs where id = p_song_id for update;

  select id into draft
  from public.song_versions
  where song_id = p_song_id and published_at is null;
  if draft is null then
    raise exception '没有草稿' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.song_versions
    where song_id = p_song_id and published_at is not null
  ) then
    raise exception '这首歌从没发布过，不能放弃草稿，要删就删歌' using errcode = 'P0001';
  end if;

  delete from public.song_versions where id = draft;
  perform public.log_song_event('DISCARD_DRAFT', p_song_id, draft);
end;
$$;

-- 下架：不在线上，版本、草稿、读者数据都保留
create function public.unpublish_song(p_song_id bigint) returns void
  language plpgsql security definer
  set search_path = ''
as $$
declare
  live bigint;
begin
  perform public.assert_role(array['super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if live is null then
    raise exception '这首歌不在线上' using errcode = 'P0001';
  end if;
  update public.songs set live_version_id = null where id = p_song_id;
  perform public.log_song_event('UNPUBLISH', p_song_id, live);
end;
$$;

-- 删除：歌及挂在上面的一切级联删除。在线的歌要先下架
create function public.delete_song(p_song_id bigint) returns void
  language plpgsql security definer
  set search_path = ''
as $$
declare
  live bigint;
begin
  perform public.assert_role(array['super']);

  select live_version_id into live from public.songs where id = p_song_id for update;
  if not found then
    raise exception '歌曲不存在' using errcode = 'P0002';
  end if;
  if live is not null then
    raise exception '在线的歌要先下架再删除' using errcode = 'P0001';
  end if;
  perform public.log_song_event('DELETE', p_song_id, null);
  delete from public.songs where id = p_song_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. RLS 与权限
-- ════════════════════════════════════════════════════════════════════════════
-- staff = bot / admin / super：后台读写；admin / super：发布、放弃草稿、处理反馈；super：下架、删歌、用户

alter table public.songs enable row level security;
alter table public.song_versions enable row level security;
alter table public.song_links enable row level security;
alter table public.song_audio enable row level security;
alter table public.song_imagery enable row level security;
alter table public.song_emotions enable row level security;
alter table public.song_collations enable row level security;
alter table public.song_collation_revisers enable row level security;

create policy songs_staff_select on public.songs
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_versions_staff_select on public.song_versions
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy song_versions_staff_update on public.song_versions
  for update to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super') and published_at is null)
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super') and published_at is null);

create policy song_links_staff on public.song_links
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_audio_staff_select on public.song_audio
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_imagery_staff on public.song_imagery
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_emotions_staff on public.song_emotions
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_collations_staff on public.song_collations
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy song_collation_revisers_staff_select on public.song_collation_revisers
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));

-- 原有的表按 role 重建策略（含义不变；bot 与 admin 同权）
create policy imagery_staff_select on public.imagery
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy imagery_staff_insert on public.imagery
  for insert to authenticated
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy imagery_staff_update on public.imagery
  for update to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy imagery_categories_staff_select on public.imagery_categories
  for select to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy imagery_categories_staff_insert on public.imagery_categories
  for insert to authenticated
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy imagery_categories_staff_update on public.imagery_categories
  for update to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));
create policy imagery_categories_admin_delete on public.imagery_categories
  for delete to authenticated
  using ((select public.jwt_role()) in ('admin', 'super'));

create policy imagery_motifs_staff on public.imagery_motifs
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy credit_aliases_staff on public.credit_aliases
  for all to authenticated
  using ((select public.jwt_role()) in ('bot', 'admin', 'super'))
  with check ((select public.jwt_role()) in ('bot', 'admin', 'super'));

create policy emotions_admin on public.emotions
  for all to authenticated
  using ((select public.jwt_role()) in ('admin', 'super'))
  with check ((select public.jwt_role()) in ('admin', 'super'));

create policy users_select on public.users
  for select to authenticated
  using ((select auth.uid()) = id or (select public.jwt_role()) = 'super');

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

-- 表与视图的权限：不依赖默认权限，逐个写明。anon 什么都没有
revoke all on public.songs, public.song_versions, public.song_links, public.song_audio,
  public.song_imagery, public.song_emotions, public.song_collations,
  public.song_collation_revisers
  from anon, authenticated;
revoke all on public.published_songs, public.catalog, public.working_songs,
  public.published_song_imagery, public.published_song_emotions,
  public.working_song_imagery, public.imagery_summary_all
  from anon, authenticated;

grant all on public.songs, public.song_versions, public.song_links, public.song_audio,
  public.song_imagery, public.song_emotions, public.song_collations,
  public.song_collation_revisers
  to service_role;
grant select on public.published_songs, public.catalog, public.working_songs,
  public.published_song_imagery, public.published_song_emotions,
  public.working_song_imagery, public.imagery_summary_all
  to service_role, authenticated;

grant select on public.songs, public.song_audio, public.song_collation_revisers to authenticated;
-- 草稿只能改资料列；新建、开草稿、发布、删除都经函数
grant select on public.song_versions to authenticated;
grant update (
  title, date, album, track, tracktotal, discnumber, disctotal,
  artist, lyricist, composer, arranger, albumartist, genre, type, length,
  lyrics, lyrics_start, comment, dispute_note, hascover, nmn_status
) on public.song_versions to authenticated;
grant select, insert, update, delete on public.song_links to authenticated;
grant select, insert, update, delete on public.song_emotions to authenticated;
grant select, delete on public.song_imagery to authenticated;
grant insert (version_id, imagery_id, category_id, lyric_timetag),
  update (imagery_id, category_id, lyric_timetag)
  on public.song_imagery to authenticated;
-- 校者、订者由触发器按会话写，不让客户端填
grant select, delete on public.song_collations to authenticated;
grant insert (version_id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body, date),
  update (anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body, date)
  on public.song_collations to authenticated;

-- 函数：新建的函数默认谁都不能调（20261113130000），这里逐个放开
grant execute on function public.create_song(jsonb) to authenticated;
grant execute on function public.ensure_draft(bigint) to authenticated;
grant execute on function public.publish_song(bigint) to authenticated;
grant execute on function public.discard_draft(bigint) to authenticated;
grant execute on function public.unpublish_song(bigint) to authenticated;
grant execute on function public.delete_song(bigint) to authenticated;
grant execute on function public.imagery_occurrence_counts() to service_role;
revoke execute on function public.assert_role(text[]) from public, anon, authenticated;
revoke execute on function public.log_song_event(text, bigint, bigint) from public, anon, authenticated;
