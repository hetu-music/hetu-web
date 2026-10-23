-- ════════════════════════════════════════════════════════════════════════════
-- 意象母题：词 → 可取的母题（见 IMAGERY.md）
--
--   primary      默认母题，每个词恰好一个
--   alternative  多义词的其他候选，标注时按语境在 primary 与 alternative 中选一个
--   part         并列词的其余组成（「风雨」的雨），标注时与 primary 各写一条
--
-- 母题就是 imagery_categories 的第三级。imagery_occurrences.category_id 指向母题。
-- 本文件只建表；换分类树、迁移标注见 20261022000001_imagery_motifs_data.sql。
-- ════════════════════════════════════════════════════════════════════════════

create table public.imagery_motifs (
  imagery_id bigint not null references public.imagery (id) on delete cascade,
  category_id bigint not null references public.imagery_categories (id) on delete restrict,
  role text not null check (role in ('primary', 'alternative', 'part')),
  created_at timestamptz not null default now(),
  primary key (imagery_id, category_id)
);

create unique index imagery_motifs_one_primary
  on public.imagery_motifs (imagery_id) where role = 'primary';
create index imagery_motifs_category on public.imagery_motifs (category_id);

alter table public.imagery_motifs enable row level security;

-- 后台以用户会话写入，按 JWT 的 app_metadata.is_admin 放行（与 credit_aliases 相同）
create policy imagery_motifs_admin on public.imagery_motifs
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true)
  with check ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

-- 新表不会自动授权：公开页面经服务端高权限客户端读取，后台经用户会话读写
grant select on public.imagery_motifs to service_role;
grant select, insert, update, delete on public.imagery_motifs to authenticated;

-- 与 imagery 表一样记入 audit_logs：在 Database → Triggers 里照 imagery 表的审计触发器
-- 给 imagery_motifs 加一条（after insert or update or delete, for each row）。
