-- ════════════════════════════════════════════════════════════════════════════
-- 校记：管理员写在歌词某一句上的勘误（口误、异唱、异本、附记）
--
--   song_collations  每条挂在正式曲库的一首歌、一句歌词上，署录者之名
--
-- 位置的存法与评点相同（anchor、anchor_index、anchor_time、anchor_quote）：
-- 歌词改动后按原句找回那一行。第一版只用 lyrics，其余锚点留给以后。
-- 校者、订者由触发器按当前会话写入，后台不能自己填，前台据此署「某某校 · 某某订」。
--
-- 整个文件在一个事务里，任何一步失败都整体回滚。
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table public.song_collations (
  id bigint generated always as identity primary key,
  -- 不级联删除：与 song_emotions 一样挂在正式曲库的歌上
  song_id bigint not null references public.music (id),
  anchor text not null default 'lyrics'
    check (anchor in ('song', 'notes', 'lyrics', 'score')),
  anchor_index integer,
  anchor_time numeric,
  anchor_quote text check (char_length(anchor_quote) <= 200),
  -- slip 口误 / sung 异唱 / version 异本 / note 附记；显示的名字在前端文案里
  kind text not null check (kind in ('slip', 'sung', 'version', 'note')),
  -- 句中的哪几个字，实际唱成什么；都可不填
  quote text check (char_length(quote) between 1 and 100),
  sung text check (char_length(sung) between 1 and 100),
  body text not null default '' check (char_length(body) <= 1000),
  -- 人走了校记还在，署名显示「佚名」
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 有实唱必有原文；没有实唱就得有说明，不能是空的一条
  check (sung is null or quote is not null),
  check (body <> '' or sung is not null)
);

create index song_collations_song on public.song_collations (song_id);

-- 校者、订者 ─────────────────────────────────────────────────────────────────

-- 新增时记校者；之后谁改了就记作订者。没有会话（服务端脚本、删用户时外键置空）
-- 时不动，免得删掉一个管理员把别人的订者也冲掉
create function public.song_collations_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := null;
  elsif auth.uid() is not null then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger song_collations_stamp
  before insert or update on public.song_collations
  for each row execute function public.song_collations_stamp();

-- 权限 ───────────────────────────────────────────────────────────────────────

alter table public.song_collations enable row level security;

-- 后台以用户会话写入，按 JWT 的 app_metadata.is_admin 放行（与 song_emotions 相同）
create policy song_collations_admin on public.song_collations
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

-- 新表不会自动授权。公开页面经服务端密钥读（要联表取署名，users 对他人不可读），
-- 不给 anon；后台经用户会话读写，但只能写内容列，校者、订者与时间由触发器管
grant select, insert, update, delete on public.song_collations to service_role;
grant select, delete on public.song_collations to authenticated;
grant insert (song_id, anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body),
      update (anchor, anchor_index, anchor_time, anchor_quote, kind, quote, sung, body)
  on public.song_collations to authenticated;

commit;

-- 与 imagery 表一样记入 audit_logs：在 Database → Triggers 里照 imagery 表的审计触发器
-- 给 song_collations 加一条（after insert or update or delete, for each row）。
