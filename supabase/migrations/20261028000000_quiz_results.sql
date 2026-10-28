-- ════════════════════════════════════════════════════════════════════════════
-- 寻曲结果的保存记录（见 docs/QUIZ-SIGNUP.md「第三步：保存结果」）
--
--   quiz_results  登录用户主动保存的测验结果快照，每人最多 5 条
--
-- 只存键名和数值，展示文案在渲染时按语言生成。记录写入后不再修改，
-- id 就是结果页链接里的 10 位乱码。别人打开链接时由服务端按 id 读取，
-- 不给 anon 任何权限，否则整张表能经 PostgREST 列出来。
--
-- 整个文件在一个事务里，任何一步失败都整体回滚。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 1. 记录 id ────────────────────────────────────────────────────────────────

-- 10 位 base62 随机串。随机字节取自 gen_random_uuid()，不依赖 pgcrypto；
-- 跳过 UUID 里记版本号和变体的第 6、8 字节。按 62 取模略有偏差，不影响用途
create function public.random_quiz_result_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
           substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                  get_byte(r.b, i.pos) % 62 + 1, 1),
           '' order by i.n)
    from (select uuid_send(gen_random_uuid()) as b) r,
         unnest(array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11]) with ordinality as i (pos, n)
$$;

-- 2. 记录表 ─────────────────────────────────────────────────────────────────

create table public.quiz_results (
  id text primary key default public.random_quiz_result_id()
    check (id ~ '^[0-9A-Za-z]{10}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 保存时的 QUIZ_VERSION
  quiz_version text not null,
  -- 作答的字母串，只作留档和判断「已保存」，不用来重算
  code text not null,
  -- 主气韵、兼有的气韵：维度键
  persona text not null,
  secondary text,
  -- 各维度的 z 分数，按高到低：[{"key": "tianxiang", "z": 1.23}, …]
  profile jsonb not null,
  -- 偏爱的意象
  imagery text[] not null default '{}',
  -- 推荐的歌和契合度，按顺序一一对应
  song_ids integer[] not null,
  percents integer[] not null,
  -- 每首歌的推荐理由，只存键名：[[{"dim": "tianxiang"}, {"imagery": "月"}], …]
  reasons jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, quiz_version, code),
  check (cardinality(song_ids) = cardinality(percents))
);

create index quiz_results_user_created
  on public.quiz_results (user_id, created_at desc);

-- 3. 每人最多 5 条 ──────────────────────────────────────────────────────────

-- 插入后删掉该用户第 5 条以后的旧记录。同一用户的保存先排队：
-- 后一个请求等前一个提交后再数，两个并发的保存也不会超额
create function public.quiz_results_keep_latest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('quiz_results'), hashtext(new.user_id::text));
  delete from public.quiz_results
   where user_id = new.user_id
     and id not in (
       select id
         from public.quiz_results
        where user_id = new.user_id
        order by created_at desc, id desc
        limit 5
     );
  return null;
end
$$;

create trigger quiz_results_keep_latest
  after insert on public.quiz_results
  for each row execute function public.quiz_results_keep_latest();

-- 4. 权限 ───────────────────────────────────────────────────────────────────

-- 用户只能读、存、删自己的记录，不能改
alter table public.quiz_results enable row level security;

create policy quiz_results_select_own on public.quiz_results
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy quiz_results_insert_own on public.quiz_results
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy quiz_results_delete_own on public.quiz_results
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 新表不会自动授权：结果页经服务端密钥按 id 读，保存与删除经用户会话。
-- 触发器以插入者的身份删旧记录，所以 authenticated 要有 delete
grant select, insert, delete on public.quiz_results to service_role;
grant select, insert, delete on public.quiz_results to authenticated;
revoke all on function public.random_quiz_result_id() from public;
grant execute on function public.random_quiz_result_id() to authenticated, service_role;

commit;
