-- 歌曲基调记下来源：ai 为批量预标、尚未经人确认；human 为人工标注或确认过。
-- 后台保存一律写 human；预标脚本（pnpm emotion:label）只给还没有基调的歌写 ai。
-- 已有的行都是人工试标的，取默认值 human。
alter table public.song_emotions
  add column source text not null default 'human'
  check (source in ('human', 'ai'));
