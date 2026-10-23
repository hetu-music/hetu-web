-- ════════════════════════════════════════════════════════════════════════════
-- 歌曲基调（见 IMAGERY.md「基调」一节），并删除从未启用的「含义」子系统
--
--   emotions       基调词表：11 个，按「明 / 暗」「扬 / 抑」两条轴归位
--   song_emotions  每首歌 1 个主基调（rank 1）、0–2 个副基调（rank 2、3）
--
-- 含义子系统：imagery_meanings 为空表、imagery_occurrences.meaning_id 全为空，
-- 新建含义的接口从来存不进去。基调按歌标注后它没有用处，连同引用它的视图列一起删掉。
--
-- 整个文件在一个事务里，任何一步失败都整体回滚。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 1. 基调词表 ───────────────────────────────────────────────────────────────

create table public.emotions (
  id smallint primary key,
  name text not null unique,
  description text not null,
  -- 情绪的冷暖与强弱，供测验、可视化分组
  tone text not null check (tone in ('明', '暗')),
  energy text not null check (energy in ('扬', '抑')),
  sort smallint not null
);

insert into public.emotions (id, name, description, tone, energy, sort) values
  (1,  '思念', '念人、怀乡、等人归来：心里装着不在眼前的人或地方', '暗', '抑', 1),
  (2,  '离愁', '分别当下或将要分别的痛', '暗', '抑', 2),
  (3,  '孤寂', '独自一人，无人懂、无人知', '暗', '抑', 3),
  (4,  '怅惘', '若有所失，往事不可追，说不清的惆怅', '暗', '抑', 4),
  (5,  '苍凉', '兴亡与时间面前人的渺小；怀古、历史的荒凉', '暗', '抑', 5),
  (6,  '悲怆', '死别、国破、宿命这类强烈的痛', '暗', '扬', 6),
  (7,  '执守', '明知无望仍不放手：痴情、守诺、守城', '暗', '扬', 7),
  (8,  '豪迈', '快意、壮志、江湖气、少年意气', '明', '扬', 8),
  (9,  '欢快', '喜庆、诙谐、轻松热闹', '明', '扬', 9),
  (10, '洒脱', '看开、闲适、超然物外', '明', '抑', 10),
  (11, '温柔', '眷恋、甜蜜、暖意与珍惜', '明', '抑', 11);

-- 2. 歌曲基调 ───────────────────────────────────────────────────────────────

-- 不级联删除：与 imagery_occurrences 一样挂在正式曲库的歌上
create table public.song_emotions (
  song_id bigint not null references public.music (id),
  emotion_id smallint not null references public.emotions (id),
  rank smallint not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (song_id, emotion_id),
  unique (song_id, rank)
);

create index song_emotions_emotion on public.song_emotions (emotion_id);

alter table public.emotions enable row level security;
alter table public.song_emotions enable row level security;

-- 后台以用户会话写入，按 JWT 的 app_metadata.is_admin 放行（与 imagery_motifs 相同）
create policy emotions_admin on public.emotions
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);
create policy song_emotions_admin on public.song_emotions
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

-- 新表不会自动授权：公开页面与维护脚本经服务端密钥读写，后台经用户会话读写
grant select, insert, update, delete on public.emotions to service_role;
grant select, insert, update, delete on public.song_emotions to service_role;
grant select, insert, update, delete on public.emotions to authenticated;
grant select, insert, update, delete on public.song_emotions to authenticated;

-- 3. 删除含义子系统 ─────────────────────────────────────────────────────────

-- imagery_occurrences_catalog 是 select * 建的视图，展开后带着 meaning_id，
-- 删列前要先删视图。这里按线上的定义去掉那一列后重建，并恢复原有的选项与授权。
do $$
declare
  def text;
  opts text[];
  acl aclitem[];
  g record;
begin
  select pg_get_viewdef(c.oid, true), c.reloptions, c.relacl
    into def, opts, acl
    from pg_class c
   where c.oid = 'public.imagery_occurrences_catalog'::regclass;

  def := regexp_replace(def, ',\s*(\w+\.)?meaning_id\M', '', 'g');
  if def ~ 'meaning_id' then
    raise exception '没能从视图定义里去掉 meaning_id，请手动处理：%', def;
  end if;

  drop view public.imagery_occurrences_catalog;
  alter table public.imagery_occurrences drop column meaning_id;
  execute format(
    'create view public.imagery_occurrences_catalog %s as %s',
    case when opts is null then '' else 'with (' || array_to_string(opts, ', ') || ')' end,
    def
  );
  for g in
    select a.grantee::regrole::text as grantee, a.privilege_type
      from aclexplode(acl) a
     where a.grantee <> 0
       and a.grantee <> (select relowner from pg_class
                          where oid = 'public.imagery_occurrences_catalog'::regclass)
  loop
    execute format('grant %s on public.imagery_occurrences_catalog to %s',
                   g.privilege_type, g.grantee);
  end loop;
end $$;

drop table public.imagery_meanings;

commit;

-- 与 imagery 表一样记入 audit_logs：在 Database → Triggers 里照 imagery 表的审计触发器
-- 给 song_emotions 加一条（after insert or update or delete, for each row）。
