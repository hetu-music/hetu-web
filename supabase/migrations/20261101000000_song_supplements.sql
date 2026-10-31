-- ════════════════════════════════════════════════════════════════════════════
-- 补遗：记在整首歌上的资料（各版本的发布时间、废弃的文案等），与歌词校记同表
--
--   song_collations.anchor = 'song'   补遗：类型 release 版本 / draft 旧稿 / note 附记
--   song_collations.anchor = 'lyrics' 歌词校记：slip 口误 / sung 异唱 / version 异本 / note 附记
--
-- 补遗不挂在某一句上，位置的几列都空着；多一列日期，按日期排。
-- 旧稿可能整段照录，正文上限放宽到 4000 字（歌词校记仍由接口限在 1000 字）。
-- 须在 20261031000000_song_collations.sql 之后执行。
--
-- 整个文件在一个事务里，任何一步失败都整体回滚。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- 只到年、到月都可以：2019、2019-08、2019-08-15
alter table public.song_collations
  add column date text check (date ~ '^\d{4}(-\d{2}(-\d{2})?)?$');

-- 类型随位置而定：补遗的类型不能挂到歌词上，反之亦然
alter table public.song_collations drop constraint song_collations_kind_check;
alter table public.song_collations add constraint song_collations_kind_check check (
  (anchor = 'lyrics' and kind in ('slip', 'sung', 'version', 'note'))
  or (anchor = 'song' and kind in ('release', 'draft', 'note'))
);

alter table public.song_collations drop constraint song_collations_body_check;
alter table public.song_collations add constraint song_collations_body_check
  check (char_length(body) <= 4000);

-- 列级授权要逐列补上新列
grant insert (date), update (date) on public.song_collations to authenticated;

commit;
