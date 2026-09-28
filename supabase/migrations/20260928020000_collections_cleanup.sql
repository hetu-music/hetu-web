-- ════════════════════════════════════════════════════════════════════════════
-- 收藏表清理：去掉从未用上的 target_type 与 snippet。
--
-- target_type 一直只有 0（收藏），唯一约束 uk_only_one_song_collection 却挂在
-- 「WHERE target_type = 0」上；snippet 从无写入，全表为空（2026-09-28 已查）。
--
-- 分两步执行：线上旧代码还在按 target_type 过滤、select snippet，
-- 删列必须等新代码部署之后。
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 第一步：部署新代码之前执行（新旧代码都能正常工作）─────────────────────

-- 新代码插入时不再带 target_type，给个默认值，避免 NOT NULL 拒绝插入
alter table public.collections alter column target_type set default 0;

-- 唯一约束改为不带条件：全表只有 target_type = 0 的行，原部分索引已保证不重复。
-- 收藏接口靠它的 23505 实现「重复收藏视为成功」，先建新的再删旧的，中间不留空档。
alter table public.collections
  add constraint collections_user_song_key unique (user_id, song_id);
drop index if exists public.uk_only_one_song_collection;

-- ─── 第二步：新代码部署之后再单独执行 ───────────────────────────────────────
--
-- 若报「other objects depend on it」，说明有 RLS 策略引用了 target_type，
-- 先用下面这条查出来，去掉策略里的 target_type 条件后再删：
--   select policyname, qual, with_check from pg_policies where tablename = 'collections';
--
--   alter table public.collections drop column target_type;
--   alter table public.collections drop column snippet;
