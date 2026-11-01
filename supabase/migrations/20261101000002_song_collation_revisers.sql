-- ════════════════════════════════════════════════════════════════════════════
-- 订者名单：校记、补遗被谁改过，全部记下
--
--   song_collation_revisers  一条校记（或补遗）的每位订者，按第一次修改的先后排
--
-- 原先只有 updated_by 一列，每次修改都覆盖，甲写、乙改、丙再改，乙就丢了。
-- 现在每次修改由触发器把当前用户记进名单，一人只记一次；校者改自己的不记。
-- 只改了位置的时间、或原样保存，不算修订。
-- updated_by 仍留着，记最后一个改的人，前台不再据它署名。
-- 须在 20261101000000_song_supplements.sql 之后执行（要比较 date 列）。
--
-- 整个文件在一个事务里，任何一步失败都整体回滚。
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table public.song_collation_revisers (
  collation_id bigint not null references public.song_collations (id) on delete cascade,
  -- 人走了就从名单里去掉：满屏「佚名 订」没有信息量（校者仍署「佚名」）
  user_id uuid not null references public.users (id) on delete cascade,
  first_at timestamptz not null default now(),
  primary key (collation_id, user_id)
);

-- 记订者 ─────────────────────────────────────────────────────────────────────

-- security definer：后台的管理员会话对这张表没有写权限，由触发器代写
create function public.song_collations_record_reviser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.created_by then
    insert into public.song_collation_revisers (collation_id, user_id)
    values (new.id, auth.uid())
    on conflict do nothing;
  end if;
  return null;
end $$;

-- 只看内容列：原样保存、或歌词调了时间轴只动了 anchor_time，都不署订者
create trigger song_collations_record_reviser
  after update on public.song_collations
  for each row
  when (
    (old.kind, old.date, old.quote, old.sung, old.body, old.anchor_quote)
    is distinct from
    (new.kind, new.date, new.quote, new.sung, new.body, new.anchor_quote)
  )
  execute function public.song_collations_record_reviser();

-- 旧数据：已有的订者记作第一位
insert into public.song_collation_revisers (collation_id, user_id, first_at)
select id, updated_by, updated_at
from public.song_collations
where updated_by is not null and updated_by is distinct from created_by
on conflict do nothing;

-- 权限 ───────────────────────────────────────────────────────────────────────

-- 前台、后台都经服务端密钥读（要联表取名字）；写只经上面的触发器
alter table public.song_collation_revisers enable row level security;
grant select, insert, delete on public.song_collation_revisers to service_role;

commit;
