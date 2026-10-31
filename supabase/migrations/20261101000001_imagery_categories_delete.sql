-- ════════════════════════════════════════════════════════════════════════════
-- 后台「整理母题」要删 imagery_categories 的行。
--
-- 后台以用户会话写入（getUserClient），表上原本只有新增、修改的策略：删除时 RLS 把行
-- 全部滤掉，不报错、删 0 行，页面提示「一个都没删掉」。这里补一条管理员的删除策略，
-- 判断方式与 imagery_motifs 相同（JWT 的 app_metadata.is_admin）。
--
-- 只放开删除这一种操作；有标注或词登记的母题仍由外键挡住（imagery_motifs 是
-- on delete restrict），整理接口也只删第三级里没有标注的。
-- ════════════════════════════════════════════════════════════════════════════

grant delete on public.imagery_categories to authenticated;

drop policy if exists imagery_categories_admin_delete on public.imagery_categories;
create policy imagery_categories_admin_delete on public.imagery_categories
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);
