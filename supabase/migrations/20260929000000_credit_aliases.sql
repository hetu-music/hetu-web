-- ════════════════════════════════════════════════════════════════════════════
-- 署名别名：同一个人在不同作品里署了不同的名字（如「萧忆情Alex」与「萧忆情」）。
--
--   alias  作品里实际出现的署名
--   name   主名：卷首、列表、筛选、搜索统一用它
--
-- music 里的署名字段保持原样不改，归并只在公开读取时做；版记照录原署。
-- 录入错字不要登记在这里，直接改歌曲资料。
-- 不登记的名字就是它自己，所以只需要录真正的别署。
-- ════════════════════════════════════════════════════════════════════════════

create table public.credit_aliases (
  alias text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  -- 别名不能指向自己
  constraint credit_aliases_not_self check (alias <> name)
);

-- 只归并一层：主名本身不能再是别名，否则 A→B→C 要不要连着走就说不清了。
-- 两个方向都要拦：新登记的主名已是别名，或新登记的别名已被当作主名。
create function public.credit_aliases_no_chain()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.credit_aliases where alias = new.name) then
    raise exception '主名「%」本身已登记为别名', new.name;
  end if;
  if exists (select 1 from public.credit_aliases where name = new.alias) then
    raise exception '「%」已是其他别名的主名，不能再登记为别名', new.alias;
  end if;
  return new;
end;
$$;

create trigger credit_aliases_no_chain
  before insert or update on public.credit_aliases
  for each row execute function public.credit_aliases_no_chain();

alter table public.credit_aliases enable row level security;

-- 新表不会自动授权（anon 对现有表也没有权限，这里保持一致）；
-- 公开页面只经服务端高权限客户端读取
grant select on public.credit_aliases to service_role;
